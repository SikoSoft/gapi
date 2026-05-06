import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { Entity, Access } from "api-spec/models";
import {
  EntityConfigCreateBody,
  EntityConfigUpdateBody,
  PrismaEntityConfig,
} from "../models/Entity";
import { CommonEntityPropertyConfig, DataType } from "api-spec/models/Entity";
import { PrismaPropertyConfig } from "../models/PropertyConfig";
import { PropertyConfig } from "./PropertyConfig";
import { AccessPolicy } from "./AccessPolicy";
import { AccessError } from "../errors/AccessError";

const entityConfigInclude = {
  properties: {
    orderBy: { entityPropertyConfigOrder: { order: "asc" as const } },
    include: {
      defaultBooleanValue: { include: { booleanValue: true } },
      defaultDateValue: { include: { dateValue: true } },
      defaultIntValue: { include: { intValue: true } },
      defaultImageValue: { include: { imageValue: true } },
      defaultLongTextValue: { include: { longTextValue: true } },
      defaultShortTextValue: { include: { shortTextValue: true } },
      optionsShortText: true,
      optionsInt: true,
    },
  },
  accessPolicy: {
    include: {
      viewAccessPolicy: { include: { parties: true } },
      editAccessPolicy: { include: { parties: true } },
    },
  },
} as const;

