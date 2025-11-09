import { err, ok, Result } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "..";
import {
  ExportEntityConfigData,
  ExportDataContents,
} from "api-spec/models/Data";
import {
  ImportEntityConfigMap,
  ImportEntityPropertyConfigMap,
} from "../models/Data";
import { Tagging } from "./Tagging";
import { Entity } from "./Entity";
import { ListConfig } from "./ListConfig";
import {
  ListFilterTimeType,
  ListSortNativeProperty,
  ListSortDirection,
} from "api-spec/models/List";

export class Data {
  static async reset(): Promise<Result<null, Error>> {
    try {
      await prisma.$executeRaw`TRUNCATE TABLE "ListConfig" CASCADE`;
      await prisma.$executeRaw`TRUNCATE TABLE "Entity" CASCADE`;
      await prisma.$executeRaw`TRUNCATE TABLE "PropertyConfig" CASCADE`;
      await prisma.$executeRaw`TRUNCATE TABLE "EntityConfig" CASCADE`;
      return ok(null);
    } catch (err) {
      return err(new Error("Failed to reset data"));
    }
  }

  static async import(
    userId: string,
    data: ExportDataContents,
    timeZone: number
  ): Promise<Result<null, Error>> {
    try {
      console.log("userId:", userId);
      console.log("data:", data);

      const entityConfigMap: ImportEntityConfigMap = {};
      const entityPropertyConfigMap: ImportEntityPropertyConfigMap = {};

      for (const config of data.entityConfigs) {
        const entityConfig = await prisma.entityConfig.create({
          data: {
            userId,
            name: config.name,
            description: config.description || null,
            allowPropertyOrdering: config.allowPropertyOrdering,
          },
        });

        entityConfigMap[config.id] = entityConfig.id;

        for (const property of config.properties) {
          const entityProperty = await prisma.propertyConfig.create({
            data: {
              userId,
              name: property.name,
              dataType: property.dataType,
              repeat: property.repeat,
              allowed: property.allowed,
              required: property.required,
              prefix: property.prefix,
              suffix: property.suffix,
              hidden: property.hidden,
              entityConfigId: entityConfig.id,
            },
          });

          entityPropertyConfigMap[property.id] = entityProperty.id;
        }
      }

      for (const entity of data.entities) {
        const prismaEntity = await prisma.entity.create({
          data: {
            userId,
            entityConfigId: entityConfigMap[entity.type],
            createdAt: new Date(entity.createdAt),
            updatedAt: new Date(entity.updatedAt),
          },
        });

        Tagging.syncEntityTags(prismaEntity.id, entity.tags);
        await Entity.syncEntityProperties(
          prismaEntity.id,
          entity.properties.map((p) => ({
            id: 0,
            value: p.value,
            order: p.order,
            propertyConfigId: entityPropertyConfigMap[p.propertyConfigId],
          })),
          [],
          timeZone
        );
      }

      for (const listConfig of data.listConfigs) {
        const id = uuidv4();
        const prismaListConfig = await prisma.listConfig.create({
          data: {
            id,
            userId,
            name: listConfig.name,
            filter: {
              create: {
                includeAll: true,
                includeUntagged: true,
                includeAllTagging: true,
                time: { create: { type: ListFilterTimeType.ALL_TIME } },
              },
            },
            sort: {
              create: {
                property: ListSortNativeProperty.CREATED_AT,
                direction: ListSortDirection.DESC,
              },
            },
          },
        });

        await ListConfig.updateSort(prismaListConfig.id, listConfig.sort);
        await ListConfig.updateTags(
          prismaListConfig.id,
          listConfig.filter.tagging
        );
        await ListConfig.updateTime(
          prismaListConfig.id,
          listConfig.filter.time
        );
        await ListConfig.updateText(
          prismaListConfig.id,
          listConfig.filter.text
        );
        await ListConfig.updateTypes(
          prismaListConfig.id,
          listConfig.filter.includeTypes
        );
        await ListConfig.updateFilter(prismaListConfig.id, listConfig.filter);
      }

      return ok(null);
    } catch (error) {
      return err(error);
    }
  }
}
