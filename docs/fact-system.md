# Fact System

The Fact system is a thin computation-and-cache layer that answers queries about a user's data. It is the primitive that feeds the Medal criteria evaluator and the streak engine.

## Core Concept

A **Fact** is a scalar value (`string | number | boolean`) derived from a `FactContext` object that describes _what_ to compute and _how_ to scope the query. Because many medal configs may request the same context in a single disbursement pass, results are cached in the `FactCache` database table.

## FactContext Operations

Each `FactContext` has an `operation` field that determines the computation path:

| Operation | What it returns | Inputs |
|---|---|---|
| `entityCount` | Number of entities matching a list filter | `filter: ListFilter` |
| `uniqueTagCount` | Count of distinct tag labels across filtered entities | `filter: ListFilter` |
| `medalCount` | Number of times a specific medal config (or series) has been earned | `medalConfigId`, `series`, optional `start`/`end` |
| `propertySum` | Sum of the given property's values across filtered entities. For a standard int property this sums stored `IntPropertyValue` rows; for a calculated property (non-null `calculation`) there are no stored values, so each entity's value is derived in SQL (see `Fact.sumCalculatedProperty`) and the derived values are summed | `propertyConfigId: number`, `filter: ListFilter` |
| `analysisClassification` | A numeric value produced by an external AI analysis service | `filter: ListFilter`, `analysisType: AnalysisClassificationType` |

Available `analysisType` values: `"morningFasting"`, `"afternoonSnacking"`, `"caffeineIntake"`.

### analysisClassification data flow — two separate stores

`analysisClassification` is the only operation that does not compute its value on demand. Where the value comes from depends on the usage context:

**Used in `factRequests` (via `Fact.resolve`):**
`Fact.compute` returns `undefined` for this operation. The value must have been pre-seeded into the `FactCache` table by the Chart rendering pipeline (`Chart.ts` calls `Fact.writeCache` after getting results from the Assist service). If the cache entry is absent, the entire medal config is skipped for that disbursement pass.

**Used in `streakRequests` (via `Streak.resolveStreaks`):**
The streak engine bypasses `Fact.resolve` entirely and queries the `analysisClassificationResult` table directly, matching rows by `(userId, analysisType, segmentUnit, segmentKey)`. This table is populated by an external AI pipeline that POSTs to `/analysisClassificationResult` using `SYSTEM_API_KEY`. A missing row for any segment breaks the streak at that point.

These are **two different tables** (`FactCache` vs `analysisClassificationResult`) written by **two different producers** (Chart engine vs external pipeline). A value in one does not satisfy a lookup in the other.

## Cache

Every call to `Fact.resolve` checks the `FactCache` table before computing. The cache key is a **SHA256 hash of the canonical JSON** representation of the `FactContext` (object keys sorted alphabetically so key ordering never produces different hashes for logically identical contexts). `Fact.contextKey(context)` computes this key; it's pure and does not touch the DB.

`FactCache` rows are keyed by `(userId, contextKey)` — see the `@@unique([userId, contextKey])` constraint on the `FactCache` model in `prisma/schema.prisma`. A cache row is only ever a hit for the exact user who originally computed it.

TTLs by operation (defined in `src/models/FactCache.ts`):

| Operation | TTL |
|---|---|
| `entityCount` | 1 hour |
| `uniqueTagCount` | 1 hour |
| `medalCount` | 1 hour |
| `propertySum` | 1 hour |
| `analysisClassification` | 24 hours |

Cache errors (DB failures on read or write) are treated as misses — the system always falls back to a fresh computation rather than throwing. There is no special-casing of the computed value: a `0` or `false` result is cached for the full TTL exactly like any other value, and `bypassCache: true` (see Notes below) never writes to the cache, so it cannot be used to "refresh" a stale entry — only deletion does that.

### Streaks share this same cache — there is no separate streak cache

Streaks (`StreakConfig`) have no cache table of their own. `Streak.resolveContext` breaks a streak into lookback segments (one per day/week/etc., per `segmentUnit` and `length`) and, for every segment except `analysisClassification`, calls `Streak.injectDateRange` to scope the streak's `innerContext` to that segment's date range, then calls `Fact.resolve` on the result. Each segment therefore produces its own distinct `FactContext` (because the injected `start`/`end` differ) and lands as its own row in `FactCache`. A single streak with a 14-day lookback can have up to 14 separate cache rows, and which rows those are shifts every day as the lookback window rolls forward.

`analysisClassification` streaks are the exception: they bypass `Fact.resolve`/`FactCache` entirely and read the `analysisClassificationResult` table directly (see the section above), so there is nothing to cache or invalidate for them.

