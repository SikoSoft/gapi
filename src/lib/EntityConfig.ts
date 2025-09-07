import { prisma } from "..";
import { Entity } from "api-spec/models";
import {
  EntityConfigCreateBody,
  EntityConfigUpdateBody,
  PrismaEntityConfig,
} from "../models/Entity";

export class EntityConfig {
  static async create(
    userId: string,
    entityConfig: EntityConfigCreateBody
  ): Promise<Entity.EntityConfig> {
    const createdEntityConfig = await prisma.entityConfig.create({
      data: {
        ...entityConfig,
        userId,
        properties: {
          create: entityConfig.properties.map((property) => ({
            ...property,
            userId,
          })),
        },
      },
      include: {
        properties: true,
      },
    });
    return EntityConfig.mapDataToSpec(createdEntityConfig);
  }

  static async delete(
    userId: string,
    entityConfigId: number
  ): Promise<boolean> {
    const result = await prisma.entityConfig.delete({
      where: { userId, id: entityConfigId },
    });
    if (result) {
      return true;
    }
    return false;
  }

  static async update(
    userId: string,
    entityConfig: EntityConfigUpdateBody
  ): Promise<Entity.EntityConfig> {
    const propertyConfigs = entityConfig.properties.map((p) => {
      const { entityConfigId, ...propertyConfig } = p;

      return { ...propertyConfig, userId };
    });
    const newProperties = propertyConfigs.filter((prop) => !prop.id);
    const updatedProperties = propertyConfigs.filter((prop) => !!prop.id);

    await prisma.entityConfig.update({
      data: {
        id: entityConfig.id,
        name: entityConfig.name,
        description: entityConfig.description,
        properties: {
          update: updatedProperties.map((p) => {
            const { id, ...prop } = p;
            return {
              where: { id },
              data: { ...prop },
            };
          }),
          create: newProperties.map((p) => {
            const { id, ...prop } = p;
            return prop;
          }),
        },
      },
      where: {
        id: entityConfig.id,
        userId,
      },
    });

    return await EntityConfig.getById(entityConfig.id);
  }

  static async getById(id: number): Promise<Entity.EntityConfig> {
    try {
      const entityConfig = await prisma.entityConfig.findFirstOrThrow({
        where: { id },
        include: {
          properties: true,
        },
      });

      return EntityConfig.mapDataToSpec(entityConfig);
    } catch (error) {
      console.error(`Failed to get entityConfig by id ${id}`, error);
    }
  }

  static async getByUser(userId: string): Promise<EntityConfig[]> {
    try {
      const entityConfigs = await prisma.entityConfig.findMany({
        where: { userId },
        include: {
          properties: true,
        },
        orderBy: { name: "asc" },
      });

      if (!entityConfigs) {
        return [];
      }

      return entityConfigs.map((entityConfig) =>
        EntityConfig.mapDataToSpec(entityConfig)
      );
    } catch (error) {
      console.error(
        `Failed to retrieve entityConfigs for user ${userId}`,
        error
      );
      return [];
    }
  }

  static async syncProperties(
    userId: string,
    entityConfig: Entity.EntityConfig
  ): Promise<void> {
    await prisma.entityConfig.update({
      where: { id: entityConfig.id, userId },
      data: {
        properties: {
          create: entityConfig.properties,
        },
      },
    });
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
    };
  }

  static mapPropertyDataToSpec(
    data: PrismaEntityConfig["properties"][number]
  ): Entity.EntityPropertyConfig {
    return {
      entityConfigId: data.entityConfigId,
      id: data.id,
      userId: data.userId,
      name: data.name,
      dataType: data.dataType as Entity.DataType,
      renderType: data.renderType as Entity.RenderType,
      required: data.required,
      repeat: data.repeat,
      allowed: data.allowed,
      prefix: "",
      suffix: "",
    };
  }
}
