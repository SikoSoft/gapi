import { FactOperation, FactRequest } from "api-spec/models/Medal";
import { prisma } from "..";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";
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