## Key Methods

| Method | Access | Description |
|---|---|---|
| `Fact.resolve(context, userId, options?)` | public | Primary entry point. Checks cache, computes on miss, writes result. |
| `Fact.contextKey(context)` | public | Returns the SHA256 cache key for a context without hitting the DB. |
| `Fact.fromCache(context, userId)` | public | Read-only probe — never computes. Returns `undefined` on miss. |
| `Fact.writeCache(context, userId, value)` | public | Seeds the cache directly (used by external analysis pipelines for `analysisClassification`). |
| `Fact.invalidate(contextKey, userId)` | public | Removes a single entry by pre-computed key. |
| `Fact.invalidateUser(userId)` | public | Clears all cache for a user. |
| `Fact.invalidateForConfig(factConfigId, userId)` | public | Looks up a saved fact (`FactConfig`), computes its contextKey, and removes that one entry. Returns an error if the config isn't found or isn't owned by `userId`. |
| `Fact.purgeExpired()` | public | Deletes all expired rows — intended for periodic housekeeping. |
| `Streak.invalidateForConfig(streakConfigId, userId, utcOffsetMinutes)` | public | Looks up a saved streak (`StreakConfig`), regenerates its *current* lookback segments the same way `resolveContext` does, computes each segment's contextKey, and bulk-deletes those `FactCache` rows. No-ops (returns `ok`) for `analysisClassification` streaks since they never write to `FactCache`. |

## HTTP Endpoints

Three endpoints expose cache invalidation, all scoped to the authenticated user (`introspect()`'s `userId` — there is no way to purge another user's cache):

| Endpoint | Route | Behavior |
|---|---|---|
| `factCache` (`src/functions/factCache.ts`) | `DELETE /factCache/{contextKey}` | Invalidates one entry by its raw, pre-computed contextKey hash. Low-level — the caller must already know the hash. |
| `factCache` (`src/functions/factCache.ts`) | `DELETE /factCache` | Clears **all** cache for the authenticated user (covers both fact and streak-segment rows, since they share the same table). |
| `factRequestCache` (`src/functions/factRequestCache.ts`) | `DELETE /factRequestCache/{id}` | Invalidates the cache for one saved fact by its `FactConfig` id — calls `Fact.invalidateForConfig`. Returns `404` if the id doesn't exist or isn't owned by the caller. |
| `streakRequestCache` (`src/functions/streakRequestCache.ts`) | `DELETE /streakRequestCache/{id}` | Invalidates all current segment cache rows for one saved streak by its `StreakConfig` id — calls `Streak.invalidateForConfig`, resolving `utcOffsetMinutes` from the user's `TIMEZONE` setting the same way `GET /streakRequest` does. Returns `404` if the id doesn't exist or isn't owned by the caller. |

Use `factRequestCache`/`streakRequestCache` when you know *which saved fact or streak* looks stale — they don't require computing a hash client-side. Use the raw `factCache/{contextKey}` route only when you already have a specific contextKey (e.g. from logs). Use `DELETE /factCache` to nuke everything for a user when in doubt.

## Notes

- `bypassCache: true` in `FactResolveOptions` forces recomputation and skips both the cache read and the cache write. The Streak engine passes this flag when it injects custom date ranges so that segment-scoped queries never pollute or hit the shared cache.
- `analysisClassification` contexts return `undefined` from `Fact.compute` intentionally. The value must already be in the cache before a medal evaluation referencing it can succeed. If it is absent, the medal config is skipped for that disbursement pass.

## Adding a new FactOperation

When adding a new `FactOperation`, update **all** of these locations or the system will silently break:

1. **`api-spec`** — add the operation to the `FactOperation` enum and define its `FactContext` shape.
2. **`src/models/FactCache.ts`** — add a TTL entry for the new operation in `FACT_TTL_MS`.
3. **`src/lib/Fact.ts` → `compute()`** — add a `case` to handle the computation.
4. **`src/lib/Chart.ts` → `applySegmentToContext()`** — add a `case` that returns the context with the segment's time range applied. **Omitting this causes `applySegmentToContext` to return `undefined`, which propagates to `Fact.resolve` and crashes with a crypto hash error (`ERR_INVALID_ARG_TYPE`) at runtime.** Filter-scoped operations (those with a `filter` field) should follow the `ENTITY_COUNT` / `PROPERTY_SUM` pattern; date-range-scoped operations (like `MEDAL_COUNT`) should apply `start`/`end` directly.
