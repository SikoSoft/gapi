import { prisma } from "..";
import { Entity } from "api-spec/models";
import { PrismaEntityConfig } from "../models/Entity";
import {
  PrismaPropertyConfig,
  PropertyConfigCreateBody,
  PropertyConfigUpdateBody,
} from "../models/PropertyConfig";

export class PropertyConfig {
  static async create(
    userId: string,
    entityConfigId: number,
    propertyConfig: PropertyConfigCreateBody
  ): Promise<Entity.EntityPropertyConfig> {
    const createdPropertyConfig = await prisma.propertyConfig.create({
      data: {
        ...propertyConfig,
        userId,
        entityConfigId,
      },
    });
    return PropertyConfig.mapDataToSpec(createdPropertyConfig);
  }

  static async update(
    userId: string,
    entityConfigId: number,
    id: number,
    propertyConfig: PropertyConfigUpdateBody
  ): Promise<Entity.EntityPropertyConfig | null> {
    const updatedPropertyConfig = await prisma.propertyConfig.update({
      where: { userId, id, entityConfigId },
      data: propertyConfig,
    });
    return PropertyConfig.mapDataToSpec(updatedPropertyConfig);
  }

  static async delete(
    userId: string,
    propertyConfigId: number
  ): Promise<boolean> {
    const result = await prisma.propertyConfig.delete({
      where: { userId, id: propertyConfigId },
    });
    if (result) {
      return true;
    }
    return false;
  }

  static mapDataToSpec(
    data: PrismaPropertyConfig
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
      prefix: data.prefix,
      suffix: data.suffix,
    };
  }
}
