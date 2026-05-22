import { FactOperation, FactRequest } from "api-spec/models/Medal";
import { prisma } from "..";
import { Entity } from "./Entity";
import { Logger } from "./Logger";

export type FactValue = string | number | boolean;

export class Fact {
  static async resolve(
    request: FactRequest,
    userId: string
  ): Promise<FactValue | undefined> {
    const { context } = request;
    switch (context.operation) {
      case FactOperation.ENTITY_COUNT: {
        const where = Entity.getFilteredConditions(userId, context.filter);
        return prisma.entity.count({ where });
      }
      case FactOperation.UNIQUE_TAG_COUNT: {
        const entityWhere = Entity.getFilteredConditions(userId, context.filter);
        const tags = await prisma.entityTag.findMany({
          where: { entity: entityWhere },
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
          },
        });
      }
      default: {
        const exhaustive: never = context;
        Logger.error(
          `[Fact] Unknown operation: ${(exhaustive as FactRequest["context"]).operation}`
        );
        return undefined;
      }
    }
  }
}
