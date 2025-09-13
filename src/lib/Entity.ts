import { Result, err, ok } from "neverthrow";
import { Prisma } from "@prisma/client";
import {
  ListContext,
  ListContextType,
  ListContextUnit,
  ListFilter,
  ListFilterTimeType,
  ListSort,
} from "api-spec/models/List";
import { prisma } from "..";
import { Tagging } from "./Tagging";
import {
  PrismaEntity,
  EntityBodyPayload,
  EntityList,
  EntityListParams,
  ContextEntities,
  EntityItem,
} from "../models/Entity";
import { EntityConfig } from "api-spec/models/Entity";

export class Entity {
  static getFilteredConditions(userId: string, filter: ListFilter) {
    let startTime: Date;
    let endTime: Date;
    if (filter.time.type === ListFilterTimeType.EXACT_DATE) {
      startTime = new Date(filter.time.date);
      endTime = new Date(startTime.getTime() + 86400000);
    }
    if (filter.time.type === ListFilterTimeType.RANGE) {
      startTime = new Date(filter.time.start);
      endTime = new Date(new Date(filter.time.end).getTime() + 86400000);
    }

    return Prisma.validator(
      prisma,
      "entity",
      "findMany",
      "where"
    )({
      userId,
      ...(!filter.includeAll
        ? {
            AND: [
              {
                ...(filter.time.type === ListFilterTimeType.ALL_TIME
                  ? { createdAt: { lte: new Date() } }
                  : {
                      AND: [
                        { createdAt: { gte: startTime } },
                        { createdAt: { lte: endTime } },
                      ],
                    }),
              },
              {
                ...(filter.includeAllTagging
                  ? {}
                  : {
                      OR: [
                        {
                          ...(filter.includeUntagged
                            ? { tags: { none: {} } }
                            : {}),
                        },
                        {
                          AND: [
                            {
                              ...(filter.tagging.containsOneOf.length
                                ? {
                                    OR: [
                                      ...filter.tagging.containsOneOf.map(
                                        (tag) => ({
                                          tags: { some: { label: tag } },
                                        })
                                      ),
                                    ],
                                  }
                                : {}),
                            },
                            {
                              ...(filter.tagging.containsAllOf
                                ? {
                                    AND: [
                                      ...filter.tagging.containsAllOf.map(
                                        (tag) => ({
                                          tags: { some: { label: tag } },
                                        })
                                      ),
                                    ],
                                  }
                                : {}),
                            },
                          ],
                        },
                      ],
                    }),
              },
            ],
          }
        : {}),
    });
  }

  static async create(
    userId: string,
    data: EntityBodyPayload
  ): Promise<Result<EntityItem, Error>> {
    try {
      const entity = await prisma.entity.create({
        data: {
          userId,
        },
        include: {
          tags: true,
        },
      });
      Tagging.syncEntityTags(entity.id, data.tags);
      return ok(Entity.toSpec(entity));
    } catch (error) {
      return err(error);
    }
  }

  static async update(
    userId: string,
    id: number,
    data: EntityBodyPayload
  ): Promise<Result<EntityItem, Error>> {
    const timeZone = parseInt(data.timeZone);
    const serverTimeZone = new Date().getTimezoneOffset();

    try {
      Tagging.syncEntityTags(id, data.tags);
      const entityRes = await Entity.getEntity(id);
      if (entityRes.isErr()) {
        return err(entityRes.error);
      }

      return ok(entityRes.value);
    } catch (error) {
      return err(error);
    }
  }

  static async getEntity(id: number): Promise<Result<EntityItem, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id },
        include: { tags: true },
      });
      if (!entity) {
        return err(new Error("Entity not found"));
      }
      return ok(Entity.toSpec(entity));
    } catch (error) {
      return err(error);
    }
  }

  static toSpec(entity: PrismaEntity): EntityItem {
    return {
      ...entity,
      tags: entity.tags.map((tag) => tag.label),
    };
  }

  static async getList({
    userId,
    filter,
    context,
    sort,
    start,
    perPage,
  }: EntityListParams): Promise<Result<EntityList, Error>> {
    const where = Entity.getFilteredConditions(userId, filter);

    let entities: EntityItem[];

    try {
      entities = (
        await prisma.entity.findMany({
          skip: start,
          take: perPage,
          where,
          orderBy: {
            [sort.property]: sort.direction,
          },
          include: {
            tags: true,
          },
        })
      ).map((entity) => Entity.toSpec(entity));

      const contextEntitiesRes = await Entity.getContextEntities(
        context,
        entities,
        sort
      );

      if (contextEntitiesRes.isErr()) {
        return err(contextEntitiesRes.error);
      }

      const total = await prisma.entity.count({ where });

      return ok({
        entities,
        context: contextEntitiesRes.value,
        total,
      });
    } catch (error) {
      return err(error);
    }
  }

  static async delete(
    userId: string,
    id: number
  ): Promise<Result<EntityItem, Error>> {
    try {
      const entity = await prisma.entity.delete({
        where: {
          userId,
          id,
        },
        include: {
          tags: true,
        },
      });
      return ok(Entity.toSpec(entity));
    } catch (error) {
      return err(error);
    }
  }

  static async getContextEntities(
    listContext: ListContext,
    entities: EntityItem[],
    sort: ListSort
  ): Promise<Result<ContextEntities, Error>> {
    let contextEntities: ContextEntities = {};

    if (listContext) {
      for (let i = 0; i < entities.length; i++) {
        let startTime: Date, endTime: Date;
        if (listContext.type === ListContextType.BEFORE) {
          endTime = new Date(entities[i].createdAt.getTime() - 1);
          startTime = new Date(
            endTime.getTime() -
              Entity.secondsFromQuantityUnits(
                listContext.quantity,
                listContext.unit
              )
          );
        } else if (listContext.type === ListContextType.AFTER) {
          startTime = new Date(entities[i].createdAt.getTime() + 1);
          endTime = new Date(
            startTime.getTime() +
              Entity.secondsFromQuantityUnits(
                listContext.quantity,
                listContext.unit
              )
          );
        }

        try {
          const entityContext = await prisma.entity.findMany({
            where: {
              AND: [
                { createdAt: { gte: startTime } },
                { createdAt: { lte: endTime } },
              ],
            },
            orderBy: {
              [sort.property]: sort.direction,
            },
            include: {
              tags: true,
            },
          });

          contextEntities[entities[i].id] = entityContext;
        } catch (error) {
          return err(error);
        }
      }
    }

    return ok(contextEntities);
  }

  static secondsFromQuantityUnits(
    quantity: number,
    unit: ListContextUnit
  ): number {
    switch (unit) {
      case ListContextUnit.MINUTE:
        return quantity * 60000;
      case ListContextUnit.HOUR:
        return quantity * 3600000;
      case ListContextUnit.DAY:
        return quantity * 86400000;
    }
  }

  static async getSuggestions(
    userId: string,
    desc: string
  ): Promise<Result<string[], Error>> {
    try {
      const entities = await prisma.entity.findMany({
        take: 10,
        where: {
          userId,
        },
      });
      const suggestions = entities.map((e) => String(e.id));
      return ok(suggestions);
    } catch (error) {
      return err(error);
    }
  }
}
