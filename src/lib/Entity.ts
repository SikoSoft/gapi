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
import {
  DataType,
  EntityConfig,
  EntityProperty,
  ImageDataValue,
} from "api-spec/models/Entity";

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
      await Entity.syncEntityProperties(entity.id, userId, data.properties);
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

  static async getDataTypesForProperties(
    properties: EntityProperty[]
  ): Promise<Result<Record<number, DataType>, Error>> {
    try {
      const propertyConfigIds = properties.map((p) => p.propertyConfigId);
      const propertyRows = await prisma.propertyConfig.findMany({
        where: { id: { in: propertyConfigIds } },
      });

      const dataTypes: Record<number, DataType> = {};
      propertyRows.forEach((p) => {
        dataTypes[p.id] = p.dataType as DataType;
      });

      return ok(dataTypes);
    } catch (error) {
      return err(error);
    }
  }

  static async syncEntityProperties(
    entityId: number,
    userId: string,
    properties: EntityProperty[]
  ): Promise<Result<null, Error>> {
    const dataTypesRes = await Entity.getDataTypesForProperties(properties);
    if (dataTypesRes.isErr()) {
      console.error(
        "Error getting data types for properties:",
        dataTypesRes.error
      );
      return;
    }
    const dataTypes = dataTypesRes.value;

    for (const property of properties) {
      switch (dataTypes[property.propertyConfigId]) {
        case DataType.BOOLEAN:
          await Entity.syncBooleanProperty(entityId, property);
          break;
        case DataType.INT:
          await Entity.syncIntProperty(entityId, property);
          break;
        case DataType.IMAGE:
          await Entity.syncImageProperty(entityId, property);
          break;
        case DataType.SHORT_TEXT:
          await Entity.syncShortTextProperty(entityId, property);
          break;
        case DataType.LONG_TEXT:
          await Entity.syncLongTextProperty(entityId, property);
          break;
        default:
          return err(
            new Error(
              `Unsupported data type for propertyConfigId ${property.propertyConfigId}`
            )
          );
      }
    }

    return ok(null);
  }

  static async syncBooleanProperty(
    entityId: number,
    property: EntityProperty
  ): Promise<Result<null, Error>> {
    console.log("Syncing boolean property:", { entityId, property });
    try {
      const value = property.value as boolean;

      if (!property.id) {
        const booleanPropertyValue = await prisma.booleanPropertyValue.create({
          data: {
            value,
          },
        });

        await prisma.entityBooleanProperty.create({
          data: {
            entityId,
            propertyValueId: booleanPropertyValue.id,
          },
        });

        return ok(null);
      }
    } catch (error) {
      console.error("Error syncing boolean property:", error);
      return err(error);
    }
  }

  static async syncIntProperty(
    entityId: number,
    property: EntityProperty
  ): Promise<Result<null, Error>> {
    try {
      const value = property.value as number;

      if (!property.id) {
        const intPropertyValue = await prisma.intPropertyValue.create({
          data: {
            value,
          },
        });

        await prisma.entityIntProperty.create({
          data: {
            entityId,
            propertyValueId: intPropertyValue.id,
          },
        });

        return ok(null);
      }
    } catch (error) {
      console.error("Error syncing int property:", error);
      return err(error);
    }
  }

  static async syncImageProperty(
    entityId: number,
    property: EntityProperty
  ): Promise<Result<null, Error>> {
    try {
      const value = property.value as ImageDataValue;

      if (!property.id) {
        const imagePropertyValue = await prisma.imagePropertyValue.create({
          data: {
            url: value.src,
            altText: value.alt,
          },
        });

        await prisma.entityImageProperty.create({
          data: {
            entityId,
            propertyValueId: imagePropertyValue.id,
          },
        });

        return ok(null);
      }
    } catch (error) {
      console.error("Error syncing image property:", error);
      return err(error);
    }
  }

  static async syncShortTextProperty(
    entityId: number,
    property: EntityProperty
  ): Promise<Result<null, Error>> {
    try {
      const value = property.value as string;

      if (!property.id) {
        const shortTextPropertyValue =
          await prisma.shortTextPropertyValue.create({
            data: {
              value,
            },
          });

        await prisma.entityShortTextProperty.create({
          data: {
            entityId,
            propertyValueId: shortTextPropertyValue.id,
          },
        });

        return ok(null);
      }
    } catch (error) {
      console.error("Error syncing boolean property:", error);
      return err(error);
    }
  }

  static async syncLongTextProperty(
    entityId: number,
    property: EntityProperty
  ): Promise<Result<null, Error>> {
    try {
      const value = property.value as string;

      if (!property.id) {
        const longTextPropertyValue = await prisma.longTextPropertyValue.create(
          {
            data: {
              value,
            },
          }
        );

        await prisma.entityLongTextProperty.create({
          data: {
            entityId,
            propertyValueId: longTextPropertyValue.id,
          },
        });

        return ok(null);
      }
    } catch (error) {
      console.error("Error syncing long text property:", error);
      return err(error);
    }
  }
}
