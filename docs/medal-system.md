# Medal System

Medals are achievements awarded to users when configurable criteria are satisfied. The system has two layers: **MedalConfig** (a template that defines what must happen) and **Medal** (an instance recording that a specific user earned it at a point in time).

## Data Models

### MedalConfig

Stored in the `MedalConfig` table. Each config is a reusable template.

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name shown to the user |
| `description` | string | Longer explanation / notification body |
| `series` | string | Grouping label (e.g. `"fasting"`, `"streak"`) — also used by `medalCount` facts to count medals within a series |
| `recurrence` | number | Maximum times the medal can be earned. `0` = unlimited; any positive number caps re-awards |
| `prestige` | number | Sort order — higher values appear first in all listing endpoints |
| `icon` | string | Icon identifier for frontend rendering |
| `factRequests` | `FactRequest[]` | Data queries that must be resolved before criteria are evaluated (see below) |
| `streakRequests` | `StreakRequest[]` | Consecutive-period queries resolved into the same fact map as `factRequests` (see below) |
| `criteria` | `Criterion \| Criteria` | Boolean expression evaluated against resolved fact values to decide if the medal should be awarded (see below) |

### Medal

Each row in the `Medal` table represents one award event.

| Field | Description |
|---|---|
| `userId` | The user who earned it |
| `medalConfigId` | Which MedalConfig was satisfied |
| `awardedAt` | Timestamp of the award |

---

## FactRequests

A `FactRequest` binds a `FactContext` to an **alias** string. The alias is used as the key in the fact map that is later evaluated against `criteria`.

```json
{
  "alias": "fastingDays",
  "context": {
    "operation": "entityCount",
    "filter": { "listId": 42 }
  }
}
```

The Fact system resolves this via `Fact.resolve(context, userId)` and stores the result as `facts["fastingDays"] = <computed value>`. See [fact-system.md](./fact-system.md) for the full list of operations and caching behaviour.

---

## StreakRequests

A `StreakRequest` measures **consecutive time periods** where a condition held. Its alias is also added to the fact map, with the streak count as the value.

| Field | Type | Description |
|---|---|---|
| `alias` | string | Key in the fact map (must be referenced in `criteria`) |
| `segmentUnit` | `SegmentationTimeUnit` | Granularity: `HOUR`, `DAY`, `WEEK`, `MONTH`, `YEAR` |
| `length` | number | How many past periods to examine (the streak can be at most this long) |
| `innerContext` | `FactContext` | What to measure inside each period |
| `innerOperator` | `EvalOperator` | How to compare the inner fact value |
| `innerValue` | `string \| number \| boolean` | The threshold the inner fact must satisfy |

**Example — "no eating for 7 consecutive days":**

```json
{
  "alias": "fastingStreak",
  "segmentUnit": "DAY",
  "length": 7,
  "innerContext": {
    "operation": "entityCount",
    "filter": { "listId": 42 }
  },
  "innerOperator": "==",
  "innerValue": 0
}
```

This asks: "For each of the last 7 days, did the user log zero entries in list 42?" The streak engine walks from today backwards and stops at the first day the condition fails. The alias `"fastingStreak"` is added to the fact map with the resulting count (0–7).

**How the Streak engine works:**

1. Generate `length` lookback segments from now. Segment 0 is the current period; segment `length - 1` is the oldest.
2. For each segment, inject its start/end timestamps into the `innerContext` so the fact query is scoped to that period only.
3. Evaluate the inner fact value against `innerOperator`/`innerValue`.
4. Increment the streak counter until the first segment that fails — then stop.
5. The final count is stored in the fact map under the alias.

Segment boundaries are computed in the **user's local timezone** (read from the `TIMEZONE` setting, stored as UTC offset minutes). For example, a `DAY` segment at UTC+5:30 runs from 00:00 to 23:59 Indian Standard Time, not UTC midnight.

`ANALYSIS_CLASSIFICATION` streaks bypass `Fact.resolve` entirely and query the `analysisClassificationResult` table directly, since the Fact cache cannot compute that operation on the fly.

---

## Criteria

Criteria form a boolean tree evaluated against the resolved fact map.

### Leaf: Criterion

```json
{ "fact": "fastingStreak", "operator": ">=", "value": 7 }
```

