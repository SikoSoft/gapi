import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { Entity } from "api-spec/models";
import {
  PrismaPropertyConfig,
  PropertyConfigCreateBody,
  PropertyConfigUpdateBody,
} from "../models/PropertyConfig";
import { CommonEntityPropertyConfig, DataType } from "api-spec/models/Entity";

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
      const { defaultValue, ...data } = propertyConfig;

      console.log({ userId, id, entityConfigId, data, defaultValue });
      const updatedPropertyConfig = await prisma.propertyConfig.update({
        where: { userId, id, entityConfigId },
        data: {
          ...data,
          // defaultValue: defaultValue ? JSON.stringify(defaultValue) : null,
        },
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
    const commonConfig: CommonEntityPropertyConfig = {
      entityConfigId: data.entityConfigId,
      id: data.id,
      userId: data.userId,
      name: data.name,
      renderType: data.renderType as Entity.RenderType,
      required: data.required,
      repeat: data.repeat,
      allowed: data.allowed,
      prefix: data.prefix,
      suffix: data.suffix,
    };

    switch (data.dataType) {
      case DataType.BOOLEAN:
        return {
          ...commonConfig,
          dataType: DataType.BOOLEAN,
          defaultValue: false,
        };
      case DataType.INT:
        return {
          ...commonConfig,
          dataType: DataType.INT,
          defaultValue: 0,
        };
      case DataType.IMAGE:
        return {
          ...commonConfig,
          dataType: DataType.IMAGE,
          defaultValue: null,
        };
      case DataType.LONG_TEXT:
        return {
          ...commonConfig,
          dataType: DataType.LONG_TEXT,
          defaultValue: "",
        };
      case DataType.SHORT_TEXT:
        return {
          ...commonConfig,
          dataType: DataType.SHORT_TEXT,
          defaultValue: "",
        };
    }
  }

  static sanitizeBodyData(
    data: PropertyConfigCreateBody | PropertyConfigUpdateBody
  ): PropertyConfigCreateBody | PropertyConfigUpdateBody {
    return {
      ...data,
      defaultValue: data.defaultValue
        ? JSON.stringify(data.defaultValue)
        : null,
    };
  }
}
