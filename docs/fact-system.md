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

Every call to `Fact.resolve` checks the `FactCache` table before computing. The cache key is a **SHA256 hash of the canonical JSON** representation of the `FactContext` (object keys sorted alphabetically so key ordering never produces different hashes for logically identical contexts).

TTLs by operation (defined in `src/models/FactCache.ts`):

| Operation | TTL |
|---|---|
| `entityCount` | 1 hour |
| `uniqueTagCount` | 1 hour |
| `medalCount` | 1 hour |
| `propertySum` | 1 hour |
| `analysisClassification` | 24 hours |

Cache errors (DB failures on read or write) are treated as misses — the system always falls back to a fresh computation rather than throwing.

## Key Methods

| Method | Access | Description |
|---|---|---|
| `Fact.resolve(context, userId, options?)` | public | Primary entry point. Checks cache, computes on miss, writes result. |
| `Fact.contextKey(context)` | public | Returns the SHA256 cache key for a context without hitting the DB. |
| `Fact.fromCache(context, userId)` | public | Read-only probe — never computes. Returns `undefined` on miss. |
| `Fact.writeCache(context, userId, value)` | public | Seeds the cache directly (used by external analysis pipelines for `analysisClassification`). |
| `Fact.invalidate(contextKey, userId)` | public | Removes a single entry by pre-computed key. |
| `Fact.invalidateUser(userId)` | public | Clears all cache for a user. |
| `Fact.purgeExpired()` | public | Deletes all expired rows — intended for periodic housekeeping. |

## HTTP Endpoints

The `factCache` function (`src/functions/factCache.ts`) exposes cache management at the route `factCache/{contextKey?}`:

- `DELETE factCache/{contextKey}` — invalidates a specific entry
- `DELETE factCache` — clears all cache for the authenticated user

## Notes

- `bypassCache: true` in `FactResolveOptions` forces recomputation and skips both the cache read and the cache write. The Streak engine passes this flag when it injects custom date ranges so that segment-scoped queries never pollute or hit the shared cache.
- `analysisClassification` contexts return `undefined` from `Fact.compute` intentionally. The value must already be in the cache before a medal evaluation referencing it can succeed. If it is absent, the medal config is skipped for that disbursement pass.

## Adding a new FactOperation

When adding a new `FactOperation`, update **all** of these locations or the system will silently break:

1. **`api-spec`** — add the operation to the `FactOperation` enum and define its `FactContext` shape.
2. **`src/models/FactCache.ts`** — add a TTL entry for the new operation in `FACT_TTL_MS`.
3. **`src/lib/Fact.ts` → `compute()`** — add a `case` to handle the computation.
4. **`src/lib/Chart.ts` → `applySegmentToContext()`** — add a `case` that returns the context with the segment's time range applied. **Omitting this causes `applySegmentToContext` to return `undefined`, which propagates to `Fact.resolve` and crashes with a crypto hash error (`ERR_INVALID_ARG_TYPE`) at runtime.** Filter-scoped operations (those with a `filter` field) should follow the `ENTITY_COUNT` / `PROPERTY_SUM` pattern; date-range-scoped operations (like `MEDAL_COUNT`) should apply `start`/`end` directly.
