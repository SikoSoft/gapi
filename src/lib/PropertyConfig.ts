import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { Logger } from "./Logger";
import { Entity } from "api-spec/models";
import {
  CalculatedPropertyConfigCreateBody,
  CalculatedPropertyConfigUpdateBody,
  PrismaPropertyConfig,
  PropertyConfigCreateBody,
  propertyConfigInclude,
  PropertyConfigUpdateBody,
  ResolvedCalculatedConfig,
} from "../models/PropertyConfig";
import { EntityConfig } from "./EntityConfig";
import {
  BooleanDataValue,
  CommonEntityPropertyConfig,
  DataType,
  DateDataValue,
  ImageDataValue,
  IntDataValue,
  LongTextDataValue,
  ShortTextDataValue,
} from "api-spec/models/Entity";
import { Util } from "./Util";

export class PropertyConfig {
  static async create(
    userId: string,
    entityConfigId: number,
    propertyConfig: PropertyConfigCreateBody
  ): Promise<Result<Entity.EntityPropertyConfig, Error>> {
    const isAllowed = await EntityConfig.isEditAllowed(userId, entityConfigId);
    if (isAllowed.isErr()) {
      return err(isAllowed.error);
    }
    if (!isAllowed.value) {
      return err(new Error("Not authorized to edit this entity config"));
    }

    const { defaultValue, timeZone, performDriftCheck, options, formatters, ...data } =
      propertyConfig;

    try {
      const createdPropertyConfig = await prisma.propertyConfig.create({
        data: {
          ...data,
          userId,
          entityConfigId,
        },
        include: propertyConfigInclude,
      });

      if (
        options !== undefined &&
        (data.dataType === DataType.SHORT_TEXT ||
          data.dataType === DataType.INT)
      ) {
        const optionsRes = await PropertyConfig.updateOptions(
          createdPropertyConfig.id,
          data.dataType,
          options as string[] | number[]
        );
        if (optionsRes.isErr()) {
          return err(optionsRes.error);
        }
      }

      if (formatters !== undefined) {
        const formattersRes = await PropertyConfig.syncFormatters(createdPropertyConfig.id, formatters);
        if (formattersRes.isErr()) {
          return err(formattersRes.error);
        }
      }

      const propertyConfig = await prisma.propertyConfig.findUnique({
        where: { userId, id: createdPropertyConfig.id },
        include: propertyConfigInclude,
      });

      if (!propertyConfig) {
        return ok(null);
      }

      const mappedConfig = PropertyConfig.mapDataToSpec(propertyConfig);
      PropertyConfig.syncDefaultValue({
        ...mappedConfig,
        defaultValue:
          data.dataType === DataType.DATE
            ? Util.getDateInTimeZone(defaultValue as string, timeZone)
            : defaultValue,
      } as Entity.EntityPropertyConfig);
      return ok(mappedConfig);
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
    Logger.log("Updating property config:", {
      userId,
      entityConfigId,
      id,
      propertyConfig,
    });

    const isAllowed = await EntityConfig.isEditAllowed(userId, entityConfigId);
    if (isAllowed.isErr()) {
      return err(isAllowed.error);
    }
    if (!isAllowed.value) {
      return err(new Error("Not authorized to edit this entity config"));
    }

    try {
      const { defaultValue, timeZone, performDriftCheck, options, formatters, ...data } =
        propertyConfig;

      if (
        options !== undefined &&
        (data.dataType === DataType.SHORT_TEXT ||
          data.dataType === DataType.INT)
      ) {
        const optionsRes = await PropertyConfig.updateOptions(
          id,
          data.dataType,
          options as string[] | number[]
        );
        if (optionsRes.isErr()) {
          return err(optionsRes.error);
        }
      }

      if (formatters !== undefined) {
        const formattersRes = await PropertyConfig.syncFormatters(id, formatters);
        if (formattersRes.isErr()) {
          return err(formattersRes.error);
        }
      }

      const updatedPropertyConfig = await prisma.propertyConfig.update({
        where: { id, entityConfigId },
        data: {
          ...data,
        },
        include: propertyConfigInclude,
      });

      const mappedConfig = PropertyConfig.mapDataToSpec(updatedPropertyConfig);
      PropertyConfig.syncDefaultValue({
        ...mappedConfig,
        defaultValue:
          data.dataType === DataType.DATE
            ? defaultValue !== null
              ? Util.getDateInTimeZone(defaultValue as string, timeZone)
              : null
            : defaultValue,
      } as Entity.EntityPropertyConfig);
      return ok(mappedConfig);
    } catch (error) {
      return err(
        new Error("Failed to update property config", { cause: error })
      );
    }
  }

  static async updateOptions(
    propertyConfigId: number,
    dataType: DataType,
    options: string[] | number[]
  ): Promise<Result<null, Error>> {
    try {
      if (dataType === DataType.SHORT_TEXT) {
        await prisma.optionsShortTextOption.deleteMany({
          where: { propertyConfigId },
        });
        await prisma.optionsShortTextOption.createMany({
          data: (options as string[]).map((value) => ({
            propertyConfigId,
            value,
          })),
          skipDuplicates: true,
        });
      } else if (dataType === DataType.INT) {
        await prisma.optionsIntOption.deleteMany({
          where: { propertyConfigId },
        });
        await prisma.optionsIntOption.createMany({
          data: (options as number[]).map((value) => ({
            propertyConfigId,
            value,
          })),
          skipDuplicates: true,
        });
      }
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to update property config options", { cause: error })
      );
    }
  }

