import { err, ok, Result } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "..";
import {
  ExportEntityConfigData,
  ExportDataContents,
  NukedDataType,
} from "api-spec/models/Data";
import {
  ImportEntityConfigMap,
  ImportEntityPropertyConfigMap,
} from "../models/Data";
import { Tagging } from "./Tagging";
import { Entity } from "./Entity";
import { ListConfig } from "./ListConfig";
import { PropertyConfig } from "./PropertyConfig";
import { Medal } from "./Medal";
import {
  ListFilterTimeType,
  ListSortNativeProperty,
  ListSortDirection,
} from "api-spec/models/List";
import { DataType } from "api-spec/models/Entity";
import { Revision } from "api-spec/lib/Revision";
import { EntityConfig } from "./EntityConfig";
import { Logger } from "./Logger";

export class Data {
  static async reset(
    nukedDataTypes: NukedDataType[]
  ): Promise<Result<null, Error>> {
    try {
      if (nukedDataTypes.includes(NukedDataType.LIST_CONFIGS)) {
        await prisma.$executeRaw`TRUNCATE TABLE "ListConfig" CASCADE`;
      }
      if (nukedDataTypes.includes(NukedDataType.ENTITIES)) {
        await prisma.$executeRaw`TRUNCATE TABLE "Entity" CASCADE`;
      }
      if (nukedDataTypes.includes(NukedDataType.ENTITY_CONFIGS)) {
        await prisma.$executeRaw`TRUNCATE TABLE "PropertyConfig" CASCADE`;
        await prisma.$executeRaw`TRUNCATE TABLE "EntityConfig" CASCADE`;
      }
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
      Logger.log("userId:", userId);
      //console.log("data:", data);

      const entityConfigMap: ImportEntityConfigMap = {};
      const entityPropertyConfigMap: ImportEntityPropertyConfigMap = {};
      const medalConfigMap: Record<number, number> = {};

      const entityConfigsRes = await EntityConfig.getByUser(userId);
      const entityConfigHashMap: { hash: string; id: number }[] = [];
      if (entityConfigsRes.isErr()) {
        Logger.error(
          "Failed to retrieve entity configs:",
          entityConfigsRes.error
        );
        return err(new Error("Failed to retrieve entity configs"));
      }

      const entityConfigs = entityConfigsRes.value;

      /*
      for (const config of entityConfigs.value) {
        const entityAsString = Revision.getEntityConfigAsString(config);
        const hash = entityAsString; //sha256Hex(entityAsString);
        entityConfigHashMap.push({ hash, id: config.id });
      }
        */

      Logger.log("EntityConfig Hash Map:", entityConfigHashMap);

      for (const config of data.entityConfigs) {
        const entityAsString = Revision.getEntityConfigAsString(config);
        const hash = entityAsString; //sha256Hex(entityAsString);
        Logger.log("Importing EntityConfig:\n", hash);

        const entityConfigMatch = entityConfigs.find((e) => {
          Logger.log(
            "Comparing entity config:",
            Revision.getEntityConfigAsString(e),
            "with",
            hash
          );
          return Revision.getEntityConfigAsString(e) === hash;
        });
        if (entityConfigMatch) {
          Logger.log("EntityConfig already exists, skipping:", entityAsString);
          entityConfigMap[config.id] = entityConfigMatch.id;

          for (const property of config.properties) {
            const propertyHash = Revision.getPropertyConfigAsString(property);
            const propertyConfigMatch = entityConfigMatch.properties.find(
              (e) => Revision.getPropertyConfigAsString(e) === propertyHash
            );
            if (propertyConfigMatch) {
              Logger.log(
                "EntityPropertyConfig already exists, skipping:",
                property
              );
              entityPropertyConfigMap[property.id] = propertyConfigMatch.id;
              continue;
            }
          }

          continue;
        }

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
              optionsOnly: property.optionsOnly,
              entityConfigId: entityConfig.id,
            },
          });

          if (property.options && property.options.length > 0) {
            await PropertyConfig.updateOptions(
              entityProperty.id,
              property.dataType as DataType,
              property.options as string[] | number[]
            );
          }

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
            published: entity.published,
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

        await ListConfig.updateSort(
          userId,
          prismaListConfig.id,
          listConfig.sort
        );
        if (listConfig.filter.tagging) {
          await ListConfig.updateTags(
            prismaListConfig.id,
            listConfig.filter.tagging
          );
        }
        if (listConfig.filter.time) {
          await ListConfig.updateTime(
            prismaListConfig.id,
            listConfig.filter.time
          );
        }
        await ListConfig.updateTypes(
          prismaListConfig.id,
          listConfig.filter.includeTypes ?? []
        );
        await ListConfig.updateFilter(prismaListConfig.id, listConfig.filter);
      }

      if (data.medalConfigs) {
        const existingMedalConfigsRes = await Medal.getConfigs();
        if (existingMedalConfigsRes.isErr()) {
          Logger.error(
            "Failed to retrieve medal configs:",
            existingMedalConfigsRes.error
          );
          return err(new Error("Failed to retrieve medal configs"));
        }
        const existingMedalConfigs = existingMedalConfigsRes.value;

        for (const config of data.medalConfigs) {
          const existingConfig = existingMedalConfigs.find((e) => {
            return (
              e.name === config.name &&
              e.description === config.description &&
              e.series === config.series &&
              e.recurrence === config.recurrence &&
              e.prestige === config.prestige &&
              e.icon === config.icon &&
              JSON.stringify(e.factRequests) ===
                JSON.stringify(config.factRequests) &&
              JSON.stringify(e.criteria) === JSON.stringify(config.criteria)
            );
          });

          if (existingConfig) {
            Logger.log("MedalConfig already exists, skipping:", config.name);
            medalConfigMap[config.id] = existingConfig.id;
            continue;
          }

          const createResult = await Medal.createConfig({
            name: config.name,
            description: config.description,
            series: config.series,
            recurrence: config.recurrence,
            prestige: config.prestige,
            icon: config.icon,
            factRequests: config.factRequests,
            criteria: config.criteria,
          });

          if (createResult.isErr()) {
            Logger.error(
              "Failed to create medal config:",
              createResult.error
            );
            return err(new Error("Failed to create medal config"));
          }

          medalConfigMap[config.id] = createResult.value.id;
        }
      }

      if (data.medals) {
        for (const medal of data.medals) {
          const newMedalConfigId = medalConfigMap[medal.medalConfigId];
          if (newMedalConfigId === undefined) {
            Logger.error(
              `Medal references unknown medalConfigId: ${medal.medalConfigId}, skipping`
            );
            continue;
          }

          const existingMedal = await prisma.medal.findFirst({
            where: {
              userId,
              medalConfigId: newMedalConfigId,
              awardedAt: new Date(medal.awardedAt),
            },
          });

          if (existingMedal) {
            continue;
          }

          await prisma.medal.create({
            data: {
              userId,
              medalConfigId: newMedalConfigId,
              awardedAt: new Date(medal.awardedAt),
            },
          });
        }
      }

      return ok(null);
    } catch (error) {
      return err(error);
    }
  }
}
