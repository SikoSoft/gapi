import { createHash } from "crypto";
import { Result, err, ok } from "neverthrow";
import { Fact as FactSpec, FactContext, FactOperation, FactResult } from "api-spec/models/Fact";
import { DataType, EntityPropertyCalculation } from "api-spec/models/Entity";
import { prisma } from "..";
import { FACT_TTL_MS, FactResolveOptions } from "../models/FactCache";
import { PrismaFactConfig } from "../models/Fact";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";
import { Logger } from "./Logger";

export type FactValue = string | number | boolean;

export class Fact {
  static mapToSpec(row: PrismaFactConfig): FactSpec {
    return {
      id: row.id,
      name: row.name,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      context: row.context as unknown as FactContext,
    };
  }

  static async list(userId: string): Promise<Result<FactSpec[], Error>> {
    try {
      const rows = await prisma.factConfig.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      return ok(rows.map(Fact.mapToSpec));
    } catch (e) {
      return err(new Error("Failed to list facts", { cause: e }));
    }
  }

  static async create(userId: string, name: string, context: FactContext): Promise<Result<FactSpec, Error>> {
    try {
      const row = await prisma.factConfig.create({
        data: { userId, name, context: context as object },
      });
      return ok(Fact.mapToSpec(row));
    } catch (e) {
      return err(new Error("Failed to create fact", { cause: e }));
    }
  }

  static async update(id: number, userId: string, name?: string, context?: FactContext): Promise<Result<FactSpec, Error>> {
    try {
      const row = await prisma.factConfig.findFirst({ where: { id, userId } });
      if (!row) {
        return err(new Error("Fact not found"));
      }
      const updated = await prisma.factConfig.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(context !== undefined && { context: context as object }),
        },
      });
      return ok(Fact.mapToSpec(updated));
    } catch (e) {
      return err(new Error("Failed to update fact", { cause: e }));
    }
  }

  static async resolveFacts(
    facts: FactSpec[],
    userId: string,
    bypassCache = false
  ): Promise<FactResult[]> {
    const results: FactResult[] = [];

    for (const fact of facts) {
      const ctx = fact.context;
      Logger.log(
        `[Fact] resolveFacts start id=${fact.id} op=${ctx.operation}`
      );

      const value = await Fact.resolve(ctx, userId, { bypassCache });

      Logger.log(
        `[Fact] resolveFacts id=${fact.id} COMPLETE value=${JSON.stringify(value)}`
      );
      results.push({ factId: fact.id, value });
    }

    return results;
  }

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
   * - PROPERTY_SUM: sum of the given propertyConfigId across filtered entities. For a standard
   *   int property this sums its IntPropertyValue rows directly; for a calculated property
   *   (one with a non-null `calculation`) there are no stored values, so each entity's value is
   *   derived in SQL via `sumCalculatedProperty` and the derived values are summed.
   * - ANALYSIS_CLASSIFICATION: always returns undefined — this operation's values come from an
   *   external AI pipeline and must be pre-seeded into FactCache via `writeCache` (Chart engine
   *   path) or queried from `analysisClassificationResult` directly (streak path). The `filter`
   *   field on an ANALYSIS_CLASSIFICATION context is only meaningful when Chart.ts passes entities
   *   to the Assist service; it is not applied in this compute path.
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
      case FactOperation.PROPERTY_SUM: {
        const builder = new EntityListQueryBuilder();
        builder.setUserId(userId);
        builder.setFilter(context.filter);
        const entityIds = await builder.runIdsQuery();
        Logger.log(`[Fact] compute PROPERTY_SUM userId=${userId} propertyConfigId=${context.propertyConfigId} entityIds.length=${entityIds.length}`);
        if (entityIds.length === 0) {
          Logger.log(`[Fact] compute PROPERTY_SUM userId=${userId} propertyConfigId=${context.propertyConfigId} result=0 (no entities)`);
          return 0;
        }

        const propertyConfig = await prisma.propertyConfig.findUnique({
          where: { id: context.propertyConfigId },
          select: { calculation: true },
        });

        if (propertyConfig?.calculation) {
          const sum = await Fact.sumCalculatedProperty(
            propertyConfig.calculation as EntityPropertyCalculation,
            entityIds
          );
          Logger.log(`[Fact] compute PROPERTY_SUM userId=${userId} propertyConfigId=${context.propertyConfigId} result=${sum} (calculated)`);
          return sum;
        }

        const agg = await prisma.intPropertyValue.aggregate({
          _sum: { value: true },
          where: {
            entityPropertyValue: {
              entityId: { in: entityIds },
              propertyConfigId: context.propertyConfigId,
            },
          },
        });
        const sum = agg._sum.value ?? 0;
        Logger.log(`[Fact] compute PROPERTY_SUM userId=${userId} propertyConfigId=${context.propertyConfigId} result=${sum}`);
        return sum;
      }
      case FactOperation.ANALYSIS_CLASSIFICATION:
        Logger.log(`[Fact] compute ANALYSIS_CLASSIFICATION userId=${userId} — skipped (handled externally)`);
        return undefined;

      default: {
        const exhaustive: never = context;
        Logger.error(
          `[Fact] Unknown operation: ${
            (exhaustive as FactContext).operation
          }`
        );
        return undefined;
      }
    }
  }

  /**
   * Sums the derived value of a calculated property (one whose value is computed from
   * other properties via `PropertyConfig.calculation`, not stored in a per-type value table)
   * across the given entities. Resolves each operand's data type so the right value table is
   * joined, then sums the per-entity calculation result in SQL.
   */
  private static async sumCalculatedProperty(
    calc: EntityPropertyCalculation,
    entityIds: number[]
  ): Promise<number> {
    const refIds: number[] = [];
    if (typeof calc.value1 === "object" && "propertyConfigId" in calc.value1) {
      refIds.push(calc.value1.propertyConfigId);
    }
    if (typeof calc.value2 === "object" && "propertyConfigId" in calc.value2) {
      refIds.push(calc.value2.propertyConfigId);
    }

    const sourceConfigs =
      refIds.length > 0
        ? await prisma.propertyConfig.findMany({
            where: { id: { in: refIds } },
            select: { id: true, dataType: true },
          })
        : [];
    const dataTypeMap = new Map(
      sourceConfigs.map((c) => [c.id, c.dataType as DataType])
    );

    const value1DataType =
      typeof calc.value1 === "object" && "propertyConfigId" in calc.value1
        ? (dataTypeMap.get(calc.value1.propertyConfigId) ?? null)
        : null;
    const value2DataType =
      typeof calc.value2 === "object" && "propertyConfigId" in calc.value2
        ? (dataTypeMap.get(calc.value2.propertyConfigId) ?? null)
        : null;

    const v1Expr = EntityListQueryBuilder.getCalcOperandExpr(calc.value1, value1DataType);
    const v2Expr =
      calc.operation === "/"
        ? `NULLIF(${EntityListQueryBuilder.getCalcOperandExpr(calc.value2, value2DataType)}, 0)`
        : EntityListQueryBuilder.getCalcOperandExpr(calc.value2, value2DataType);

    const rows = await prisma.$queryRawUnsafe<{ sum: number | null }[]>(
      `SELECT COALESCE(SUM(${v1Expr} ${calc.operation} ${v2Expr}), 0) AS "sum" FROM "Entity" e WHERE e."id" = ANY($1::int[])`,
      entityIds
    );

    return Number(rows[0]?.sum ?? 0);
  }
}
