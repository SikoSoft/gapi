import { prisma } from "..";
import { Entity } from "api-spec/models";
import { PrismaEntityConfig } from "../models/Entity";

export class EntityConfig {
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
    entityConfig: Entity.EntityConfig
  ): Promise<Entity.EntityConfig> {
    await prisma.entityConfig.update({
      data: {
        id: entityConfig.id,
        name: entityConfig.name,
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

  static mapDataToSpec(data: PrismaEntityConfig): Entity.EntityConfig {
    return {
      id: data.id,
      name: data.name,
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
