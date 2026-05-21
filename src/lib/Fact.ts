import { ListFilter } from "api-spec/models/List";
import { prisma } from "..";
import { Entity } from "./Entity";
import { Logger } from "./Logger";

export type FactValue = string | number | boolean;
export type FactHandler = (
  userId: string,
  params?: Record<string, unknown>
) => Promise<FactValue>;

const registry = new Map<string, FactHandler>();

export class Fact {
  static register(alias: string, handler: FactHandler): void {
    registry.set(alias, handler);
  }

  static async resolve(
    alias: string,
    userId: string,
    params?: Record<string, unknown>
  ): Promise<FactValue | undefined> {
    const handler = registry.get(alias);
    if (!handler) {
      Logger.error(`[Fact] No handler registered for alias: ${alias}`);
      return undefined;
    }
    return handler(userId, params);
  }
}

// Count of all entities belonging to a user, with optional full ListFilter scoping.
// Pass params.filter (ListFilter) to scope the count to a specific subset of entities.
Fact.register("entityCount", async (userId, params) => {
  const filter = params?.filter as ListFilter | undefined;
  if (filter) {
    const where = Entity.getFilteredConditions(userId, filter);
    return prisma.entity.count({ where });
  }
  return prisma.entity.count({ where: { userId } });
});

// Shorthand count of entities belonging to a user scoped to a specific entityConfigId.
// Requires params.entityConfigId (number).
Fact.register("entityCountByConfig", async (userId, params) => {
  const entityConfigId = params?.entityConfigId as number | undefined;
  if (entityConfigId === undefined) {
    Logger.error("[Fact] entityCountByConfig requires params.entityConfigId");
    return 0;
  }
  return prisma.entity.count({ where: { userId, entityConfigId } });
});

// Count of medals earned by a user.
// Optional params: medalConfigId (number) to scope to a specific medal,
// or series (string) to scope to all medals in a series.
Fact.register("medalCount", async (userId, params) => {
  const medalConfigId = params?.medalConfigId as number | undefined;
  const series = params?.series as string | undefined;
  return prisma.medal.count({
    where: {
      userId,
      ...(medalConfigId !== undefined ? { medalConfigId } : {}),
      ...(series !== undefined ? { medalConfig: { series } } : {}),
    },
  });
});

// Count of distinct tag labels applied across all of a user's entities.
Fact.register("uniqueTagCount", async (userId) => {
  const tags = await prisma.entityTag.findMany({
    where: { entity: { userId } },
    select: { label: true },
    distinct: ["label"],
  });
  return tags.length;
});
