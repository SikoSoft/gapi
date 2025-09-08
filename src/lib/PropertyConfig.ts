import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { Entity } from "api-spec/models";
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
  ): Promise<Result<Entity.EntityPropertyConfig, Error>> {
    try {
      const createdPropertyConfig = await prisma.propertyConfig.create({
        data: {
          ...propertyConfig,
          userId,
          entityConfigId,
        },
      });
      return ok(PropertyConfig.mapDataToSpec(createdPropertyConfig));
    } catch (error) {
      return err(
        new Error("Failed to create property config", { cause: error })
      );
    }
  }

  static async update(
    userId: string,
    entityConfigId: number,
    id: number,
    propertyConfig: PropertyConfigUpdateBody
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    try {
      const updatedPropertyConfig = await prisma.propertyConfig.update({
        where: { userId, id, entityConfigId },
        data: propertyConfig,
      });
      return ok(PropertyConfig.mapDataToSpec(updatedPropertyConfig));
    } catch (error) {
      return err(
        new Error("Failed to update property config", { cause: error })
      );
    }
  }

  static async delete(
    userId: string,
    propertyConfigId: number
  ): Promise<Result<boolean, Error>> {
    try {
      await prisma.propertyConfig.delete({
        where: { userId, id: propertyConfigId },
      });
      return ok(true);
    } catch (error) {
      return err(
        new Error("Failed to delete property config", { cause: error })
      );
    }
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
