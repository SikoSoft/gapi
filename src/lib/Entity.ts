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
} from "../models/Entity";
import {
  DataType,
  EntityProperty,
  ImageDataValue,
} from "api-spec/models/Entity";
import { Entity as EntitySpec } from "api-spec/models";
import { Util } from "./Util";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";

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
                ...(filter.includeTypes.length
                  ? { entityConfigId: { in: filter.includeTypes } }
                  : {}),
              },
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
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const entity = await prisma.entity.create({
        data: {
          userId,
          entityConfigId: data.entityConfigId,
        },
      });

      Tagging.syncEntityTags(entity.id, data.tags);
      await Entity.syncEntityProperties(
        entity.id,
        data.properties,
        parseInt(data.timeZone)
      );

      const entityRes = await Entity.getEntity(entity.id);
      if (entityRes.isErr()) {
        return err(entityRes.error);
      }
      return ok(entityRes.value);
    } catch (error) {
      return err(error);
    }
  }

  static async update(
    userId: string,
    id: number,
    data: EntityBodyPayload
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      Tagging.syncEntityTags(id, data.tags);

      await Entity.syncEntityProperties(
        id,
        data.properties,
        parseInt(data.timeZone)
      );

      const entityRes = await Entity.getEntity(id);
      if (entityRes.isErr()) {
        return err(entityRes.error);
      }
      return ok(entityRes.value);
    } catch (error) {
      return err(error);
    }
  }

  static async getEntity(
    id: number
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id },
        include: {
          tags: true,
          booleanProperties: {
            include: {
              propertyValue: true,
            },
          },
          dateProperties: {
            include: {
              propertyValue: true,
            },
          },
          imageProperties: {
            include: {
              propertyValue: true,
            },
          },
          intProperties: {
            include: {
              propertyValue: true,
            },
          },

          longTextProperties: {
            include: {
              propertyValue: true,
            },
          },
          shortTextProperties: {
            include: {
              propertyValue: true,
            },
          },
        },
      });

      if (!entity) {
        return err(new Error("Entity not found"));
      }
      return ok(Entity.toSpec(entity));
    } catch (error) {
      return err(error);
    }
  }

  static booleanPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.booleanProperties) {
      entity.booleanProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : false,
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static datePropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.dateProperties) {
      entity.dateProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : new Date(),
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static intPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.intProperties) {
      entity.intProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : 0,
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static imagePropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.imageProperties) {
      console.log(
        "Mapping image properties:",
        JSON.stringify(entity.imageProperties, null, 2)
      );

      entity.imageProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue
            ? { src: prop.propertyValue.url, alt: prop.propertyValue.altText }
            : { src: "", alt: "" },
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static shortTextPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.shortTextProperties) {
      entity.shortTextProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : "",
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static longTextPropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.longTextProperties) {
      entity.longTextProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : null,
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static toSpec(entity: PrismaEntity): EntitySpec.Entity {
    //console.log("Entity to spec:", entity);

    const properties: EntitySpec.EntityProperty[] = [
      ...Entity.booleanPropertiesToSpec(entity),
      ...Entity.datePropertiesToSpec(entity),
      ...Entity.imagePropertiesToSpec(entity),
      ...Entity.intPropertiesToSpec(entity),
      ...Entity.longTextPropertiesToSpec(entity),
      ...Entity.shortTextPropertiesToSpec(entity),
    ].sort((a, b) => a.order - b.order);

    return {
      id: entity.id,
      type: entity.entityConfigId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      properties,
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

    let entities: EntitySpec.Entity[];

    /*
    const rawEntities = await prisma.$queryRaw`
  SELECT e.*, ipv."value" AS int_value
  FROM "Entity" e, "EntityIntProperty" ip, "IntPropertyValue" ipv
  WHERE ip."entityId" = e."id"
  AND ipv."id" = ip."propertyValueId"
`;
*/

    const listQuery = new EntityListQueryBuilder();
    listQuery.setUserId(userId);
    listQuery.setFilter(filter);
    listQuery.setSort(sort);
    listQuery.setPagination(start, perPage);

    console.log("query", listQuery.getQuery());
    const rawEntities = await prisma.$queryRaw(
      Prisma.sql([listQuery.getQuery()])
    );

    console.log("Raw entities:", JSON.stringify(rawEntities, null, 2));

    try {
      entities = (
        await prisma.entity.findMany({
          relationLoadStrategy: "join",
          skip: start,
          take: perPage,
          where,
          orderBy: {
            [sort.property]: sort.direction,
          },
          include: {
            tags: true,
            booleanProperties: {
              include: { propertyValue: true },
            },
            dateProperties: {
              include: { propertyValue: true },
            },
            imageProperties: {
              include: { propertyValue: true },
            },
            intProperties: {
              include: { propertyValue: true },
            },
            longTextProperties: {
              include: { propertyValue: true },
            },
            shortTextProperties: {
              include: { propertyValue: true },
            },
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

  static async export(
    userId: string,
    entityConfigIds: number[]
  ): Promise<Result<EntitySpec.Entity[], Error>> {
    let entities: EntitySpec.Entity[];

    try {
      entities = (
        await prisma.entity.findMany({
          where: { userId, entityConfigId: { in: entityConfigIds } },
          include: {
            tags: true,
            booleanProperties: {
              include: { propertyValue: true },
            },
            dateProperties: {
              include: { propertyValue: true },
            },
            imageProperties: {
              include: { propertyValue: true },
            },
            intProperties: {
              include: { propertyValue: true },
            },
            longTextProperties: {
              include: { propertyValue: true },
            },
            shortTextProperties: {
              include: { propertyValue: true },
            },
          },
        })
      ).map((entity) => Entity.toSpec(entity));
      return ok(entities);
    } catch (error) {
      return err(error);
    }
  }

  static async delete(
    userId: string,
    id: number
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const entity = await prisma.entity.delete({
        where: {
          userId,
          id,
        },
        include: {
          tags: true,
          booleanProperties: {
            include: { propertyValue: true },
          },
          dateProperties: {
            include: { propertyValue: true },
          },
          imageProperties: {
            include: { propertyValue: true },
          },
          intProperties: {
            include: { propertyValue: true },
          },
          longTextProperties: {
            include: { propertyValue: true },
          },
          shortTextProperties: {
            include: { propertyValue: true },
          },
        },
      });
      return ok(Entity.toSpec(entity));
    } catch (error) {
      return err(error);
    }
  }

  static async getContextEntities(
    listContext: ListContext,
    entities: EntitySpec.Entity[],
    sort: ListSort
  ): Promise<Result<ContextEntities, Error>> {
    let contextEntities: ContextEntities = {};

    if (listContext) {
      for (let i = 0; i < entities.length; i++) {
        let startTime: Date, endTime: Date;
        if (listContext.type === ListContextType.BEFORE) {
          endTime = new Date(new Date(entities[i].createdAt).getTime() - 1);
          startTime = new Date(
            endTime.getTime() -
              Entity.secondsFromQuantityUnits(
                listContext.quantity,
                listContext.unit
              )
          );
        } else if (listContext.type === ListContextType.AFTER) {
          startTime = new Date(new Date(entities[i].createdAt).getTime() + 1);
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
              booleanProperties: {
                include: { propertyValue: true },
              },
              dateProperties: {
                include: { propertyValue: true },
              },
              imageProperties: {
                include: { propertyValue: true },
              },
              intProperties: {
                include: { propertyValue: true },
              },
              longTextProperties: {
                include: { propertyValue: true },
              },
              shortTextProperties: {
                include: { propertyValue: true },
              },
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
    properties: EntityProperty[],
    timeZone: number
  ): Promise<Result<null, Error>> {
    console.log("Syncing entity properties:", { entityId, properties });
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
        case DataType.DATE:
          property.value =
            property.value === null
              ? null
              : Util.getDateInTimeZone(property.value as string, timeZone);
          await Entity.syncDateProperty(entityId, property);
          break;
        case DataType.IMAGE:
          await Entity.syncImageProperty(entityId, property);
          break;
        case DataType.INT:
          await Entity.syncIntProperty(entityId, property);
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
            propertyConfigId: property.propertyConfigId,
            propertyValueId: booleanPropertyValue.id,
            order: property.order,
          },
        });

        return ok(null);
      }

      await prisma.booleanPropertyValue.update({
        where: { id: property.id },
        data: {
          value,
          entityPropertyValue: {
            update: { order: property.order },
          },
        },
      });

      return ok(null);
    } catch (error) {
      console.error("Error syncing boolean property:", error);
      return err(error);
    }
  }

  static async syncDateProperty(
    entityId: number,
    property: EntityProperty
  ): Promise<Result<null, Error>> {
    console.log("Syncing date property:", { entityId, property });
    try {
      const value = property.value as Date;

      if (!property.id) {
        const datePropertyValue = await prisma.datePropertyValue.create({
          data: {
            ...(value && { value }),
          },
        });

        await prisma.entityDateProperty.create({
          data: {
            entityId,
            propertyConfigId: property.propertyConfigId,
            propertyValueId: datePropertyValue.id,
            order: property.order,
          },
        });

        return ok(null);
      }

      await prisma.datePropertyValue.update({
        where: { id: property.id },
        data: {
          ...(value && { value }),
          entityPropertyValue: {
            update: { order: property.order },
          },
        },
      });

      return ok(null);
    } catch (error) {
      console.error("Error syncing date property:", error);
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
            propertyConfigId: property.propertyConfigId,
            propertyValueId: intPropertyValue.id,
            order: property.order,
          },
        });

        return ok(null);
      }

      await prisma.intPropertyValue.update({
        where: { id: property.id },
        data: {
          value,
          entityPropertyValue: {
            update: { order: property.order },
          },
        },
      });

      return ok(null);
    } catch (error) {
      console.error("Error syncing int property:", error);
      return err(error);
    }
  }

  static async syncImageProperty(
    entityId: number,
    property: EntityProperty
  ): Promise<Result<null, Error>> {
    console.log("Syncing image property:", { entityId, property });
    try {
      const value = property.value as ImageDataValue;

      if (!property.id) {
        const imagePropertyValue = await prisma.imagePropertyValue.create({
          data: {
            url: value.src,
            altText: value.alt,
          },
        });

        const data = {
          entityId,
          propertyConfigId: property.propertyConfigId,
          propertyValueId: imagePropertyValue.id,
          order: property.order,
        };

        console.log("Creating entity image property with data:", data);
        await prisma.entityImageProperty.create({
          data,
        });

        return ok(null);
      }

      await prisma.imagePropertyValue.update({
        where: { id: property.id },
        data: {
          url: value.src,
          altText: value.alt,
          entityPropertyValue: {
            update: { order: property.order },
          },
        },
      });

      return ok(null);
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
            propertyConfigId: property.propertyConfigId,
            propertyValueId: shortTextPropertyValue.id,
            order: property.order,
          },
        });

        return ok(null);
      }

      await prisma.shortTextPropertyValue.update({
        where: { id: property.id },
        data: {
          value,
          entityPropertyValue: { update: { order: property.order } },
        },
      });

      return ok(null);
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
            propertyConfigId: property.propertyConfigId,
            propertyValueId: longTextPropertyValue.id,
            order: property.order,
          },
        });

        return ok(null);
      }

      await prisma.longTextPropertyValue.update({
        where: { id: property.id },
        data: {
          value,
          entityPropertyValue: { update: { order: property.order } },
        },
      });

      return ok(null);
    } catch (error) {
      console.error("Error syncing long text property:", error);
      return err(error);
    }
  }
}