  static async syncFormatters(
    propertyConfigId: number,
    formatters: string[]
  ): Promise<Result<null, Error>> {
    try {
      await prisma.propertyConfigFormatter.deleteMany({ where: { propertyConfigId } });
      await prisma.propertyConfigFormatter.createMany({
        data: formatters.map((formatterId, index) => ({
          propertyConfigId,
          formatterId,
          order: index,
        })),
      });
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to sync property config formatters", { cause: error })
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

  static async getById(
    userId: string,
    propertyConfigId: number
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    try {
      const propertyConfig = await prisma.propertyConfig.findUnique({
        where: { userId, id: propertyConfigId },
        include: propertyConfigInclude,
      });

      if (!propertyConfig) {
        return ok(null);
      }

      return ok(PropertyConfig.mapDataToSpec(propertyConfig));
    } catch (error) {
      return err(
        new Error("Failed to get property config by ID", { cause: error })
      );
    }
  }

  static async syncDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    Logger.log("Syncing default value for property config:", propertyConfig);
    try {
      switch (propertyConfig.dataType) {
        case DataType.BOOLEAN:
          return PropertyConfig.syncBooleanDefaultValue(propertyConfig);
        case DataType.DATE:
          return PropertyConfig.syncDateDefaultValue(propertyConfig);
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

  static async syncDateDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    try {
      const value = propertyConfig.defaultValue as DateDataValue;
      const existingDefault =
        await prisma.propertyConfigDateDefaultValue.findUnique({
          where: { propertyConfigId: propertyConfig.id },
        });

      if (value === null) {
        Logger.log("delete date default value!!!!!!!!!!!!!!!");
        if (existingDefault) {
          await prisma.datePropertyValue.deleteMany({
            where: { id: existingDefault.propertyValueId },
          });
        }

        await prisma.propertyConfigDateDefaultValue.deleteMany({
          where: { propertyConfigId: propertyConfig.id },
        });

        return ok(null);
      }

      if (existingDefault) {
        await prisma.datePropertyValue.update({
          where: { id: existingDefault.propertyValueId },
          data: { value },
        });

        return ok(null);
      }

      const dateValue = await prisma.datePropertyValue.create({
        data: {
          value,
        },
      });

      await prisma.propertyConfigDateDefaultValue.create({
        data: {
          propertyConfigId: propertyConfig.id,
          propertyValueId: dateValue.id,
        },
      });
    } catch (error) {
      return err(
        new Error("Failed to update property config default date value", {
          cause: error,
        })
      );
    }
  }

  static async syncIntDefaultValue(
    propertyConfig: Entity.EntityPropertyConfig
  ): Promise<Result<Entity.EntityPropertyConfig | null, Error>> {
    Logger.log("Syncing int default value:", propertyConfig);
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

  static async createCalculated(
    userId: string,
    entityConfigId: number,
    body: CalculatedPropertyConfigCreateBody
  ): Promise<Result<Entity.EntityCalculatedPropertyConfig, Error>> {
    const isAllowed = await EntityConfig.isEditAllowed(userId, entityConfigId);
    if (isAllowed.isErr()) {
      return err(isAllowed.error);
    }
    if (!isAllowed.value) {
      return err(new Error("Not authorized to edit this entity config"));
    }

    const validationError = await PropertyConfig.validateCalculationRefs(
      entityConfigId,
      body.calculation
    );
    if (validationError) {
      return err(validationError);
    }

    try {
      const created = await prisma.propertyConfig.create({
        data: {
          name: body.name,
          dataType: DataType.INT,
          prefix: body.prefix,
          suffix: body.suffix,
          hidden: body.hidden,
          userId,
          entityConfigId,
          calculation: body.calculation as object,
          repeat: 0,
          allowed: 0,
          required: 0,
          optionsOnly: false,
        },
        include: propertyConfigInclude,
      });

      return ok(
        PropertyConfig.mapDataToSpec(created) as Entity.EntityCalculatedPropertyConfig
      );
    } catch (error) {
      return err(
        new Error("Failed to create calculated property config", { cause: error })
      );
    }
  }

  static async updateCalculated(
    userId: string,
    entityConfigId: number,
    id: number,
    body: CalculatedPropertyConfigUpdateBody
  ): Promise<Result<Entity.EntityCalculatedPropertyConfig | null, Error>> {
    const isAllowed = await EntityConfig.isEditAllowed(userId, entityConfigId);
    if (isAllowed.isErr()) {
      return err(isAllowed.error);
    }
    if (!isAllowed.value) {
      return err(new Error("Not authorized to edit this entity config"));
    }

    const validationError = await PropertyConfig.validateCalculationRefs(
      entityConfigId,
      body.calculation
    );
    if (validationError) {
      return err(validationError);
    }

    try {
      const updated = await prisma.propertyConfig.update({
        where: { id, entityConfigId },
        data: {
          name: body.name,
          prefix: body.prefix,
          suffix: body.suffix,
          hidden: body.hidden,
          calculation: body.calculation as object,
        },
        include: propertyConfigInclude,
      });

      return ok(
        PropertyConfig.mapDataToSpec(updated) as Entity.EntityCalculatedPropertyConfig
      );
    } catch (error) {
      return err(
        new Error("Failed to update calculated property config", { cause: error })
      );
    }
  }

  static async validateCalculationRefs(
    entityConfigId: number,
    calculation: Entity.EntityPropertyCalculation
  ): Promise<Error | null> {
    const refIds: number[] = [];
    if (
      typeof calculation.value1 === "object" &&
      "propertyConfigId" in calculation.value1
    ) {
      refIds.push(calculation.value1.propertyConfigId);
    }
    if (
      typeof calculation.value2 === "object" &&
      "propertyConfigId" in calculation.value2
    ) {
      refIds.push(calculation.value2.propertyConfigId);
    }

    if (refIds.length === 0) {
      return null;
    }

    const found = await prisma.propertyConfig.count({
      where: { entityConfigId, id: { in: refIds } },
    });

    if (found < refIds.length) {
      return new Error(
        "Referenced propertyConfigId does not belong to this entity config"
      );
    }

    return null;
  }

  static async resolveCalculatedPropertyConfigs(
    entityConfigIds: number[]
  ): Promise<ResolvedCalculatedConfig[]> {
    const allConfigs = await prisma.propertyConfig.findMany({
      where: { entityConfigId: { in: entityConfigIds } },
    });
    const calculatedConfigs = allConfigs.filter((c) => c.calculation !== null);

    if (calculatedConfigs.length === 0) {
      return [];
    }

    const refIds = new Set<number>();
    for (const config of calculatedConfigs) {
      const calc = config.calculation as Entity.EntityPropertyCalculation;
      if (typeof calc.value1 === "object" && "propertyConfigId" in calc.value1) {
        refIds.add(calc.value1.propertyConfigId);
      }
      if (typeof calc.value2 === "object" && "propertyConfigId" in calc.value2) {
        refIds.add(calc.value2.propertyConfigId);
      }
    }

    const sourceConfigs =
      refIds.size > 0
        ? await prisma.propertyConfig.findMany({
            where: { id: { in: Array.from(refIds) } },
            select: { id: true, dataType: true },
          })
        : [];

    const dataTypeMap = new Map(
      sourceConfigs.map((c) => [c.id, c.dataType as DataType])
    );

    return calculatedConfigs.map((config) => {
      const calc = config.calculation as Entity.EntityPropertyCalculation;
      const v1DataType =
        typeof calc.value1 === "object" && "propertyConfigId" in calc.value1
          ? (dataTypeMap.get(calc.value1.propertyConfigId) ?? null)
          : null;
      const v2DataType =
        typeof calc.value2 === "object" && "propertyConfigId" in calc.value2
          ? (dataTypeMap.get(calc.value2.propertyConfigId) ?? null)
          : null;

      return {
        id: config.id,
        calculation: calc,
        value1DataType: v1DataType,
        value2DataType: v2DataType,
      };
    });
  }

  static async updateOrder(
    entityConfigId: number,
    propertyConfigId: number,
    newOrder: number
  ): Promise<Result<null, Error>> {
    try {
      await prisma.entityPropertyConfigOrder.upsert({
        where: { propertyConfigId, entityConfigId },
        update: { order: newOrder },
        create: {
          entityConfigId,
          propertyConfigId,
          order: newOrder,
        },
      });

      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to update property config order", { cause: error })
      );
    }
  }

  static mapDataToOptions(data: PrismaPropertyConfig): (string | number)[] {
    let options: (string | number)[] = [];
    if (data.optionsShortText.length) {
      options = data.optionsShortText.map((option) => option.value);
    }
    if (data.optionsInt.length) {
      options = data.optionsInt.map((option) => option.value);
    }
    return options;
  }

  static mapDataToSpec(
    data: PrismaPropertyConfig
  ): Entity.EntityPropertyConfig | Entity.EntityCalculatedPropertyConfig {
    if (data.calculation !== null && data.calculation !== undefined) {
      return {
        entityConfigId: data.entityConfigId,
        id: data.id,
        userId: data.userId,
        name: data.name,
        prefix: data.prefix,
        suffix: data.suffix,
        hidden: data.hidden,
        dataType: DataType.INT,
        defaultValue: 0,
        calculation: data.calculation as Entity.EntityPropertyCalculation,
      } as Entity.EntityCalculatedPropertyConfig;
    }

    const options = PropertyConfig.mapDataToOptions(data);

    const commonConfig: CommonEntityPropertyConfig = {
      entityConfigId: data.entityConfigId,
      id: data.id,
      userId: data.userId,
      name: data.name,
      required: data.required,
      repeat: data.repeat,
      allowed: data.allowed,
      prefix: data.prefix,
      suffix: data.suffix,
      hidden: data.hidden,
      optionsOnly: data.optionsOnly,
      options,
      formatters: data.formatters
        .sort((a, b) => a.order - b.order)
        .map(f => f.formatterId),
    };

    switch (data.dataType) {
      case DataType.BOOLEAN:
        return {
          ...commonConfig,
          dataType: DataType.BOOLEAN,
          defaultValue: data?.defaultBooleanValue?.booleanValue?.value || false,
        };
      case DataType.DATE:
        return {
          ...commonConfig,
          dataType: DataType.DATE,
          defaultValue: data?.defaultDateValue?.dateValue?.value ?? null,
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
