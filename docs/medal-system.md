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

A `propertySum` fact request looks like:

```json
{
  "alias": "totalCalories",
  "context": {
    "operation": "propertySum",
    "propertyConfigId": 7,
    "filter": { "includeTypes": [3] }
  }
}
```

This sums all integer values of the property with `propertyConfigId: 7` across entities matching the filter. If an entity has the property set multiple times (repeatable property), each value is included in the sum.

---

## StreakRequests

A `StreakRequest` measures **consecutive time periods** where a condition held. Its alias is also added to the fact map, with the streak count as the value.

| Field | Type | Description |
|---|---|---|
| `alias` | string | Key in the fact map (must be referenced in `criteria`) |
| `segmentUnit` | `SegmentationTimeUnit` | Granularity: `HOUR`, `DAY`, `WEEK`, `MONTH`, `YEAR` |
| `length` | number | How many past periods to examine (the streak can be at most this long) |
| `innerContext` | `FactContext` | What to measure inside each period — see note on `analysisClassification` below |
| `innerOperator` | `EvalOperator` | How to compare the inner fact value |
| `innerValue` | `string \| number \| boolean` | The threshold the inner fact must satisfy |

**How the Streak engine works:**

1. Generate `length` lookback segments from now. Segment 0 is the current period; segment `length - 1` is the oldest.
2. For each segment, resolve the inner fact value.
3. If the value is missing for a segment, **the streak is broken at that point** — a gap in data is treated as failure.
4. Compare the value against `innerOperator`/`innerValue`. If the condition fails, stop.
5. Otherwise increment the counter and continue to the next (older) segment.
6. The final count is stored in the fact map under the alias.

Segment boundaries are computed in the **user's local timezone** (read from the `TIMEZONE` setting, stored as UTC offset minutes). For example, a `DAY` segment at UTC+5:30 runs from 00:00 to 23:59 Indian Standard Time, not UTC midnight.

### Non-classification streaks (entityCount, uniqueTagCount, medalCount, propertySum)

For these operations the streak engine calls `Fact.resolve` with the date range for each segment injected into the `innerContext.filter`. The result is a regular cached fact lookup scoped to that time window.

`propertySum` computes the sum of all integer property values (identified by `propertyConfigId`) across entities that match the filter within the segment's time window. If no matching entities have the property, the segment value is 0.

### analysisClassification streaks

When `innerContext.operation` is `"analysisClassification"`, the streak engine **bypasses `Fact.resolve` entirely** and queries the `analysisClassificationResult` table directly:

```
WHERE userId = ?
  AND analysisType = innerContext.analysisType
  AND segmentUnit = req.segmentUnit
  AND segmentKey IN (...)
```

**Important: the `filter` field of an `analysisClassification` innerContext is not used during streak evaluation.** It is required by the TypeScript type (because `AnalysisClassificationFactContext` always carries a `filter`) but the streak engine never reads it — it matches results only by `analysisType` and `segmentKey`. You must still provide a valid `filter` object to satisfy the type, but its contents are irrelevant to how the streak is scored.

The `analysisClassificationResult` table is populated by an **external AI analysis pipeline** that posts results to the `/analysisClassificationResult` endpoint using `SYSTEM_API_KEY`. Each row stores the AI's output for one (user, analysisType, segmentUnit, segmentKey) combination. The value is a `number` (returned by the analysis service) — the exact scale and semantics are determined by the external service. Set `innerOperator` and `innerValue` to match what that service produces for a "positive" classification.

Available `analysisType` values:
- `"morningFasting"` — classifies whether the user exhibited morning fasting behaviour
- `"afternoonSnacking"` — classifies whether the user exhibited afternoon snacking behaviour
- `"caffeineIntake"` — classifies whether the user exhibited caffeine intake behaviour

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

Medal disbursement runs through `Medal.checkForDisbursement(context)`, called from hooks after relevant data changes. The full sequence for each MedalConfig:

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

### What triggers a disbursement check

**Entity-based medals** (`entityCount`, `uniqueTagCount`, `medalCount`, `propertySum` criteria): `Entity.ts` calls `Hook.trigger` on every entity create, update, and delete. `processHook` dequeues these asynchronously and runs `checkForDisbursement`.

**Analysis-classification streak medals**: entity mutations are the wrong trigger because the AI data for the current segment won't exist yet at mutation time. Two triggers cover this instead:

1. **`analysisClassificationScheduler` (daily timer, `src/functions/analysisClassificationScheduler.ts`)** — runs at 04:00 UTC. Scans all MedalConfigs for `analysisClassification` streak requests, finds users with recent entity activity on `aiClassifyEnabled` entity types, calls the Assist service to classify the most recently completed segment for each user, writes results to `analysisClassificationResult`, then triggers `Hook.trigger` directly so disbursement runs immediately.

