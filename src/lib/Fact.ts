import { createHash } from "crypto";
import { Result, err, ok } from "neverthrow";
import { FactContext, FactOperation } from "api-spec/models/Fact";
import { FactRequest } from "api-spec/models/Medal";
import { prisma } from "..";
import { FACT_TTL_MS, FactResolveOptions } from "../models/FactCache";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";
import { Logger } from "./Logger";

export type FactValue = string | number | boolean;

export class Fact {
  /**
   * Primary entry point for obtaining a fact value. Returns a cached result when
   * available and unexpired; otherwise computes from source data and writes to cache.
   * Pass `bypassCache: true` in options to always recompute (used by streak evaluation
   * which injects custom date ranges that must not be served from the generic cache).
   */
  static async resolve(
    context: FactContext,
    userId: string,
    options: FactResolveOptions = {}
  ): Promise<FactValue | undefined> {
    const contextKey = Fact.contextKey(context);
    Logger.log(`[Fact] resolve op=${context.operation} userId=${userId} key=${contextKey} bypassCache=${!!options.bypassCache}`);

    if (!options.bypassCache) {
      const cached = await Fact.getCached(context, userId, contextKey);
      if (cached !== undefined) {
        Logger.log(`[Fact] cache HIT op=${context.operation} userId=${userId} key=${contextKey} value=${JSON.stringify(cached)}`);
        return cached;
      }
      Logger.log(`[Fact] cache MISS op=${context.operation} userId=${userId} key=${contextKey}`);
    }

    Logger.log(`[Fact] computing op=${context.operation} userId=${userId} key=${contextKey}`);
    const value = await Fact.compute(context, userId);
    Logger.log(`[Fact] computed op=${context.operation} userId=${userId} key=${contextKey} value=${JSON.stringify(value)}`);

    if (value !== undefined && !options.bypassCache) {
      await Fact.setCached(context, userId, value, contextKey);
    }

    return value;
  }