export class EntityConfig {
  static async isEditAllowed(
    userId: string,
    entityConfigId: number
  ): Promise<Result<boolean, Error>> {
    try {
      const entityConfig = await prisma.entityConfig.findUnique({
        where: { id: entityConfigId },
        select: {
          userId: true,
          accessPolicy: {
            select: {
              editAccessPolicy: {
                select: {
                  parties: {
                    select: { type: true, userId: true, groupId: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!entityConfig) {
        return ok(false);
      }
      if (entityConfig.userId === userId) {
        return ok(true);
      }

      const editPolicy = entityConfig.accessPolicy?.editAccessPolicy;
      if (!editPolicy) {
        return ok(false);
      }

      const hasDirectAccess = editPolicy.parties.some(
        (p) => p.type === "user" && p.userId === userId
      );
      if (hasDirectAccess) {
        return ok(true);
      }

      const groupIds = editPolicy.parties
        .filter((p) => p.type === "group" && p.groupId !== null)
        .map((p) => p.groupId as number);

      if (groupIds.length === 0) {
        return ok(false);
      }

      const groupMembership = await prisma.accessPolicyGroupUser.count({
        where: { userId, groupId: { in: groupIds } },
      });

      return ok(groupMembership > 0);
    } catch (error) {
      return err(new Error("Failed to check edit access", { cause: error }));
    }
  }

  static async create(
    userId: string,
    entityConfig: EntityConfigCreateBody
  ): Promise<Result<Entity.EntityConfig, Error>> {
    try {
      const createdEntityConfig = await prisma.entityConfig.create({
        data: {
          name: entityConfig.name,
          description: entityConfig.description,
          userId,
          aiEnabled: entityConfig.aiEnabled ?? false,
          aiIdentifyPrompt: entityConfig.aiIdentifyPrompt,
          public: entityConfig.public ?? false,
          ...(entityConfig.revisionOf
            ? { revision: { connect: { id: entityConfig.revisionOf } } }
            : {}),
        },
        include: entityConfigInclude,
      });
      return ok(EntityConfig.mapDataToSpec(createdEntityConfig));
    } catch (error) {
      return err(new Error("Failed to create entityConfig", { cause: error }));
    }
  }

  static async delete(
    userId: string,
    entityConfigId: number
  ): Promise<Result<boolean, Error>> {
    try {
      await prisma.entityConfig.delete({
        where: { userId, id: entityConfigId },
      });
      return ok(true);
    } catch (error) {
      return err(new Error("Failed to delete entityConfig", { cause: error }));
    }
  }

  static async update(
    userId: string,
    entityConfig: EntityConfigUpdateBody
  ): Promise<Result<Entity.EntityConfig, Error>> {
    try {
      const isAllowed = await EntityConfig.isEditAllowed(
        userId,
        entityConfig.id
      );
      if (isAllowed.isErr()) {
        return err(isAllowed.error);
      }
      if (!isAllowed.value) {
        return err(
          new AccessError("Not authorized to edit this entity config")
        );
      }

      const updatedEntityConfig = await prisma.entityConfig.update({
        data: {
          name: entityConfig.name,
          description: entityConfig.description,
          allowPropertyOrdering: entityConfig.allowPropertyOrdering,
          aiEnabled: entityConfig.aiEnabled,
          aiIdentifyPrompt: entityConfig.aiIdentifyPrompt,
          public: entityConfig.public,
        },
        where: { id: entityConfig.id },
        include: entityConfigInclude,
      });
      return ok(EntityConfig.mapDataToSpec(updatedEntityConfig));
    } catch (error) {
      return err(new Error("Failed to update entityConfig", { cause: error }));
    }
  }

  static async getById(
    id: number
  ): Promise<Result<Entity.EntityConfig, Error>> {
    try {
      const entityConfig = await prisma.entityConfig.findFirstOrThrow({
        where: { id },
        include: entityConfigInclude,
      });

      return ok(EntityConfig.mapDataToSpec(entityConfig));
    } catch (error) {
      return err(new Error("Failed to get entityConfig", { cause: error }));
    }
  }

  static async getByIds(
    ids: number[]
  ): Promise<Result<Entity.EntityConfig[], Error>> {
    try {
      const entityConfigs = await prisma.entityConfig.findMany({
        where: { id: { in: ids } },
        include: entityConfigInclude,
      });

      return ok(
        entityConfigs.map((entityConfig) =>
          EntityConfig.mapDataToSpec(entityConfig)
        )
      );
    } catch (error) {
      return err(new Error("Failed to get entityConfig", { cause: error }));
    }
  }

  static async getByUser(
    userId: string
  ): Promise<Result<Entity.EntityConfig[], Error>> {
    try {
      const userGroups = await prisma.accessPolicyGroupUser.findMany({
        where: { userId },
        select: { groupId: true },
      });
      const groupIds = userGroups.map((g) => g.groupId);

      const entityConfigs = await prisma.entityConfig.findMany({
        where: {
          OR: [
            { userId },
            { public: true },
            {
              accessPolicy: {
                viewAccessPolicy: {
                  parties: { some: { type: "user", userId } },
                },
              },
            },
            ...(groupIds.length > 0
              ? [
                  {
                    accessPolicy: {
                      viewAccessPolicy: {
                        parties: {
                          some: { type: "group", groupId: { in: groupIds } },
                        },
                      },
                    },
                  },
                ]
              : []),
          ],
        },
        include: entityConfigInclude,
        orderBy: { name: "asc" },
      });

      if (!entityConfigs) {
        return ok([]);
      }

      return ok(
        entityConfigs.map((entityConfig) =>
          EntityConfig.mapDataToSpec(entityConfig)
        )
      );
    } catch (error) {
      console.error(
        `Failed to retrieve entityConfigs for user ${userId}`,
        error
      );
      return err(
        new Error("Failed to retrieve entityConfigs", { cause: error })
      );
    }
  }

  static async getAll(): Promise<Result<Entity.EntityConfig[], Error>> {
    try {
      const entityConfigs = await prisma.entityConfig.findMany({
        include: entityConfigInclude,
        orderBy: { name: "asc" },
      });

      return ok(
        entityConfigs.map((entityConfig) =>
          EntityConfig.mapDataToSpec(entityConfig)
        )
      );
    } catch (error) {
      return err(
        new Error("Failed to retrieve all entityConfigs", { cause: error })
      );
    }
  }

  static async syncProperties(
    userId: string,
    entityConfig: Entity.EntityConfig
  ): Promise<Result<void, Error>> {
    try {
      await prisma.entityConfig.update({
        where: { id: entityConfig.id, userId },
        data: {
          properties: {
            create: entityConfig.properties,
          },
        },
      });
      return ok(undefined);
    } catch (error) {
      return err(
        new Error("Failed to sync entityConfig properties", { cause: error })
      );
    }
  }

  static mapDataToSpec(data: PrismaEntityConfig): Entity.EntityConfig {
    let viewAccessPolicy: Access.AccessPolicy | null = null;
    if (data.accessPolicy?.viewAccessPolicy) {
      viewAccessPolicy = AccessPolicy.mapDataToSpec(
        data.accessPolicy.viewAccessPolicy
      );
    }

    let editAccessPolicy: Access.AccessPolicy | null = null;
    if (data.accessPolicy?.editAccessPolicy) {
      editAccessPolicy = AccessPolicy.mapDataToSpec(
        data.accessPolicy.editAccessPolicy
      );
    }

    return {
      id: data.id,
      userId: data.userId,
      name: data.name,
      description: data.description,
      properties: data.properties.map((property) =>
        EntityConfig.mapPropertyDataToSpec(property)
      ),
      revisionOf: data.revisionOf,
      allowPropertyOrdering: data.allowPropertyOrdering,
      aiEnabled: data.aiEnabled,
      aiIdentifyPrompt: data.aiIdentifyPrompt,
      public: data.public,
      viewAccessPolicy,
      editAccessPolicy,
    };
  }

  static mapPropertyDataToSpec(
    data: PrismaPropertyConfig
  ): Entity.EntityPropertyConfig {
    return PropertyConfig.mapDataToSpec(data);
  }
}
