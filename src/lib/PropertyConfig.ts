import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { Entity } from "api-spec/models";
import {
  PrismaPropertyConfig,
  PropertyConfigCreateBody,
  PropertyConfigUpdateBody,
} from "../models/PropertyConfig";
import {
  BooleanDataValue,
  CommonEntityPropertyConfig,
  DataType,
  ImageDataValue,
  IntDataValue,
  LongTextDataValue,
  ShortTextDataValue,
} from "api-spec/models/Entity";

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
        include: {
          defaultBooleanValue: {
            include: {
              booleanValue: true,
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
    console.log("Updating property config:", {
      userId,
      entityConfigId,
      id,
      propertyConfig,
    });
    try {
      const { defaultValue, ...data } = propertyConfig;

      const updatedPropertyConfig = await prisma.propertyConfig.update({
        where: { userId, id, entityConfigId },
        data: {
          ...data,
        },
        include: {
          defaultBooleanValue: {
            include: {
              booleanValue: true,
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
      });
      const mappedConfig = PropertyConfig.mapDataToSpec(updatedPropertyConfig);
      PropertyConfig.syncDefaultValue({
        ...mappedConfig,
        defaultValue,
      } as Entity.EntityPropertyConfig);
      return ok(mappedConfig);
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

  static async syncDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    console.log("Syncing default value for property config:", propertyConfig);
    try {
      switch (propertyConfig.dataType) {
        case DataType.BOOLEAN:
          return PropertyConfig.syncBooleanDefaultValue(propertyConfig);
        case DataType.IMAGE:
          return PropertyConfig.syncImageDefaultValue(propertyConfig);
        case DataType.INT:
          return PropertyConfig.syncIntDefaultValue(propertyConfig);
        case DataType.LONG_TEXT:
          return PropertyConfig.syncLongTextDefaultValue(propertyConfig);
        case DataType.SHORT_TEXT:
          return PropertyConfig.syncShortTextDefaultValue(propertyConfig);
        default:
          return err(new Error("Unsupported data type for default value"));
      }
    } catch (error) {
      return err(
        new Error("Failed to update property config default value", {
          cause: error,
        })
      );
    }
  }

  static async syncBooleanDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    try {
      const value = propertyConfig.defaultValue as BooleanDataValue;
      const existingDefault =
        await prisma.propertyConfigBooleanDefaultValue.findUnique({
          where: { propertyConfigId: propertyConfig.id },
        });

      if (existingDefault) {
        await prisma.booleanPropertyValue.update({
          where: { id: existingDefault.propertyValueId },
          data: { value },
        });

        return ok(null);
      }

      const booleanValue = await prisma.booleanPropertyValue.create({
        data: {
          //propertyId: propertyConfig.id,
          value,
        },
      });

      await prisma.propertyConfigBooleanDefaultValue.create({
        data: {
          propertyConfigId: propertyConfig.id,
          propertyValueId: booleanValue.id,
        },
      });
    } catch (error) {
      return err(
        new Error("Failed to update property config default boolean value", {
          cause: error,
        })
      );
    }
  }

  static async syncIntDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    try {
      const value = propertyConfig.defaultValue as IntDataValue;
      const existingDefault =
        await prisma.propertyConfigIntDefaultValue.findUnique({
          where: { propertyConfigId: propertyConfig.id },
        });

      if (existingDefault) {
        await prisma.intPropertyValue.update({
          where: { id: existingDefault.propertyValueId },
          data: { value },
        });

        return ok(null);
      }

      const intValue = await prisma.intPropertyValue.create({
        data: {
          //propertyId: propertyConfig.id,
          value,
        },
      });

      await prisma.propertyConfigIntDefaultValue.create({
        data: {
          propertyConfigId: propertyConfig.id,
          propertyValueId: intValue.id,
        },
      });
    } catch (error) {
      return err(
        new Error("Failed to update property config default int value", {
          cause: error,
        })
      );
    }
  }

  static async syncImageDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    try {
      const value = propertyConfig.defaultValue as ImageDataValue;
      const existingDefault =
        await prisma.propertyConfigImageDefaultValue.findUnique({
          where: { propertyConfigId: propertyConfig.id },
        });

      if (existingDefault) {
        await prisma.imagePropertyValue.update({
          where: { id: existingDefault.propertyValueId },
          data: { url: value.src, altText: value.alt },
        });

        return ok(null);
      }

      const imageValue = await prisma.imagePropertyValue.create({
        data: {
          //propertyId: propertyConfig.id,
          url: value.src,
          altText: value.alt,
        },
      });

      await prisma.propertyConfigImageDefaultValue.create({
        data: {
          propertyConfigId: propertyConfig.id,
          propertyValueId: imageValue.id,
        },
      });
    } catch (error) {
      return err(
        new Error("Failed to update property config default image value", {
          cause: error,
        })
      );
    }
  }

  static async syncShortTextDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    try {
      const value = propertyConfig.defaultValue as ShortTextDataValue;
      const existingDefault =
        await prisma.propertyConfigShortTextDefaultValue.findUnique({
          where: { propertyConfigId: propertyConfig.id },
        });

      if (existingDefault) {
        await prisma.shortTextPropertyValue.update({
          where: { id: existingDefault.propertyValueId },
          data: { value },
        });

        return ok(null);
      }

      const shortTextValue = await prisma.shortTextPropertyValue.create({
        data: {
          //propertyId: propertyConfig.id,
          value,
        },
      });

      await prisma.propertyConfigShortTextDefaultValue.create({
        data: {
          propertyConfigId: propertyConfig.id,
          propertyValueId: shortTextValue.id,
        },
      });
    } catch (error) {
      return err(
        new Error("Failed to update property config default short text value", {
          cause: error,
        })
      );
    }
  }

  static async syncLongTextDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    try {
      const value = propertyConfig.defaultValue as LongTextDataValue;
      const existingDefault =
        await prisma.propertyConfigLongTextDefaultValue.findUnique({
          where: { propertyConfigId: propertyConfig.id },
        });

      if (existingDefault) {
        await prisma.longTextPropertyValue.update({
          where: { id: existingDefault.propertyValueId },
          data: { value },
        });

        return ok(null);
      }

      const longTextValue = await prisma.longTextPropertyValue.create({
        data: {
          //propertyId: propertyConfig.id,
          value,
        },
      });

      await prisma.propertyConfigLongTextDefaultValue.create({
        data: {
          propertyConfigId: propertyConfig.id,
          propertyValueId: longTextValue.id,
        },
      });
    } catch (error) {
      return err(
        new Error("Failed to update property config default long text value", {
          cause: error,
        })
      );
    }
  }

  static mapDataToSpec(
    data: PrismaPropertyConfig
  ): Entity.EntityPropertyConfig {
    console.log("Mapping data to spec:", data);
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
          defaultValue: data?.defaultBooleanValue?.booleanValue?.value || false,
        };
      case DataType.INT:
        return {
          ...commonConfig,
          dataType: DataType.INT,
          defaultValue: data?.defaultIntValue?.intValue?.value || 0,
        };
      case DataType.IMAGE:
        return {
          ...commonConfig,
          dataType: DataType.IMAGE,
          defaultValue: {
            src: data?.defaultImageValue?.imageValue?.url || "",
            alt: data?.defaultImageValue?.imageValue?.altText || "",
          },
        };
      case DataType.LONG_TEXT:
        return {
          ...commonConfig,
          dataType: DataType.LONG_TEXT,
          defaultValue: data?.defaultLongTextValue?.longTextValue?.value || "",
        };
      case DataType.SHORT_TEXT:
        return {
          ...commonConfig,
          dataType: DataType.SHORT_TEXT,
          defaultValue:
            data?.defaultShortTextValue?.shortTextValue?.value || "",
        };
    }
  }
}
