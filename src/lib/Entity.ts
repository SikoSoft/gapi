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
  EntityBodyPayload,
  EntityList,
  EntityListParams,
  ContextEntities,
  entityInclude,
} from "../models/Entity";
import {
  DataType,
  EntityProperty,
} from "api-spec/models/Entity";
import { Access, Entity as EntitySpec } from "api-spec/models";
import { Util } from "./Util";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";
import { PropertyConfig } from "./PropertyConfig";
import { ValidationError } from "../errors/ValidationError";
import { AccessError } from "../errors/AccessError";
import { Hook } from "./Hook";
import { HookType } from "../models/Hook";
import { EntityMapper } from "./EntityMapper";
import { EntityProperty as EntityPropLib } from "./EntityProperty";

export class Entity {
  static async mergePropertiesIntoEntity(
    existingEntityId: number,
    incomingProperties: EntityProperty[],
    timeZone: number
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const calculatedIds = await EntityPropLib.getCalculatedConfigIds(
        incomingProperties.map((p) => p.propertyConfigId)
      );
      const regularIncoming = incomingProperties.filter(
        (p) => !calculatedIds.has(p.propertyConfigId)
      );
      const calculatedIncoming = incomingProperties.filter((p) =>
        calculatedIds.has(p.propertyConfigId)
      );

      const dataTypesRes =
        await EntityPropLib.getDataTypesForProperties(regularIncoming);
      if (dataTypesRes.isErr()) {
        return err(dataTypesRes.error);
      }
      const dataTypes = dataTypesRes.value;

      const propertiesToAdd: EntityProperty[] = [];
      for (const property of regularIncoming) {
        const dataType = dataTypes[property.propertyConfigId];
        if (!dataType) {
          continue;
        }
        const existingCount = await EntityPropLib.countExistingProperties(
          existingEntityId,
          property.propertyConfigId,
          dataType
        );
        if (existingCount === 0) {
          propertiesToAdd.push({ ...property, id: 0 });
        }
      }

      if (propertiesToAdd.length > 0) {
        await EntityPropLib.syncEntityProperties(
          existingEntityId,
          propertiesToAdd,
          [],
          timeZone
        );
      }

      for (const property of calculatedIncoming) {
        await prisma.entityCalculatedProperty.upsert({
          where: {
            entityId_propertyConfigId: {
              entityId: existingEntityId,
              propertyConfigId: property.propertyConfigId,
            },
          },
          update: {},
          create: {
            entityId: existingEntityId,
            propertyConfigId: property.propertyConfigId,
            order: property.order,
          },
        });
      }

      return Entity.getEntity(existingEntityId);
    } catch (error) {
      return err(
        new Error("Failed to merge properties into entity", { cause: error })
      );
    }
  }

  static async create(
    userId: string,
    data: EntityBodyPayload
  ): Promise<Result<EntitySpec.Entity, Error>> {
    try {
      const properties = data.properties ?? [];
      const calculatedIds = await EntityPropLib.getCalculatedConfigIds(
        properties.map((p) => p.propertyConfigId)
      );
      const regularProps = properties.filter(
        (p) => !calculatedIds.has(p.propertyConfigId)
      );
      const calculatedProps = properties.filter((p) =>
        calculatedIds.has(p.propertyConfigId)
      );

      const propertyConfigs = await EntityPropLib.getPropertyConfigs(
        regularProps.map((p) => p.propertyConfigId)
      );
      if (propertyConfigs.isErr()) {
        return err(propertyConfigs.error);
      }

      const validation = EntityPropLib.validateDataAgainstPropertyConfigs(
        regularProps,
        propertyConfigs.value
      );
      if (validation.isErr()) {
        return err(validation.error);
      }

      if (data.entityConfigId !== undefined) {
        const uniqueCheck = await EntityPropLib.checkUniqueConstraints(
          data.entityConfigId,
          regularProps
        );
        if (uniqueCheck.isErr()) {
          return err(uniqueCheck.error);
        }
        if (uniqueCheck.value !== null) {
          return Entity.mergePropertiesIntoEntity(
            uniqueCheck.value,
            properties,
            data.timeZone ?? 0
          );
        }
      }

      await Hook.trigger({ type: HookType.PRE_CREATE, userId, data });

      const entity = await prisma.entity.create({
        data: {
          userId: data.userId ?? userId,
          entityConfigId: data.entityConfigId,
          published: data.published ?? false,
          suggested: data.suggested ?? false,
          identified: data.identified ?? false,
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
      await EntityPropLib.syncEntityProperties(
        entity.id,
        regularProps,
        [],
        data.timeZone ?? 0
      );
      if (calculatedProps.length > 0) {
        await EntityPropLib.syncAllCalculatedEntityProperties(
          entity.id,
          calculatedProps
        );
      }

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
      await Hook.trigger({
        type: HookType.PRE_UPDATE,
        userId,
        entityId: id,
        data,
      });

      const properties = data.properties ?? [];

      if (properties.length > 0) {
        const calculatedIds = await EntityPropLib.getCalculatedConfigIds(
          properties.map((p) => p.propertyConfigId)
        );
        const regularProps = properties.filter(
          (p) => !calculatedIds.has(p.propertyConfigId)
        );
        const calculatedProps = properties.filter((p) =>
          calculatedIds.has(p.propertyConfigId)
        );

        if (regularProps.length > 0) {
          const propertyConfigs = await EntityPropLib.getPropertyConfigs(
            regularProps.map((p) => p.propertyConfigId)
          );
          if (propertyConfigs.isErr()) {
            return err(propertyConfigs.error);
          }

          const validation = EntityPropLib.validateDataAgainstPropertyConfigs(
            regularProps,
            propertyConfigs.value
          );
          if (validation.isErr()) {
            return err(validation.error);
          }

          if (data.entityConfigId !== undefined) {
            const uniqueCheck = await EntityPropLib.checkUniqueConstraints(
              data.entityConfigId,
              regularProps,
              id
            );
            if (uniqueCheck.isErr()) {
              return err(uniqueCheck.error);
            }
            if (uniqueCheck.value !== null) {
              return err(
                new ValidationError(
                  `An entity with this combination of properties already exists`
                )
              );
            }
          }

          await EntityPropLib.syncEntityProperties(
            id,
            regularProps,
            data.propertyReferences ?? [],
            data.timeZone ?? 0
          );
        }

        const replaceResult = await EntityPropLib.replaceCalculatedEntityProperties(
          id,
          calculatedProps
        );
        if (replaceResult.isErr()) {
          return err(replaceResult.error);
        }
      }

      if (data.tags !== undefined) {
        Tagging.syncEntityTags(id, data.tags);
      }

      if (
        data.published !== undefined ||
        data.suggested !== undefined ||
        data.identified !== undefined
      ) {
        await prisma.entity.update({
          where: { id, userId },
          data: {
            ...(data.published !== undefined && { published: data.published }),
            ...(data.suggested !== undefined && {
              suggested: data.suggested,
            }),
            ...(data.identified !== undefined && {
              identified: data.identified,
            }),
          },
        });
      }

      const entityRes = await Entity.getEntity(id);
      if (entityRes.isErr()) {
        return err(entityRes.error);
      }

      await Hook.trigger({
        type: HookType.POST_UPDATE,
        userId,
        entityId: id,
        data,
      });

      return ok(entityRes.value);
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
      return ok(await EntityMapper.computeAndAugmentSpec(entity));
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
        return ok(await EntityMapper.computeAndAugmentSpec(entity));
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

      return ok(await EntityMapper.computeAndAugmentSpec(entity));
    } catch (error) {
      return err(error);
    }
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

    if (filter.includeTypes && filter.includeTypes.length > 0) {
      const calculatedConfigs =
        await PropertyConfig.resolveCalculatedPropertyConfigs(
          filter.includeTypes
        );
      listQuery.setCalculatedPropertyConfigs(calculatedConfigs);
    }

    try {
      const total = await listQuery.runCountQuery();
      const entities = (await listQuery.runQuery()).map((entity) =>
        EntityMapper.toSpec(entity)
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
      entities = await Promise.all(
        (
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
        ).map((entity) => EntityMapper.computeAndAugmentSpec(entity))
      );
      return ok(entities);
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

      return ok(await EntityMapper.computeAndAugmentSpec(entity));
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
}
