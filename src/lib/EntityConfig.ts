import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { Entity } from "api-spec/models";
import {
  EntityConfigCreateBody,
  EntityConfigUpdateBody,
  PrismaEntityConfig,
} from "../models/Entity";
import { CommonEntityPropertyConfig, DataType } from "api-spec/models/Entity";
import { PrismaPropertyConfig } from "../models/PropertyConfig";
import { PropertyConfig } from "./PropertyConfig";

export class EntityConfig {
  static async create(
    userId: string,
    entityConfig: EntityConfigCreateBody
  ): Promise<Result<Entity.EntityConfig, Error>> {
    try {
      const createdEntityConfig = await prisma.entityConfig.create({
        data: {
          name: entityConfig.name,
          description: entityConfig.description,
          userId,
          ...(entityConfig.revisionOf
            ? { revision: { connect: { id: entityConfig.revisionOf } } }
            : {}),
          /*
          properties: {
            create: entityConfig.properties.map((property) => ({
              ...property,
              userId,
            })),
          },
          */
        },
        include: {
          properties: {
            include: {
              defaultBooleanValue: {
                include: {
                  booleanValue: true,
                },
              },
              defaultDateValue: {
                include: {
                  dateValue: true,
                },
              },
              defaultIntValue: {
                include: {
                  intValue: true,
                },
              },
              defaultImageValue: {
                include: {
                  imageValue: true,
                },
              },
              defaultLongTextValue: {
                include: {
                  longTextValue: true,
                },
              },
              defaultShortTextValue: {
                include: {
                  shortTextValue: true,
                },
              },
            },
          },
        },
      });
      return ok(EntityConfig.mapDataToSpec(createdEntityConfig));
    } catch (error) {
      return err(new Error("Failed to create entityConfig", { cause: error }));
    }
  }

  static async delete(
    userId: string,
    entityConfigId: number
  ): Promise<Result<boolean, Error>> {
    try {
      await prisma.entityConfig.delete({
        where: { userId, id: entityConfigId },
      });
      return ok(true);
    } catch (error) {
      return err(new Error("Failed to delete entityConfig", { cause: error }));
    }
  }

  static async update(
    userId: string,
    entityConfig: EntityConfigUpdateBody
  ): Promise<Result<Entity.EntityConfig, Error>> {
    try {
      const propertyConfigs = entityConfig.properties.map((p) => {
        const { entityConfigId, ...propertyConfig } = p;

        return { ...propertyConfig, userId };
      });
      const newProperties = propertyConfigs.filter((prop) => !prop.id);
      const updatedProperties = propertyConfigs.filter((prop) => !!prop.id);

      const updatedEntityConfig = await prisma.entityConfig.update({
        data: {
          name: entityConfig.name,
          description: entityConfig.description,
          /*
          properties: {
            update: updatedProperties.map((p) => {
              const { id, defaultValue, ...prop } = p;
              return {
                where: { id },
                data: { ...prop },
              };
            }),
            create: newProperties.map((p) => {
              const { id, defaultValue, ...prop } = p;
              return prop;
            }),
          },
          */
        },
        where: {
          id: entityConfig.id,
          userId,
        },
        include: {
          properties: {
            orderBy: { entityPropertyConfigOrder: { order: "asc" } },
            include: {
              defaultBooleanValue: {
                include: {
                  booleanValue: true,
                },
              },
              defaultDateValue: {
                include: {
                  dateValue: true,
                },
              },
              defaultIntValue: {
                include: {
                  intValue: true,
                },
              },
              defaultImageValue: {
                include: {
                  imageValue: true,
                },
              },
              defaultLongTextValue: {
                include: {
                  longTextValue: true,
                },
              },
              defaultShortTextValue: {
                include: {
                  shortTextValue: true,
                },
              },
            },
          },
        },
      });
      return ok(EntityConfig.mapDataToSpec(updatedEntityConfig));
    } catch (error) {
      return err(new Error("Failed to update entityConfig", { cause: error }));
    }
  }

  static async getById(
    id: number
  ): Promise<Result<Entity.EntityConfig, Error>> {
    try {
      const entityConfig = await prisma.entityConfig.findFirstOrThrow({
        where: { id },
        include: {
          properties: {
            orderBy: { entityPropertyConfigOrder: { order: "asc" } },
            include: {
              defaultBooleanValue: {
                include: {
                  booleanValue: true,
                },
              },
              defaultDateValue: {
                include: {
                  dateValue: true,
                },
              },
              defaultIntValue: {
                include: {
                  intValue: true,
                },
              },
              defaultImageValue: {
                include: {
                  imageValue: true,
                },
              },
              defaultLongTextValue: {
                include: {
                  longTextValue: true,
                },
              },
              defaultShortTextValue: {
                include: {
                  shortTextValue: true,
                },
              },
            },
          },
        },
      });

      return ok(EntityConfig.mapDataToSpec(entityConfig));
    } catch (error) {
      return err(new Error("Failed to get entityConfig", { cause: error }));
    }
  }

  static async getByUser(
    userId: string
  ): Promise<Result<Entity.EntityConfig[], Error>> {
    try {
      const entityConfigs = await prisma.entityConfig.findMany({
        where: { userId },
        include: {
          properties: {
            orderBy: { entityPropertyConfigOrder: { order: "asc" } },
            include: {
              defaultBooleanValue: {
                include: {
                  booleanValue: true,
                },
              },
              defaultDateValue: {
                include: {
                  dateValue: true,
                },
              },
              defaultIntValue: {
                include: {
                  intValue: true,
                },
              },
              defaultImageValue: {
                include: {
                  imageValue: true,
                },
              },
              defaultLongTextValue: {
                include: {
                  longTextValue: true,
                },
              },
              defaultShortTextValue: {
                include: {
                  shortTextValue: true,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      if (!entityConfigs) {
        return ok([]);
      }

      return ok(
        entityConfigs.map((entityConfig) =>
          EntityConfig.mapDataToSpec(entityConfig)
        )
      );
    } catch (error) {
      console.error(
        `Failed to retrieve entityConfigs for user ${userId}`,
        error
      );
      return err(
        new Error("Failed to retrieve entityConfigs", { cause: error })
      );
    }
  }

  static async syncProperties(
    userId: string,
    entityConfig: Entity.EntityConfig
  ): Promise<Result<void, Error>> {
    try {
      await prisma.entityConfig.update({
        where: { id: entityConfig.id, userId },
        data: {
          properties: {
            create: entityConfig.properties,
          },
        },
      });
      return ok(undefined);
    } catch (error) {
      return err(
        new Error("Failed to sync entityConfig properties", { cause: error })
      );
    }
  }

  static mapDataToSpec(data: PrismaEntityConfig): Entity.EntityConfig {
    return {
      id: data.id,
      userId: data.userId,
      name: data.name,
      description: data.description,
      properties: data.properties.map((property) =>
        EntityConfig.mapPropertyDataToSpec(property)
      ),
      revisionOf: data.revisionOf,
      allowPropertyOrdering: data.allowPropertyOrdering,
    };
  }

  static mapPropertyDataToSpec(
    data: PrismaPropertyConfig
  ): Entity.EntityPropertyConfig {
    return PropertyConfig.mapDataToSpec(data);
  }
}
