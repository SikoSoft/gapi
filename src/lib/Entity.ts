import { Result, err, ok } from "neverthrow";
import {
  ListContext,
  ListContextType,
  ListContextUnit,
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
  PropertyReference,
  entityInclude,
} from "../models/Entity";
import {
  DataType,
  EntityProperty,
  ImageDataValue,
} from "api-spec/models/Entity";
import { Access, Entity as EntitySpec } from "api-spec/models";
import { Util } from "./Util";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";
import { PropertyConfig } from "./PropertyConfig";
import {
  PrismaPropertyConfig,
  propertyConfigInclude,
} from "../models/PropertyConfig";
import { ValidationError } from "../errors/ValidationError";
import { AccessError } from "../errors/AccessError";
import { Logger } from "./Logger";
import { Hook } from "./Hook";
import { HookType } from "../models/Hook";

export class Entity {
  static async getPropertySuggestions(
    userId: string,
    propertyConfigId: number,
    query: string
  ): Promise<Result<string[], Error>> {
    try {
      const suggestions = await prisma.shortTextPropertyValue.findMany({
        distinct: ["value"],
        take: 10,
        where: {
          value: { startsWith: query, mode: "insensitive" },
          entityPropertyValue: {
            propertyConfigId,
          },
        },
        orderBy: { value: "asc" },
      });
      return ok(suggestions.map((s) => s.value));
    } catch (error) {
      return err(error);
    }
  }

