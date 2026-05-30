import { Result, err, ok } from "neverthrow";
import {
  DataType,
  EntityProperty as ApiEntityProperty,
  ImageDataValue,
} from "api-spec/models/Entity";
import { prisma } from "..";
import { PropertyReference } from "../models/Entity";
import {
  PrismaPropertyConfig,
  propertyConfigInclude,
} from "../models/PropertyConfig";
import { ValidationError } from "../errors/ValidationError";
import { PropertyConfig } from "./PropertyConfig";
import { Util } from "./Util";
import { Logger } from "./Logger";

export class EntityProperty {
  static async getEntityIdsWithPropertyValue(
    entityIds: number[],
    propertyConfigId: number,
    value: ApiEntityProperty["value"],
    dataType: DataType
  ): Promise<number[]> {
    if (entityIds.length === 0) {
      return [];
    }

    switch (dataType) {
      case DataType.BOOLEAN: {
        const rows = await prisma.entityBooleanProperty.findMany({
          where: {
            entityId: { in: entityIds },
            propertyConfigId,
            propertyValue: { value: value as boolean },
          },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.DATE: {
        const rows = await prisma.entityDateProperty.findMany({
          where: {
            entityId: { in: entityIds },
            propertyConfigId,
            propertyValue: { value: new Date(value as string) },
          },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.IMAGE: {
        const v = value as { src: string; alt: string };
        const rows = await prisma.entityImageProperty.findMany({
          where: {
            entityId: { in: entityIds },
            propertyConfigId,
            propertyValue: { url: v.src, altText: v.alt },
          },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.INT: {
        const rows = await prisma.entityIntProperty.findMany({
          where: {
            entityId: { in: entityIds },
            propertyConfigId,
            propertyValue: { value: value as number },
          },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.SHORT_TEXT: {
        const rows = await prisma.entityShortTextProperty.findMany({
          where: {
            entityId: { in: entityIds },
            propertyConfigId,
            propertyValue: { value: value as string },
          },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.LONG_TEXT: {
        const rows = await prisma.entityLongTextProperty.findMany({
          where: {
            entityId: { in: entityIds },
            propertyConfigId,
            propertyValue: { value: value as string },
          },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      default:
        return [];
    }
  }

  static async getCurrentPropertyValue(
    entityId: number,
    propertyConfigId: number,
    dataType: DataType
  ): Promise<ApiEntityProperty["value"] | undefined> {
    switch (dataType) {
      case DataType.BOOLEAN: {
        const row = await prisma.entityBooleanProperty.findFirst({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return row ? row.propertyValue.value : undefined;
      }
      case DataType.DATE: {
        const row = await prisma.entityDateProperty.findFirst({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return row ? row.propertyValue.value.toISOString() : undefined;
      }
      case DataType.IMAGE: {
        const row = await prisma.entityImageProperty.findFirst({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return row
          ? { src: row.propertyValue.url, alt: row.propertyValue.altText }
          : undefined;
      }
      case DataType.INT: {
        const row = await prisma.entityIntProperty.findFirst({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return row ? row.propertyValue.value : undefined;
      }
      case DataType.SHORT_TEXT: {
        const row = await prisma.entityShortTextProperty.findFirst({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return row ? row.propertyValue.value : undefined;
      }
      case DataType.LONG_TEXT: {
        const row = await prisma.entityLongTextProperty.findFirst({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return row ? row.propertyValue.value : undefined;
      }
      default:
        return undefined;
    }
  }

  static async checkUniqueConstraints(
    entityConfigId: number,
    incomingProperties: ApiEntityProperty[],
    excludeEntityId?: number
  ): Promise<Result<number | null, Error>> {
    try {
      const entityConfig = await prisma.entityConfig.findUnique({
        where: { id: entityConfigId },
        include: { uniqueConstraints: { include: { properties: true } } },
      });

      if (!entityConfig || entityConfig.uniqueConstraints.length === 0) {
        return ok(null);
      }

      const propertyConfigIds = [
        ...new Set(
          entityConfig.uniqueConstraints.flatMap((uc) =>
            uc.properties.map((p) => p.propertyConfigId)
          )
        ),
      ];
      const propertyConfigRows = await prisma.propertyConfig.findMany({
        where: { id: { in: propertyConfigIds } },
        select: { id: true, dataType: true },
      });
      const dataTypeMap: Record<number, DataType> = {};
      for (const row of propertyConfigRows) {
        dataTypeMap[row.id] = row.dataType as DataType;
      }

      const candidates = await prisma.entity.findMany({
        where: {
          entityConfigId,
          ...(excludeEntityId !== undefined
            ? { id: { not: excludeEntityId } }
            : {}),
        },
        select: { id: true },
      });

      for (const constraint of entityConfig.uniqueConstraints) {
        const constraintPropertyIds = constraint.properties.map(
          (p) => p.propertyConfigId
        );
        const resolvedValues: Map<number, ApiEntityProperty["value"]> =
          new Map();

        for (const propertyConfigId of constraintPropertyIds) {
          const incoming = incomingProperties.find(
            (p) => p.propertyConfigId === propertyConfigId
          );
          if (incoming !== undefined) {
            resolvedValues.set(propertyConfigId, incoming.value);
          } else if (excludeEntityId !== undefined) {
            const currentValue = await EntityProperty.getCurrentPropertyValue(
              excludeEntityId,
              propertyConfigId,
              dataTypeMap[propertyConfigId]
            );
            if (currentValue !== undefined) {
              resolvedValues.set(propertyConfigId, currentValue);
            }
          }
        }

        if (resolvedValues.size !== constraintPropertyIds.length) {
          continue;
        }

        let matchingIds = candidates.map((e) => e.id);

        for (const propertyConfigId of constraintPropertyIds) {
          const value = resolvedValues.get(propertyConfigId);
          const dataType = dataTypeMap[propertyConfigId];
          matchingIds = await EntityProperty.getEntityIdsWithPropertyValue(
            matchingIds,
            propertyConfigId,
            value,
            dataType
          );
          if (matchingIds.length === 0) {
            break;
          }
        }

        if (matchingIds.length > 0) {
          return ok(matchingIds[0]);
        }
      }

      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to check unique constraints", { cause: error })
      );
    }
  }

  static validateDataAgainstPropertyConfigs(
    properties: ApiEntityProperty[],
    propertyConfigs: PrismaPropertyConfig[]
  ): Result<null, ValidationError> {
    for (const property of properties) {
      const config = propertyConfigs.find(
        (c) => c.id === property.propertyConfigId
      );
      if (!config) {
        return err(
          new ValidationError(
            `No property config found for propertyConfigId ${property.propertyConfigId}`
          )
        );
      }

      if (
        config.required &&
        (property.value === null || property.value === "")
      ) {
        return err(
          new ValidationError(
            `Property with propertyConfigId ${property.propertyConfigId} is required`
          )
        );
      }

      if (
        config.dataType === "shortText" &&
        config.optionsOnly &&
        PropertyConfig.mapDataToOptions(config).includes(
          property.value as string
        ) === false
      ) {
        return err(
          new ValidationError(
            `Property with propertyConfigId ${property.propertyConfigId} has an invalid value`
          )
        );
      }
    }
    return ok(null);
  }

  static async getPropertyConfigs(
    configIds: number[]
  ): Promise<Result<PrismaPropertyConfig[], Error>> {
    try {
      const propertyConfigs = await prisma.propertyConfig.findMany({
        where: { id: { in: configIds } },
        include: propertyConfigInclude,
      });

      return ok(propertyConfigs);
    } catch (error) {
      return err(error);
    }
  }

  static async getDataTypesForProperties(
    properties: ApiEntityProperty[]
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

  static async cleanOrphanedProperties(
    entityId: number,
    propertyReferences: PropertyReference[],
    properties: ApiEntityProperty[],
    dataTypeMap: Record<number, DataType>
  ): Promise<void> {
    const idsToPurge: Record<DataType, number[]> = Object.values(
      DataType
    ).reduce((acc, dataType) => {
      acc[dataType] = [];
      return acc;
    }, {} as Record<DataType, number[]>);

    for (const propertyReference of propertyReferences) {
      const isStillReferenced = properties.find(
        (p) =>
          p.id === propertyReference.propertyValueId &&
          dataTypeMap[p.propertyConfigId] === propertyReference.dataType
      );
      if (!isStillReferenced) {
        idsToPurge[propertyReference.dataType].push(
          propertyReference.propertyValueId
        );
      }
    }

    for (const dataType in idsToPurge) {
      const ids = idsToPurge[dataType as DataType];
      if (ids.length === 0) {
        continue;
      }

      switch (dataType) {
        case DataType.BOOLEAN:
          await prisma.entityBooleanProperty.deleteMany({
            where: { propertyValueId: { in: ids }, entityId },
          });
          break;
        case DataType.DATE:
          await prisma.entityDateProperty.deleteMany({
            where: { propertyValueId: { in: ids }, entityId },
          });
          break;
        case DataType.IMAGE:
          await prisma.entityImageProperty.deleteMany({
            where: { propertyValueId: { in: ids }, entityId },
          });
          break;
        case DataType.INT:
          await prisma.entityIntProperty.deleteMany({
            where: { propertyValueId: { in: ids }, entityId },
          });
          break;
        case DataType.SHORT_TEXT:
          await prisma.entityShortTextProperty.deleteMany({
            where: { propertyValueId: { in: ids }, entityId },
          });
          break;
        case DataType.LONG_TEXT:
          await prisma.entityLongTextProperty.deleteMany({
            where: { propertyValueId: { in: ids }, entityId },
          });
          break;
      }
    }
  }

  static async getCalculatedConfigIds(
    propertyConfigIds: number[]
  ): Promise<Set<number>> {
    if (propertyConfigIds.length === 0) {
      return new Set();
    }
    const rows = await prisma.propertyConfig.findMany({
      where: { id: { in: propertyConfigIds } },
      select: { id: true, calculation: true },
    });
    return new Set(rows.filter((r) => r.calculation !== null).map((r) => r.id));
  }

  static async countExistingProperties(
    entityId: number,
    propertyConfigId: number,
    dataType: DataType
  ): Promise<number> {
    switch (dataType) {
      case DataType.BOOLEAN:
        return prisma.entityBooleanProperty.count({
          where: { entityId, propertyConfigId },
        });
      case DataType.DATE:
        return prisma.entityDateProperty.count({
          where: { entityId, propertyConfigId },
        });
      case DataType.IMAGE:
        return prisma.entityImageProperty.count({
          where: { entityId, propertyConfigId },
        });
      case DataType.INT:
        return prisma.entityIntProperty.count({
          where: { entityId, propertyConfigId },
        });
      case DataType.SHORT_TEXT:
        return prisma.entityShortTextProperty.count({
          where: { entityId, propertyConfigId },
        });
      case DataType.LONG_TEXT:
        return prisma.entityLongTextProperty.count({
          where: { entityId, propertyConfigId },
        });
      default:
        return 0;
    }
  }

  static async syncEntityProperties(
    entityId: number,
    properties: ApiEntityProperty[],
    propertyReferences: PropertyReference[],
    timeZone: number
  ): Promise<Result<null, Error>> {
    Logger.log("Syncing entity properties:", { entityId, properties });

    const calculatedIds = await EntityProperty.getCalculatedConfigIds(
      properties.map((p) => p.propertyConfigId)
    );
    const regularProperties = properties.filter(
      (p) => !calculatedIds.has(p.propertyConfigId)
    );

    const dataTypesRes =
      await EntityProperty.getDataTypesForProperties(regularProperties);
    if (dataTypesRes.isErr()) {
      Logger.error(
        "Error getting data types for properties:",
        dataTypesRes.error
      );
      return;
    }
    const dataTypes = dataTypesRes.value;

    if (propertyReferences.length > 0) {
      await EntityProperty.cleanOrphanedProperties(
        entityId,
        propertyReferences,
        regularProperties,
        dataTypes
      );
    }

    for (const property of regularProperties) {
      switch (dataTypes[property.propertyConfigId]) {
        case DataType.BOOLEAN:
          await EntityProperty.syncBooleanProperty(entityId, property);
          break;
        case DataType.DATE:
          property.value =
            property.value === null
              ? null
              : Util.getDateInTimeZone(property.value as string, timeZone);
          await EntityProperty.syncDateProperty(entityId, property);
          break;
        case DataType.IMAGE:
          await EntityProperty.syncImageProperty(entityId, property);
          break;
        case DataType.INT:
          await EntityProperty.syncIntProperty(entityId, property);
          break;
        case DataType.SHORT_TEXT:
          await EntityProperty.syncShortTextProperty(entityId, property);
          break;
        case DataType.LONG_TEXT:
          await EntityProperty.syncLongTextProperty(entityId, property);
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
    property: ApiEntityProperty
  ): Promise<Result<null, Error>> {
    Logger.log("Syncing boolean property:", { entityId, property });
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
      Logger.error("Error syncing boolean property:", error);
      return err(error);
    }
  }

  static async syncDateProperty(
    entityId: number,
    property: ApiEntityProperty
  ): Promise<Result<null, Error>> {
    Logger.log("Syncing date property:", { entityId, property });
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
      Logger.error("Error syncing date property:", error);
      return err(error);
    }
  }

  static async syncIntProperty(
    entityId: number,
    property: ApiEntityProperty
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
      Logger.error("Error syncing int property:", error);
      return err(error);
    }
  }

  static async syncImageProperty(
    entityId: number,
    property: ApiEntityProperty
  ): Promise<Result<null, Error>> {
    Logger.log("Syncing image property:", { entityId, property });
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

        Logger.log("Creating entity image property with data:", data);
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
      Logger.error("Error syncing image property:", error);
      return err(error);
    }
  }

  static async syncShortTextProperty(
    entityId: number,
    property: ApiEntityProperty
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
      Logger.error("Error syncing boolean property:", error);
      return err(error);
    }
  }

  static async syncLongTextProperty(
    entityId: number,
    property: ApiEntityProperty
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
      Logger.error("Error syncing long text property:", error);
      return err(error);
    }
  }

  static async syncAllCalculatedEntityProperties(
    entityId: number,
    properties: ApiEntityProperty[]
  ): Promise<Result<null, Error>> {
    try {
      for (const property of properties) {
        await prisma.entityCalculatedProperty.upsert({
          where: {
            entityId_propertyConfigId: {
              entityId,
              propertyConfigId: property.propertyConfigId,
            },
          },
          update: { order: property.order },
          create: {
            entityId,
            propertyConfigId: property.propertyConfigId,
            order: property.order,
          },
        });
      }
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to sync calculated entity properties", {
          cause: error,
        })
      );
    }
  }

  static async replaceCalculatedEntityProperties(
    entityId: number,
    properties: ApiEntityProperty[]
  ): Promise<Result<null, Error>> {
    try {
      const incomingConfigIds = properties.map((p) => p.propertyConfigId);
      await prisma.entityCalculatedProperty.deleteMany({
        where: {
          entityId,
          propertyConfigId: { notIn: incomingConfigIds },
        },
      });
      for (const property of properties) {
        await prisma.entityCalculatedProperty.upsert({
          where: {
            entityId_propertyConfigId: {
              entityId,
              propertyConfigId: property.propertyConfigId,
            },
          },
          update: { order: property.order },
          create: {
            entityId,
            propertyConfigId: property.propertyConfigId,
            order: property.order,
          },
        });
      }
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to replace calculated entity properties", {
          cause: error,
        })
      );
    }
  }

  static async deletePropertiesByConfigIds(
    entityId: number,
    propertyConfigIds: number[],
    dataTypes: Record<number, DataType>
  ): Promise<void> {
    for (const propertyConfigId of propertyConfigIds) {
      switch (dataTypes[propertyConfigId]) {
        case DataType.BOOLEAN:
          await prisma.entityBooleanProperty.deleteMany({
            where: { entityId, propertyConfigId },
          });
          break;
        case DataType.DATE:
          await prisma.entityDateProperty.deleteMany({
            where: { entityId, propertyConfigId },
          });
          break;
        case DataType.IMAGE:
          await prisma.entityImageProperty.deleteMany({
            where: { entityId, propertyConfigId },
          });
          break;
        case DataType.INT:
          await prisma.entityIntProperty.deleteMany({
            where: { entityId, propertyConfigId },
          });
          break;
        case DataType.SHORT_TEXT:
          await prisma.entityShortTextProperty.deleteMany({
            where: { entityId, propertyConfigId },
          });
          break;
        case DataType.LONG_TEXT:
          await prisma.entityLongTextProperty.deleteMany({
            where: { entityId, propertyConfigId },
          });
          break;
      }
    }
  }

  static async findMatchingPropertyValueIds(
    entityId: number,
    propertyConfigId: number,
    dataType: DataType,
    properties: ApiEntityProperty[]
  ): Promise<number[]> {
    switch (dataType) {
      case DataType.BOOLEAN: {
        const rows = await prisma.entityBooleanProperty.findMany({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return rows
          .filter((r) =>
            properties.some((p) => p.value === r.propertyValue?.value)
          )
          .map((r) => r.propertyValueId);
      }
      case DataType.DATE: {
        const rows = await prisma.entityDateProperty.findMany({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return rows
          .filter((r) =>
            properties.some(
              (p) =>
                p.value !== null &&
                r.propertyValue !== null &&
                new Date(p.value as Date).toISOString() ===
                  new Date(r.propertyValue.value).toISOString()
            )
          )
          .map((r) => r.propertyValueId);
      }
      case DataType.IMAGE: {
        const rows = await prisma.entityImageProperty.findMany({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return rows
          .filter((r) =>
            properties.some((p) => {
              const v = p.value as { src: string; alt: string };
              return (
                v.src === r.propertyValue?.url &&
                v.alt === r.propertyValue?.altText
              );
            })
          )
          .map((r) => r.propertyValueId);
      }
      case DataType.INT: {
        const rows = await prisma.entityIntProperty.findMany({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return rows
          .filter((r) =>
            properties.some((p) => p.value === r.propertyValue?.value)
          )
          .map((r) => r.propertyValueId);
      }
      case DataType.SHORT_TEXT: {
        const rows = await prisma.entityShortTextProperty.findMany({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return rows
          .filter((r) =>
            properties.some((p) => p.value === r.propertyValue?.value)
          )
          .map((r) => r.propertyValueId);
      }
      case DataType.LONG_TEXT: {
        const rows = await prisma.entityLongTextProperty.findMany({
          where: { entityId, propertyConfigId },
          include: { propertyValue: true },
        });
        return rows
          .filter((r) =>
            properties.some((p) => p.value === r.propertyValue?.value)
          )
          .map((r) => r.propertyValueId);
      }
      default:
        return [];
    }
  }

  static async deleteEntityPropertiesByValueIds(
    entityId: number,
    propertyConfigId: number,
    dataType: DataType,
    propertyValueIds: number[]
  ): Promise<void> {
    const where = {
      entityId,
      propertyConfigId,
      propertyValueId: { in: propertyValueIds },
    };
    switch (dataType) {
      case DataType.BOOLEAN:
        await prisma.entityBooleanProperty.deleteMany({ where });
        break;
      case DataType.DATE:
        await prisma.entityDateProperty.deleteMany({ where });
        break;
      case DataType.IMAGE:
        await prisma.entityImageProperty.deleteMany({ where });
        break;
      case DataType.INT:
        await prisma.entityIntProperty.deleteMany({ where });
        break;
      case DataType.SHORT_TEXT:
        await prisma.entityShortTextProperty.deleteMany({ where });
        break;
      case DataType.LONG_TEXT:
        await prisma.entityLongTextProperty.deleteMany({ where });
        break;
    }
  }

  static async addProperties(
    entityId: number,
    properties: ApiEntityProperty[],
    timeZone: number
  ): Promise<Result<null, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId },
        select: { entityConfigId: true },
      });
      if (!entity) {
        return err(new Error(`Entity ${entityId} not found`));
      }

      const uniqueConfigIds = [
        ...new Set(properties.map((p) => p.propertyConfigId)),
      ];
      const propertyConfigsRes =
        await EntityProperty.getPropertyConfigs(uniqueConfigIds);
      if (propertyConfigsRes.isErr()) {
        return err(propertyConfigsRes.error);
      }
      const propertyConfigs = propertyConfigsRes.value;

      for (const config of propertyConfigs) {
        if (config.entityConfigId !== entity.entityConfigId) {
          return err(
            new ValidationError(
              `Property config ${config.id} does not belong to entity config ${entity.entityConfigId}`
            )
          );
        }

        if (config.allowed > 0) {
          const incomingCount = properties.filter(
            (p) => p.propertyConfigId === config.id
          ).length;
          const existingCount = await EntityProperty.countExistingProperties(
            entityId,
            config.id,
            config.dataType as DataType
          );
          if (existingCount + incomingCount > config.allowed) {
            return err(
              new ValidationError(
                `Adding properties for config ${config.id} would exceed the allowed limit of ${config.allowed}`
              )
            );
          }
        }
      }

      const newProperties = properties.map((p) => ({ ...p, id: 0 }));
      await EntityProperty.syncEntityProperties(
        entityId,
        newProperties,
        [],
        timeZone
      );
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async removeProperties(
    entityId: number,
    properties: ApiEntityProperty[]
  ): Promise<Result<null, Error>> {
    try {
      const uniqueConfigIds = [
        ...new Set(properties.map((p) => p.propertyConfigId)),
      ];

      const propertyConfigsRes =
        await EntityProperty.getPropertyConfigs(uniqueConfigIds);
      if (propertyConfigsRes.isErr()) {
        return err(propertyConfigsRes.error);
      }

      for (const config of propertyConfigsRes.value) {
        const dataType = config.dataType as DataType;
        const propsForConfig = properties.filter(
          (p) => p.propertyConfigId === config.id
        );

        const matchingValueIds =
          await EntityProperty.findMatchingPropertyValueIds(
            entityId,
            config.id,
            dataType,
            propsForConfig
          );

        if (matchingValueIds.length === 0) {
          continue;
        }

        if (config.required > 0) {
          const existingCount = await EntityProperty.countExistingProperties(
            entityId,
            config.id,
            dataType
          );
          if (existingCount - matchingValueIds.length < config.required) {
            continue;
          }
        }

        await EntityProperty.deleteEntityPropertiesByValueIds(
          entityId,
          config.id,
          dataType,
          matchingValueIds
        );
      }

      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async replaceProperties(
    entityId: number,
    properties: ApiEntityProperty[],
    timeZone: number
  ): Promise<Result<null, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId },
        select: { entityConfigId: true },
      });
      if (!entity) {
        return err(new Error(`Entity ${entityId} not found`));
      }

      const uniqueConfigIds = [
        ...new Set(properties.map((p) => p.propertyConfigId)),
      ];
      if (uniqueConfigIds.length === 0) {
        return ok(null);
      }

      const propertyConfigsRes =
        await EntityProperty.getPropertyConfigs(uniqueConfigIds);
      if (propertyConfigsRes.isErr()) {
        return err(propertyConfigsRes.error);
      }
      const propertyConfigs = propertyConfigsRes.value;

      const dataTypes: Record<number, DataType> = {};
      for (const config of propertyConfigs) {
        dataTypes[config.id] = config.dataType as DataType;

        if (config.entityConfigId !== entity.entityConfigId) {
          return err(
            new ValidationError(
              `Property config ${config.id} does not belong to entity config ${entity.entityConfigId}`
            )
          );
        }

        if (config.allowed > 0) {
          const incomingCount = properties.filter(
            (p) => p.propertyConfigId === config.id
          ).length;
          if (incomingCount > config.allowed) {
            return err(
              new ValidationError(
                `Properties for config ${config.id} exceed the allowed limit of ${config.allowed}`
              )
            );
          }
        }
      }

      await EntityProperty.deletePropertiesByConfigIds(
        entityId,
        uniqueConfigIds,
        dataTypes
      );

      const newProperties = properties.map((p) => ({ ...p, id: 0 }));
      await EntityProperty.syncEntityProperties(
        entityId,
        newProperties,
        [],
        timeZone
      );
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async getTextValues(
    entityId: number
  ): Promise<Result<string[], Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId },
        include: {
          shortTextProperties: { include: { propertyValue: true } },
          longTextProperties: { include: { propertyValue: true } },
        },
      });

      if (!entity) {
        return err(new Error(`Entity ${entityId} not found`));
      }

      const textValues = [
        ...entity.shortTextProperties.map((p) => p.propertyValue.value),
        ...entity.longTextProperties.map((p) => p.propertyValue.value),
      ];

      return ok(textValues);
    } catch (error) {
      return err(
        new Error("Failed to get entity text values", { cause: error })
      );
    }
  }
}
