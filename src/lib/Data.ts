import { err, ok, Result } from "neverthrow";
import { prisma } from "..";
import { ExportConfigData, ExportDataContents } from "api-spec/models/Data";
import {
  ImportEntityConfigMap,
  ImportEntityPropertyConfigMap,
} from "../models/Data";
import { Tagging } from "./Tagging";
import { Entity } from "./Entity";

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

      for (const config of data.configs) {
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
          timeZone
        );
      }

      return ok(null);
    } catch (error) {
      return err(error);
    }
  }
}
