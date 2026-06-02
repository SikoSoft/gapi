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
  static async resolve(
    context: FactContext,
    userId: string,
    options: FactResolveOptions = {}
  ): Promise<FactValue | undefined> {
    if (!options.bypassCache) {
      const cached = await Fact.getCached(context, userId);
      if (cached !== undefined) {
        return cached;
      }
    }

    const value = await Fact.compute(context, userId);

    if (value !== undefined && !options.bypassCache) {
      await Fact.setCached(context, userId, value);
    }

    return value;
  }

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
    return createHash("sha256").update(canonical).digest("hex");
  }

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

  static async invalidateUser(userId: string): Promise<Result<void, Error>> {
    try {
      await prisma.factCache.deleteMany({ where: { userId } });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to invalidate user fact cache", { cause: error }));
    }
  }

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

  static async fromCache(
    context: FactContext,
    userId: string
  ): Promise<FactValue | undefined> {
    return Fact.getCached(context, userId);
  }

  static async writeCache(
    context: FactContext,
    userId: string,
    value: FactValue
  ): Promise<void> {
    return Fact.setCached(context, userId, value);
  }

  private static async getCached(
    context: FactContext,
    userId: string
  ): Promise<FactValue | undefined> {
    try {
      const entry = await prisma.factCache.findUnique({
        where: {
          userId_contextKey: { userId, contextKey: Fact.contextKey(context) },
        },
      });
      if (!entry || entry.expiresAt < new Date()) {
        return undefined;
      }
      return JSON.parse(entry.value) as FactValue;
    } catch {
      return undefined;
    }
  }

  private static async setCached(
    context: FactContext,
    userId: string,
    value: FactValue
  ): Promise<void> {
    try {
      const ttl = FACT_TTL_MS[context.operation];
      const expiresAt = new Date(Date.now() + ttl);
      const contextKey = Fact.contextKey(context);
      await prisma.factCache.upsert({
        where: { userId_contextKey: { userId, contextKey } },
        create: { userId, contextKey, value: JSON.stringify(value), expiresAt },
        update: { value: JSON.stringify(value), expiresAt },
      });
    } catch (error) {
      Logger.error("[Fact] Failed to write cache entry", { error });
    }
  }

  private static async compute(
    context: FactContext,
    userId: string
  ): Promise<FactValue | undefined> {
    switch (context.operation) {
      case FactOperation.ENTITY_COUNT: {
        const builder = new EntityListQueryBuilder();
        builder.setUserId(userId);
        builder.setFilter(context.filter);
        return builder.runCountQuery();
      }
      case FactOperation.UNIQUE_TAG_COUNT: {
        const builder = new EntityListQueryBuilder();
        builder.setUserId(userId);
        builder.setFilter(context.filter);
        const entityIds = await builder.runIdsQuery();
        const tags = await prisma.entityTag.findMany({
          where: { entityId: { in: entityIds } },
          select: { label: true },
          distinct: ["label"],
        });
        return tags.length;
      }
      case FactOperation.MEDAL_COUNT: {
        return prisma.medal.count({
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
      }
      case FactOperation.ANALYSIS_CLASSIFICATION:
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