  /**
   * Produces a stable SHA256 cache key for a FactContext by serializing it to
   * canonical JSON (keys sorted alphabetically, array order preserved), then hashing.
   * Two contexts that are logically identical but differ only in key order produce
   * the same key.
   */
  static contextKey(context: FactContext): string {
    const canonical = JSON.stringify(context, (_key, value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b)
          )
        );
      }
      return value;
    });
    const hash = createHash("sha256").update(canonical).digest("hex");
    Logger.log(`[Fact] contextKey op=${context.operation} canonical=${canonical} hash=${hash}`);
    return hash;
  }

  /** Removes a single cache entry by its pre-computed context key. */
  static async invalidate(
    contextKey: string,
    userId: string
  ): Promise<Result<void, Error>> {
    try {
      await prisma.factCache.deleteMany({ where: { userId, contextKey } });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to invalidate fact cache entry", { cause: error }));
    }
  }

  /** Clears every cache entry for a user — useful after bulk data changes. */
  static async invalidateUser(userId: string): Promise<Result<void, Error>> {
    try {
      await prisma.factCache.deleteMany({ where: { userId } });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to invalidate user fact cache", { cause: error }));
    }
  }

  /** Deletes all expired cache rows. Intended for periodic housekeeping. */
  static async purgeExpired(): Promise<Result<void, Error>> {
    try {
      await prisma.factCache.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to purge expired fact cache entries", { cause: error }));
    }
  }

  /**
   * Read-only cache probe — returns the cached value if present and unexpired,
   * otherwise undefined. Never computes or writes. Used when callers only want
   * to know if a value is already warmed without triggering a recompute.
   */
  static async fromCache(
    context: FactContext,
    userId: string
  ): Promise<FactValue | undefined> {
    const contextKey = Fact.contextKey(context);
    Logger.log(`[Fact] fromCache op=${context.operation} userId=${userId} key=${contextKey}`);
    const result = await Fact.getCached(context, userId, contextKey);
    Logger.log(`[Fact] fromCache result op=${context.operation} userId=${userId} key=${contextKey} hit=${result !== undefined} value=${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Directly writes a value into the cache without going through `resolve`.
   * Used when a value has been computed externally (e.g. by an analysis pipeline)
   * and needs to be seeded for subsequent fact lookups.
   */
  static async writeCache(
    context: FactContext,
    userId: string,
    value: FactValue
  ): Promise<void> {
    const contextKey = Fact.contextKey(context);
    Logger.log(`[Fact] writeCache op=${context.operation} userId=${userId} key=${contextKey} value=${JSON.stringify(value)}`);
    return Fact.setCached(context, userId, value, contextKey);
  }

  /**
   * Looks up the FactCache table by (userId, contextKey) and validates the TTL.
   * Returns undefined on miss, expiry, or any DB error (fail-open: callers recompute).
   */
  private static async getCached(
    context: FactContext,
    userId: string,
    precomputedKey?: string
  ): Promise<FactValue | undefined> {
    const contextKey = precomputedKey ?? Fact.contextKey(context);
    Logger.log(`[Fact] getCached DB lookup op=${context.operation} userId=${userId} key=${contextKey}`);
    try {
      const entry = await prisma.factCache.findUnique({
        where: {
          userId_contextKey: { userId, contextKey },
        },
      });
      if (!entry) {
        Logger.log(`[Fact] getCached no entry found op=${context.operation} userId=${userId} key=${contextKey}`);
        return undefined;
      }
      const now = new Date();
      if (entry.expiresAt < now) {
        Logger.log(`[Fact] getCached entry EXPIRED op=${context.operation} userId=${userId} key=${contextKey} expiresAt=${entry.expiresAt.toISOString()} now=${now.toISOString()}`);
        return undefined;
      }
      Logger.log(`[Fact] getCached entry valid op=${context.operation} userId=${userId} key=${contextKey} expiresAt=${entry.expiresAt.toISOString()} rawValue=${entry.value}`);
      return JSON.parse(entry.value) as FactValue;
    } catch (error) {
      Logger.error(`[Fact] getCached threw op=${context.operation} userId=${userId} key=${contextKey}`, { error });
      return undefined;
    }
  }

  /**
   * Upserts a cache entry with a TTL derived from `FACT_TTL_MS[operation]`.
   * Errors are swallowed so a cache write failure never breaks the calling resolve.
   */
  private static async setCached(
    context: FactContext,
    userId: string,
    value: FactValue,
    precomputedKey?: string
  ): Promise<void> {
    const contextKey = precomputedKey ?? Fact.contextKey(context);
    try {
      const ttl = FACT_TTL_MS[context.operation];
      const expiresAt = new Date(Date.now() + ttl);
      Logger.log(`[Fact] setCached op=${context.operation} userId=${userId} key=${contextKey} value=${JSON.stringify(value)} ttlMs=${ttl} expiresAt=${expiresAt.toISOString()}`);
      await prisma.factCache.upsert({
        where: { userId_contextKey: { userId, contextKey } },
        create: { userId, contextKey, value: JSON.stringify(value), expiresAt },
        update: { value: JSON.stringify(value), expiresAt },
      });
      Logger.log(`[Fact] setCached upsert OK op=${context.operation} userId=${userId} key=${contextKey}`);
    } catch (error) {
      Logger.error(`[Fact] setCached failed op=${context.operation} userId=${userId} key=${contextKey}`, { error });
    }
  }

  /**
   * Executes the operation described by `context` against live data:
   * - ENTITY_COUNT: filtered count via EntityListQueryBuilder
   * - UNIQUE_TAG_COUNT: distinct tag labels across filtered entities
   * - MEDAL_COUNT: awarded medal count with optional date range
   * - ANALYSIS_CLASSIFICATION: not computed here; returns undefined (pre-seeded via writeCache)
   */
  private static async compute(
    context: FactContext,
    userId: string
  ): Promise<FactValue | undefined> {
    Logger.log(`[Fact] compute start op=${context.operation} userId=${userId} context=${JSON.stringify(context)}`);
    switch (context.operation) {
      case FactOperation.ENTITY_COUNT: {
        const builder = new EntityListQueryBuilder();
        builder.setUserId(userId);
        builder.setFilter(context.filter);
        const count = await builder.runCountQuery();
        Logger.log(`[Fact] compute ENTITY_COUNT userId=${userId} result=${count}`);
        return count;
      }
      case FactOperation.UNIQUE_TAG_COUNT: {
        const builder = new EntityListQueryBuilder();
        builder.setUserId(userId);
        builder.setFilter(context.filter);
        const entityIds = await builder.runIdsQuery();
        Logger.log(`[Fact] compute UNIQUE_TAG_COUNT userId=${userId} entityIds.length=${entityIds.length}`);
        const tags = await prisma.entityTag.findMany({
          where: { entityId: { in: entityIds } },
          select: { label: true },
          distinct: ["label"],
        });
        Logger.log(`[Fact] compute UNIQUE_TAG_COUNT userId=${userId} result=${tags.length}`);
        return tags.length;
      }
      case FactOperation.MEDAL_COUNT: {
        const count = await prisma.medal.count({
          where: {
            userId,
            medalConfigId: context.medalConfigId,
            medalConfig: { series: context.series },
            ...(context.start && context.end
              ? {
                  awardedAt: {
                    gte: new Date(context.start),
                    lte: new Date(context.end),
                  },
                }
              : {}),
          },
        });
        Logger.log(`[Fact] compute MEDAL_COUNT userId=${userId} medalConfigId=${context.medalConfigId} series=${context.series} result=${count}`);
        return count;
      }
      case FactOperation.ANALYSIS_CLASSIFICATION:
        Logger.log(`[Fact] compute ANALYSIS_CLASSIFICATION userId=${userId} — skipped (handled externally)`);
        return undefined;

      default: {
        const exhaustive: never = context;
        Logger.error(
          `[Fact] Unknown operation: ${
            (exhaustive as FactRequest["context"]).operation
          }`
        );
        return undefined;
      }
    }
  }
}
