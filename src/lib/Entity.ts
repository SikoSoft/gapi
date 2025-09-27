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
import { Entity as EntitySpec } from "api-spec/models";

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
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const entity = await prisma.entity.create({
        data: {
          userId,
          entityConfigId: data.entityConfigId,
        },
        include: {
          tags: true,
          booleanProperties: {
            include: { propertyValue: true },
          },
          intProperties: {
            include: { propertyValue: true },
          },
          imageProperties: {
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
      Tagging.syncEntityTags(entity.id, data.tags);
      await Entity.syncEntityProperties(entity.id, data.properties);
      return ok(Entity.toSpec(entity));
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
      const entityRes = await Entity.getEntity(id);
      if (entityRes.isErr()) {
        return err(entityRes.error);
      }
      await Entity.syncEntityProperties(id, data.properties);

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
          intProperties: {
            include: {
              propertyValue: true,
            },
          },
          imageProperties: {
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
        });
      });
    }

    return properties;
  }

  static toSpec(entity: PrismaEntity): EntitySpec.Entity {
    //console.log("Entity to spec:", entity);

    const properties: EntitySpec.EntityProperty[] = [
      ...Entity.booleanPropertiesToSpec(entity),
      ...Entity.intPropertiesToSpec(entity),
      ...Entity.imagePropertiesToSpec(entity),
      ...Entity.longTextPropertiesToSpec(entity),
      ...Entity.shortTextPropertiesToSpec(entity),
    ];

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
            booleanProperties: {
              include: { propertyValue: true },
            },
            intProperties: {
              include: { propertyValue: true },
            },
            imageProperties: {
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
          intProperties: {
            include: { propertyValue: true },
          },
          imageProperties: {
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
              intProperties: {
                include: { propertyValue: true },
              },
              imageProperties: {
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
    properties: EntityProperty[]
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
            propertyConfigId: property.propertyConfigId,
            propertyValueId: booleanPropertyValue.id,
          },
        });

        return ok(null);
      }

      await prisma.booleanPropertyValue.update({
        where: { id: property.id },
        data: {
          value,
        },
      });

      return ok(null);
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
            propertyConfigId: property.propertyConfigId,
            propertyValueId: intPropertyValue.id,
          },
        });

        return ok(null);
      }

      await prisma.intPropertyValue.update({
        where: { id: property.id },
        data: {
          value,
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
          },
        });

        return ok(null);
      }

      await prisma.shortTextPropertyValue.update({
        where: { id: property.id },
        data: {
          value,
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
          },
        });

        return ok(null);
      }

      await prisma.longTextPropertyValue.update({
        where: { id: property.id },
        data: {
          value,
        },
      });

      return ok(null);
    } catch (error) {
      console.error("Error syncing long text property:", error);
      return err(error);
    }
  }
}