`fact` must match an alias from `factRequests` or `streakRequests`. Supported operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`. `contains` is substring match when `value` is a string, or array-membership when `value` is an array.

### Branch: Criteria

```json
{
  "all": [
    { "fact": "fastingStreak", "operator": ">=", "value": 7 }
  ]
}
```

- `all` — every child must pass (logical AND)
- `any` — at least one child must pass (logical OR)

Nodes can be nested arbitrarily deep:

```json
{
  "any": [
    { "all": [ { "fact": "a", "operator": ">", "value": 10 }, { "fact": "b", "operator": "==", "value": true } ] },
    { "fact": "c", "operator": ">=", "value": 100 }
  ]
}
```

**Validation at save time:** When a MedalConfig is created or updated, every alias referenced in the criteria tree is checked against the declared `factRequests` and `streakRequests`. Missing aliases cause the API to return an error listing them. This prevents silent failures at disbursement time.

---

## Disbursement

Medal disbursement runs through `Medal.checkForDisbursement(context)`, called from a hook after user data changes. The full sequence for each MedalConfig:

1. Resolve all `factRequests` via the Fact cache/compute pipeline.
2. If any fact returns `undefined` (e.g. an `analysisClassification` result not yet seeded), **skip this config entirely** — it will be re-evaluated next time the hook fires.
3. Resolve all `streakRequests` (if any) and merge into the fact map.
4. Evaluate the `criteria` tree. Skip if false.
5. Open a **Serializable transaction** to:
   - Re-count existing awards for this user+config.
   - If `recurrence > 0` and the cap is already met, abort.
   - Otherwise insert a new `Medal` row.
6. If the medal was created, send a push notification.

The transaction isolation prevents race conditions where two concurrent requests could both pass the recurrence check and both insert a medal.

---

## Example: "Don't break a fast for 7 days"

**Goal:** Award a medal the first time a user goes 7 consecutive days without logging any entry in the fasting list.

**MedalConfig:**

```json
{
  "name": "7-Day Fast",
  "description": "You didn't break your fast for 7 consecutive days.",
  "series": "fasting",
  "recurrence": 0,
  "prestige": 10,
  "icon": "medal-fast-7",
  "factRequests": [],
  "streakRequests": [
    {
      "alias": "fastingStreak",
      "segmentUnit": "DAY",
      "length": 7,
      "innerContext": {
        "operation": "entityCount",
        "filter": { "listId": <YOUR_FASTING_LIST_ID> }
      },
      "innerOperator": "==",
      "innerValue": 0
    }
  ],
  "criteria": {
    "fact": "fastingStreak",
    "operator": ">=",
    "value": 7
  }
}
```

- `recurrence: 0` means the user can earn this medal multiple times (every new 7-day run).
- To make it a one-time award, set `recurrence: 1`.
- The streak checks the last 7 days in the user's local timezone, so the day boundary is always midnight local time.

---

## HTTP Endpoints

| Route | Method | Description |
|---|---|---|
| `medalConfig` | GET | List all configs with current `criteriaProgress` for the authenticated user |
| `medalConfig/{id}` | GET | Single config with progress |
| `medalConfig` | POST | Create a new config |
| `medalConfig/{id}` | PUT | Update a config |
| `medalConfig/{id}` | DELETE | Delete a config |
| `medal` | GET | List medals earned by the authenticated user |

`criteriaProgress` in the GET responses contains the resolved value for each `factRequest` alias — useful for rendering "X of Y" progress indicators. Streak values are **not** included in `criteriaProgress` (only `factRequests` are resolved there).

---

## Files

| File | Role |
|---|---|
| `src/lib/Medal.ts` | All medal business logic |
| `src/lib/Fact.ts` | Fact computation and caching |
| `src/lib/Streak.ts` | Consecutive-period streak evaluation |
| `src/models/Medal.ts` | TypeScript interfaces, Zod schemas, Prisma type extractors |
| `src/models/FactCache.ts` | TTL constants and Prisma type extractor for FactCache |
| `src/models/Streak.ts` | `SegmentInfo` interface |
| `src/functions/medal.ts` | HTTP handler for `/medal` |
| `src/functions/medalConfig.ts` | HTTP handler for `/medalConfig/{id?}` |
| `src/functions/factCache.ts` | HTTP handler for `/factCache/{contextKey?}` |
| `prisma/schema.prisma` | `MedalConfig`, `Medal`, `FactCache` table definitions |