2. **`POST /analysisClassificationResult` (external pipeline)** — when an external AI system posts a result, a hook trigger on that endpoint fires disbursement for that user. *(Hook not yet wired; add `Hook.trigger` call in `src/functions/analysisClassificationResult.ts` after the successful upsert.)*

### User eligibility for the daily timer

The scheduler only processes users who have created at least one entity in the last 30 days using an entity config that has `aiClassifyEnabled = true`. If the medal config's `filter.includeTypes` is non-empty, only those specific entity config IDs (intersected with `aiClassifyEnabled = true`) are considered. This prevents unnecessary AI calls for inactive users or entity types not relevant to the analysis.

---

## Example: "Don't break a fast for 7 days"

**Goal:** Award a medal when the AI analysis confirms the user maintained morning fasting behaviour for 7 consecutive days.

This uses the `analysisClassification` operation with `analysisType: "morningFasting"`. The AI pipeline posts a result to `/analysisClassificationResult` for each day it has assessed; the streak engine reads those stored results to count consecutive days where the classification was positive (value `> 0`).

### The MedalConfig

```json
{
  "name": "7-Day Fast",
  "description": "You maintained your morning fast for 7 days in a row.",
  "series": "fasting",
  "recurrence": 1,
  "prestige": 10,
  "icon": "medal-fast-7",
  "factRequests": [],
  "streakRequests": [
    {
      "alias": "fastingStreak",
      "segmentUnit": "DAY",
      "length": 7,
      "innerContext": {
        "operation": "analysisClassification",
        "analysisType": "morningFasting",
        "filter": {}
      },
      "innerOperator": ">",
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

### Field-by-field explanation

| Field | Value | Why |
|---|---|---|
| `factRequests` | `[]` | No direct fact queries needed — the streak handles all data access |
| `streakRequests[0].alias` | `"fastingStreak"` | Name used in `criteria.fact` to reference this streak's count |
| `streakRequests[0].segmentUnit` | `"DAY"` | One classification result per day |
| `streakRequests[0].length` | `7` | Check at most the last 7 days; the streak count is between 0 and 7 |
| `streakRequests[0].innerContext.operation` | `"analysisClassification"` | Tells the streak engine to query `analysisClassificationResult`, not the Fact cache |
| `streakRequests[0].innerContext.analysisType` | `"morningFasting"` | Which AI classification to look up |
| `streakRequests[0].innerContext.filter` | `{}` | **Required by the type but unused during streak evaluation.** Provide an empty object. The streak engine matches by `analysisType` and `segmentKey` only; it never applies this filter. |
| `streakRequests[0].innerOperator` | `">"` | The condition that must be true for a day to count toward the streak |
| `streakRequests[0].innerValue` | `0` | Together with `>`: a day counts if the AI returned a value greater than 0 (positive fasting classification) |
| `criteria.fact` | `"fastingStreak"` | References the alias resolved by the streak request |
| `criteria.operator` | `">="` | |
| `criteria.value` | `7` | The streak must be exactly 7 days long (all 7 checked days passed) |
| `recurrence` | `1` | One-time award. Set to `0` for repeatable (re-awarded each time a new 7-day run completes) |

### What must be in place before this works

The streak engine can only count days for which the AI pipeline has already posted a result. A day with no row in `analysisClassificationResult` breaks the streak at that point. The pipeline posts via:

```
POST /analysisClassificationResult
Authorization: <SYSTEM_API_KEY>

{
  "userId": "<uuid>",
  "analysisType": "morningFasting",
  "segmentUnit": "DAY",
  "segmentKey": "2026-06-09",
  "value": 1
}
```

The `segmentKey` format must match what `Streak.segmentKey` produces for `DAY` segments: `"YYYY-MM-DD"` in the **user's local timezone**. If the pipeline generates keys in UTC and the user is in a different timezone, the keys will not align and the streak count will be 0.

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
| `src/functions/analysisClassificationResult.ts` | HTTP handler for `/analysisClassificationResult` (external pipeline writes) |
| `src/functions/analysisClassificationScheduler.ts` | Daily timer (04:00 UTC) that drives AI classification for active users |
| `src/lib/AnalysisClassificationScheduler.ts` | Core scheduler logic: target discovery, user eligibility, Assist calls, result storage |
| `prisma/schema.prisma` | `MedalConfig`, `Medal`, `FactCache`, `AnalysisClassificationResult` table definitions |