  static async getEntityIdsWithPropertyValue(
    entityIds: number[],
    propertyConfigId: number,
    value: EntityProperty["value"],
    dataType: DataType
  ): Promise<number[]> {
    if (entityIds.length === 0) {
      return [];
    }

    switch (dataType) {
      case DataType.BOOLEAN: {
        const rows = await prisma.entityBooleanProperty.findMany({
          where: { entityId: { in: entityIds }, propertyConfigId, propertyValue: { value: value as boolean } },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.DATE: {
        const rows = await prisma.entityDateProperty.findMany({
          where: { entityId: { in: entityIds }, propertyConfigId, propertyValue: { value: new Date(value as string) } },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.IMAGE: {
        const v = value as { src: string; alt: string };
        const rows = await prisma.entityImageProperty.findMany({
          where: { entityId: { in: entityIds }, propertyConfigId, propertyValue: { url: v.src, altText: v.alt } },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.INT: {
        const rows = await prisma.entityIntProperty.findMany({
          where: { entityId: { in: entityIds }, propertyConfigId, propertyValue: { value: value as number } },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.SHORT_TEXT: {
        const rows = await prisma.entityShortTextProperty.findMany({
          where: { entityId: { in: entityIds }, propertyConfigId, propertyValue: { value: value as string } },
          select: { entityId: true },
        });
        return rows.map((r) => r.entityId);
      }
      case DataType.LONG_TEXT: {
        const rows = await prisma.entityLongTextProperty.findMany({
          where: { entityId: { in: entityIds }, propertyConfigId, propertyValue: { value: value as string } },
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
  ): Promise<EntityProperty["value"] | undefined> {
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
        return row ? { src: row.propertyValue.url, alt: row.propertyValue.altText } : undefined;
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
    incomingProperties: EntityProperty[],
    excludeEntityId?: number
  ): Promise<Result<null, ValidationError>> {
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
          ...(excludeEntityId !== undefined ? { id: { not: excludeEntityId } } : {}),
        },
        select: { id: true },
      });

      for (const constraint of entityConfig.uniqueConstraints) {
        const constraintPropertyIds = constraint.properties.map((p) => p.propertyConfigId);
        const resolvedValues: Map<number, EntityProperty["value"]> = new Map();

        for (const propertyConfigId of constraintPropertyIds) {
          const incoming = incomingProperties.find((p) => p.propertyConfigId === propertyConfigId);
          if (incoming !== undefined) {
            resolvedValues.set(propertyConfigId, incoming.value);
          } else if (excludeEntityId !== undefined) {
            const currentValue = await Entity.getCurrentPropertyValue(
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
          matchingIds = await Entity.getEntityIdsWithPropertyValue(
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
          return err(
            new ValidationError(
              `An entity with this combination of properties already exists`
            )
          );
        }
      }

      return ok(null);
    } catch (error) {
      return err(new ValidationError("Failed to check unique constraints"));
    }
  }

  static async create(
    userId: string,
    data: EntityBodyPayload
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const properties = data.properties ?? [];
      const propertyConfigIds = properties.map((p) => p.propertyConfigId);

      const propertyConfigs = await Entity.getPropertyConfigs(
        propertyConfigIds
      );
      if (propertyConfigs.isErr()) {
        return err(propertyConfigs.error);
      }

      const validation = Entity.validateDataAgainstPropertyConfigs(
        properties,
        propertyConfigs.value
      );
      if (validation.isErr()) {
        return err(validation.error);
      }

      if (data.entityConfigId !== undefined) {
        const uniqueCheck = await Entity.checkUniqueConstraints(
          data.entityConfigId,
          properties
        );
        if (uniqueCheck.isErr()) {
          return err(uniqueCheck.error);
        }
      }

      await Hook.trigger({ type: HookType.PRE_CREATE, userId, data });

      const entity = await prisma.entity.create({
        data: {
          userId: data.userId ?? userId,
          entityConfigId: data.entityConfigId,
          published: data.published ?? false,
          suggestion: data.suggestion ?? false,
          ...(data.createdAt
            ? {
                createdAt: Util.getDateInTimeZone(
                  data.createdAt,
                  data.timeZone ?? 0
                ),
                updatedAt: Util.getDateInTimeZone(
                  data.createdAt,
                  data.timeZone ?? 0
                ),
              }
            : {}),
        },
      });

      Tagging.syncEntityTags(entity.id, data.tags ?? []);
      await Entity.syncEntityProperties(
        entity.id,
        properties,
        [],
        data.timeZone ?? 0
      );

      const entityRes = await Entity.getEntity(entity.id);
      if (entityRes.isErr()) {
        return err(entityRes.error);
      }

      await Hook.trigger({
        type: HookType.POST_CREATE,
        userId,
        data,
        entityId: entity.id,
      });

      return ok(entityRes.value);
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
      await Hook.trigger({ type: HookType.PRE_UPDATE, userId, entityId: id, data });

      const properties = data.properties ?? [];

      if (properties.length > 0) {
        const propertyConfigIds = properties.map((p) => p.propertyConfigId);

        const propertyConfigs = await Entity.getPropertyConfigs(
          propertyConfigIds
        );
        if (propertyConfigs.isErr()) {
          return err(propertyConfigs.error);
        }

        const validation = Entity.validateDataAgainstPropertyConfigs(
          properties,
          propertyConfigs.value
        );
        if (validation.isErr()) {
          return err(validation.error);
        }

        if (data.entityConfigId !== undefined) {
          const uniqueCheck = await Entity.checkUniqueConstraints(
            data.entityConfigId,
            properties,
            id
          );
          if (uniqueCheck.isErr()) {
            return err(uniqueCheck.error);
          }
        }

        await Entity.syncEntityProperties(
          id,
          properties,
          data.propertyReferences ?? [],
          data.timeZone ?? 0
        );
      }

      if (data.tags !== undefined) {
        Tagging.syncEntityTags(id, data.tags);
      }

      if (data.published !== undefined || data.suggestion !== undefined) {
        await prisma.entity.update({
          where: { id, userId },
          data: {
            ...(data.published !== undefined && { published: data.published }),
            ...(data.suggestion !== undefined && {
              suggestion: data.suggestion,
            }),
          },
        });
      }

      const entityRes = await Entity.getEntity(id);
      if (entityRes.isErr()) {
        return err(entityRes.error);
      }

      await Hook.trigger({ type: HookType.POST_UPDATE, userId, entityId: id, data });

      return ok(entityRes.value);
    } catch (error) {
      return err(error);
    }
  }

  static validateDataAgainstPropertyConfigs(
    properties: EntityProperty[],
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

  static async getEntity(
    id: number
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id },
        include: entityInclude,
      });

      if (!entity) {
        return err(new Error("Entity not found"));
      }
      return ok(Entity.toSpec(entity));
    } catch (error) {
      return err(error);
    }
  }

  static async getEntityForUser(
    id: number,
    userId: string
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id },
        include: entityInclude,
      });

      if (!entity) {
        return err(new Error("Entity not found"));
      }

      if (entity.userId === userId) {
        return ok(Entity.toSpec(entity));
      }

      const viewPolicy = entity.accessPolicy?.viewAccessPolicy;
      if (!viewPolicy) {
        return err(new AccessError("Access denied"));
      }

      const hasAccess = viewPolicy.parties.some((party) => {
        if (party.type === Access.AccessPartyType.USER) {
          return party.userId === userId;
        }
        if (party.type === Access.AccessPartyType.GROUP) {
          return party.group?.users.some((gu) => gu.userId === userId) ?? false;
        }
        return false;
      });

      if (!hasAccess) {
        return err(new AccessError("Access denied"));
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
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static datePropertiesToSpec(
    entity: PrismaEntity
  ): EntitySpec.EntityProperty[] {
    const properties: EntitySpec.EntityProperty[] = [];

    if (entity.dateProperties) {
      entity.dateProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue ? prop.propertyValue.value : new Date(),
          order: prop.order,
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
          order: prop.order,
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
      entity.imageProperties.forEach((prop) => {
        properties.push({
          id: prop.propertyValueId,
          propertyConfigId: prop.propertyConfigId,
          value: prop.propertyValue
            ? { src: prop.propertyValue.url, alt: prop.propertyValue.altText }
            : { src: "", alt: "" },
          order: prop.order,
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
          order: prop.order,
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
          order: prop.order,
        });
      });
    }

    return properties;
  }

  static toSpec(entity: PrismaEntity): EntitySpec.Entity {
    //console.log("Entity to spec:", entity);

    const properties: EntitySpec.EntityProperty[] = [
      ...Entity.booleanPropertiesToSpec(entity),
      ...Entity.datePropertiesToSpec(entity),
      ...Entity.imagePropertiesToSpec(entity),
      ...Entity.intPropertiesToSpec(entity),
      ...Entity.longTextPropertiesToSpec(entity),
      ...Entity.shortTextPropertiesToSpec(entity),
    ].sort((a, b) => a.order - b.order);

    return {
      id: entity.id,
      userId: entity.userId,
      type: entity.entityConfigId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      properties,
      tags: entity.tags.map((tag) => tag.label),
      viewAccessPolicyId: entity.accessPolicy
        ? entity.accessPolicy.viewAccessPolicyId
        : 0,
      editAccessPolicyId: entity.accessPolicy
        ? entity.accessPolicy.editAccessPolicyId
        : 0,
      suggestion: entity.suggestion,
      published: entity.published,
    };
  }

  static async getList({
    userId,
    filter,
    sort,
    start,
    perPage,
  }: EntityListParams): Promise<Result<EntityList, Error>> {
    const listQuery = new EntityListQueryBuilder();
    if (userId) {
      listQuery.setUserId(userId);
    } else {
      listQuery.setSystemMode();
    }
    listQuery.setFilter(filter);
    listQuery.setSort(sort);
    listQuery.setPagination(start, perPage);

    try {
      const total = await listQuery.runCountQuery();
      const entities = (await listQuery.runQuery()).map((entity) =>
        Entity.toSpec(entity)
      );

      return ok({
        entities,
        total,
      });
    } catch (error) {
      return err(error);
    }
  }

  static async export(
    userId: string,
    entityConfigIds: number[],
    startDate?: Date,
    endDate?: Date
  ): Promise<Result<EntitySpec.Entity[], Error>> {
    let entities: EntitySpec.Entity[];

    try {
      entities = (
        await prisma.entity.findMany({
          where: {
            userId,
            entityConfigId: { in: entityConfigIds },
            ...(startDate || endDate
              ? {
                  createdAt: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                }
              : {}),
          },
          include: entityInclude,
        })
      ).map((entity) => Entity.toSpec(entity));
      return ok(entities);
    } catch (error) {
      return err(error);
    }
  }

  static async deleteStaleSuggestions(): Promise<Result<number, Error>> {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count } = await prisma.entity.deleteMany({
        where: {
          suggestion: true,
          createdAt: { lte: cutoff },
        },
      });
      return ok(count);
    } catch (error) {
      return err(error);
    }
  }

  static async delete(
    userId: string,
    id: number
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      await Hook.trigger({ type: HookType.PRE_DELETE, userId, entityId: id });

      const entityPolicy = await prisma.entityAccessPolicy.findUnique({
        where: { entityId: id },
      });

      const entity = await prisma.entity.delete({
        where: {
          userId,
          id,
        },
        include: entityInclude,
      });

      if (entityPolicy) {
        const [entityCount, listConfigCount] = await Promise.all([
          prisma.entityAccessPolicy.count({
            where: {
              OR: [
                { viewAccessPolicyId: entityPolicy.viewAccessPolicyId },
                { editAccessPolicyId: entityPolicy.editAccessPolicyId },
              ],
            },
          }),
          prisma.listConfigAccessPolicy.count({
            where: {
              OR: [
                { viewAccessPolicyId: entityPolicy.viewAccessPolicyId },
                { editAccessPolicyId: entityPolicy.editAccessPolicyId },
              ],
            },
          }),
        ]);
        if (entityCount === 0 && listConfigCount === 0) {
          await prisma.accessPolicy.delete({
            where: { id: entityPolicy.viewAccessPolicyId },
          });
        }
      }

      await Hook.trigger({ type: HookType.POST_DELETE, userId, entityId: id });

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
              //[sort.property]: sort.direction,
            },
            include: entityInclude,
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

  static async cleanOrphanedProperties(
    entityId: number,
    propertyReferences: PropertyReference[],
    properties: EntityProperty[],
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

  static async syncEntityProperties(
    entityId: number,
    properties: EntityProperty[],
    propertyReferences: PropertyReference[],
    timeZone: number
  ): Promise<Result<null, Error>> {
    Logger.log("Syncing entity properties:", { entityId, properties });

    const dataTypesRes = await Entity.getDataTypesForProperties(properties);
    if (dataTypesRes.isErr()) {
      Logger.error(
        "Error getting data types for properties:",
        dataTypesRes.error
      );
      return;
    }
    const dataTypes = dataTypesRes.value;

    if (propertyReferences.length > 0) {
      await Entity.cleanOrphanedProperties(
        entityId,
        propertyReferences,
        properties,
        dataTypes
      );
    }

    for (const property of properties) {
      switch (dataTypes[property.propertyConfigId]) {
        case DataType.BOOLEAN:
          await Entity.syncBooleanProperty(entityId, property);
          break;
        case DataType.DATE:
          property.value =
            property.value === null
              ? null
              : Util.getDateInTimeZone(property.value as string, timeZone);
          await Entity.syncDateProperty(entityId, property);
          break;
        case DataType.IMAGE:
          await Entity.syncImageProperty(entityId, property);
          break;
        case DataType.INT:
          await Entity.syncIntProperty(entityId, property);
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
    property: EntityProperty
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
    property: EntityProperty
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

  static async addProperties(
    entityId: number,
    properties: EntityProperty[],
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
      const propertyConfigsRes = await Entity.getPropertyConfigs(
        uniqueConfigIds
      );
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
          const existingCount = await Entity.countExistingProperties(
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
      await Entity.syncEntityProperties(entityId, newProperties, [], timeZone);
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }

  static async findMatchingPropertyValueIds(
    entityId: number,
    propertyConfigId: number,
    dataType: DataType,
    properties: EntityProperty[]
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

  static async removeProperties(
    entityId: number,
    properties: EntityProperty[]
  ): Promise<Result<null, Error>> {
    try {
      const uniqueConfigIds = [
        ...new Set(properties.map((p) => p.propertyConfigId)),
      ];

      const propertyConfigsRes = await Entity.getPropertyConfigs(
        uniqueConfigIds
      );
      if (propertyConfigsRes.isErr()) {
        return err(propertyConfigsRes.error);
      }

      for (const config of propertyConfigsRes.value) {
        const dataType = config.dataType as DataType;
        const propsForConfig = properties.filter(
          (p) => p.propertyConfigId === config.id
        );

        const matchingValueIds = await Entity.findMatchingPropertyValueIds(
          entityId,
          config.id,
          dataType,
          propsForConfig
        );

        if (matchingValueIds.length === 0) {
          continue;
        }

        if (config.required > 0) {
          const existingCount = await Entity.countExistingProperties(
            entityId,
            config.id,
            dataType
          );
          if (existingCount - matchingValueIds.length < config.required) {
            continue;
          }
        }

        await Entity.deleteEntityPropertiesByValueIds(
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

  static async hasMatchingEntityLoggedInPastHour(
    userId: string,
    entityConfigId: number,
    textValues: string[]
  ): Promise<Result<boolean, Error>> {
    try {
      if (textValues.length === 0) {
        Logger.log(
          "[Entity] hasMatchingEntityLoggedInPastHour: textValues is empty — skipping dedupe check"
        );
        return ok(false);
      }

      const oneHourAgo = new Date(Date.now() - 3600000);
      const entities = await prisma.entity.findMany({
        where: {
          userId,
          entityConfigId,
          suggestion: false,
          createdAt: { gte: oneHourAgo },
        },
        include: {
          shortTextProperties: { include: { propertyValue: true } },
          longTextProperties: { include: { propertyValue: true } },
        },
      });

      Logger.log(
        `[Entity] hasMatchingEntityLoggedInPastHour: found ${entities.length} non-suggestion entities of type ${entityConfigId} logged in past hour`,
        { textValues }
      );

      for (const entity of entities) {
        const entityTextValues = [
          ...entity.shortTextProperties.map((p) => p.propertyValue.value),
          ...entity.longTextProperties.map((p) => p.propertyValue.value),
        ];

        if (textValues.every((v) => entityTextValues.includes(v))) {
          Logger.log(
            `[Entity] hasMatchingEntityLoggedInPastHour: match found on entity ${entity.id}`,
            { entityTextValues, textValues }
          );
          return ok(true);
        }
      }

      return ok(false);
    } catch (error) {
      return err(
        new Error("Failed to check for matching entity", { cause: error })
      );
    }
  }

  static async suggestionExists(
    entityId: number
  ): Promise<Result<boolean, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId, suggestion: true },
        select: { id: true },
      });
      return ok(entity !== null);
    } catch (error) {
      return err(
        new Error("Failed to check suggestion existence", { cause: error })
      );
    }
  }

  static async acceptSuggestion(
    entityId: number
  ): Promise<Result<void, Error>> {
    try {
      await prisma.entity.update({
        where: { id: entityId, suggestion: true },
        data: { published: true, suggestion: false },
      });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to accept suggestion", { cause: error }));
    }
  }

  static async replaceProperties(
    entityId: number,
    properties: EntityProperty[],
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

      const propertyConfigsRes = await Entity.getPropertyConfigs(
        uniqueConfigIds
      );
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

      await Entity.deletePropertiesByConfigIds(
        entityId,
        uniqueConfigIds,
        dataTypes
      );

      const newProperties = properties.map((p) => ({ ...p, id: 0 }));
      await Entity.syncEntityProperties(entityId, newProperties, [], timeZone);
      return ok(null);
    } catch (error) {
      return err(error);
    }
  }
}
