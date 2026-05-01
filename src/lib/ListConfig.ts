import { Result, err, ok } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import { List, Access, Entity } from "api-spec/models";
import { prisma } from "..";
import {
  PrismaListConfig,
  prismaListConfigInclude,
} from "../models/ListConfig";
import {
  ListFilterTimeType,
  ListFilterType,
  ListSortCustomProperty,
  ListSortDirection,
  ListSortNativeProperty,
  ListSortProperty,
} from "api-spec/models/List";
import { Settings } from "api-spec/models/Setting";
import { Setting } from "./Setting";
import { AccessPolicy } from "./AccessPolicy";
import { AccessError } from "../errors/AccessError";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";

export class ListConfig {
  static async create(
    userId: string,
    name: string
  ): Promise<Result<List.ListConfig, Error>> {
    try {
      const id = uuidv4();
      const created = await prisma.listConfig.create({
        data: {
          id,
          name,
          userId,
          //public: false,
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
        include: prismaListConfigInclude,
      });

      return ok(ListConfig.mapDataToSpec(created));
    } catch (error) {
      return err(new Error("Failed to create listConfig", { cause: error }));
    }
  }

  static async delete(
    userId: string,
    listConfigId: string
  ): Promise<Result<boolean, Error>> {
    try {
      const listConfigPolicy = await prisma.listConfigAccessPolicy.findUnique({
        where: { listConfigId },
      });

      await prisma.listConfig.delete({
        where: { userId, id: listConfigId },
      });

      if (listConfigPolicy) {
        const policyIds = [
          listConfigPolicy.viewAccessPolicyId,
          listConfigPolicy.editAccessPolicyId,
        ].filter((id): id is number => id !== null);

        for (const policyId of [...new Set(policyIds)]) {
          const [entityCount, listConfigCount] = await Promise.all([
            prisma.entityAccessPolicy.count({
              where: {
                OR: [
                  { viewAccessPolicyId: policyId },
                  { editAccessPolicyId: policyId },
                ],
              },
            }),
            prisma.listConfigAccessPolicy.count({
              where: {
                OR: [
                  { viewAccessPolicyId: policyId },
                  { editAccessPolicyId: policyId },
                ],
              },
            }),
          ]);
          if (entityCount === 0 && listConfigCount === 0) {
            await prisma.accessPolicy.delete({ where: { id: policyId } });
          }
        }
      }

      return ok(true);
    } catch (error) {
      return err(new Error("Failed to delete listConfig", { cause: error }));
    }
  }

  static async deleteWithItems(
    userId: string,
    listConfigId: string
  ): Promise<Result<boolean, Error>> {
    try {
      const listConfigRes = await ListConfig.getById(listConfigId);
      if (listConfigRes.isErr()) {
        return err(listConfigRes.error);
      }
      const listConfig = listConfigRes.value;

      const thisQuery = new EntityListQueryBuilder();
      thisQuery.setUserId(userId);
      thisQuery.setFilter(listConfig.filter);
      const thisListIds = await thisQuery.runIdsQuery();

      if (thisListIds.length > 0) {
        const allListConfigsRes = await ListConfig.getByUser(userId);
        if (allListConfigsRes.isErr()) {
          return err(allListConfigsRes.error);
        }

        const otherListConfigs = allListConfigsRes.value.filter(
          lc => lc.id !== listConfigId
        );

        const otherEntityIds = new Set<number>();
        for (const otherListConfig of otherListConfigs) {
          const otherQuery = new EntityListQueryBuilder();
          otherQuery.setUserId(userId);
          otherQuery.setFilter(otherListConfig.filter);
          const otherIds = await otherQuery.runIdsQuery();
          otherIds.forEach(id => otherEntityIds.add(id));
        }

        const idsToDelete = thisListIds.filter(id => !otherEntityIds.has(id));

        if (idsToDelete.length > 0) {
          const entityPolicies = await prisma.entityAccessPolicy.findMany({
            where: { entityId: { in: idsToDelete } },
          });

          await prisma.entity.deleteMany({
            where: { userId, id: { in: idsToDelete } },
          });

          const policyIds = [
            ...new Set(
              entityPolicies.flatMap(ep =>
                [ep.viewAccessPolicyId, ep.editAccessPolicyId].filter(
                  (id): id is number => id !== null
                )
              )
            ),
          ];

          for (const policyId of policyIds) {
            const [entityCount, listConfigCount] = await Promise.all([
              prisma.entityAccessPolicy.count({
                where: {
                  OR: [
                    { viewAccessPolicyId: policyId },
                    { editAccessPolicyId: policyId },
                  ],
                },
              }),
              prisma.listConfigAccessPolicy.count({
                where: {
                  OR: [
                    { viewAccessPolicyId: policyId },
                    { editAccessPolicyId: policyId },
                  ],
                },
              }),
            ]);
            if (entityCount === 0 && listConfigCount === 0) {
              await prisma.accessPolicy.delete({ where: { id: policyId } });
            }
          }
        }
      }

      return await ListConfig.delete(userId, listConfigId);
    } catch (error) {
      return err(
        new Error("Failed to delete listConfig with items", { cause: error })
      );
    }
  }

  static async isEditAllowed(
    userId: string,
    listConfigId: string
  ): Promise<Result<boolean, Error>> {
    try {
      const listConfig = await prisma.listConfig.findUnique({
        where: { id: listConfigId },
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

      if (!listConfig) {
        return ok(false);
      }
      if (listConfig.userId === userId) {
        return ok(true);
      }

      const editPolicy = listConfig.accessPolicy?.editAccessPolicy;
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

  static async update(
    userId: string,
    listConfig: Omit<
      List.ListConfig,
      "setting" | "viewAccessPolicy" | "editAccessPolicy"
    >
  ): Promise<Result<List.ListConfig, Error>> {
    try {
      const isAllowed = await ListConfig.isEditAllowed(userId, listConfig.id);
      if (isAllowed.isErr()) {
        return err(isAllowed.error);
      }

      if (!isAllowed.value) {
        return err(new Error("Not authorized to edit this list config"));
      }

      await prisma.listConfig.update({
        data: {
          id: listConfig.id,
          name: listConfig.name,
        },
        where: {
          id: listConfig.id,
        },
      });

      await ListConfig.updateSort(userId, listConfig.id, listConfig.sort);
      await ListConfig.updateTags(listConfig.id, listConfig.filter.tagging);
      await ListConfig.updateTime(listConfig.id, listConfig.filter.time);
      await ListConfig.updateTypes(
        listConfig.id,
        listConfig.filter.includeTypes
      );
      await ListConfig.updateFilter(listConfig.id, listConfig.filter);
      await ListConfig.updateProperties(
        listConfig.id,
        listConfig.filter.properties
      );
      const updatedRes = await ListConfig.getById(listConfig.id);
      if (updatedRes.isErr()) {
        return err(
          new Error("Failed to update listConfig", { cause: updatedRes.error })
        );
      }
      return ok(updatedRes.value);
    } catch (error) {
      return err(new Error("Failed to update listConfig", { cause: error }));
    }
  }

  static async updateSort(
    userId: string,
    listConfigId: string,
    sort: List.ListSort
  ): Promise<Result<null, Error>> {
    try {
      const isAllowed = await ListConfig.isEditAllowed(userId, listConfigId);
      if (isAllowed.isErr()) {
        return err(isAllowed.error);
      }

      if (!isAllowed.value) {
        return err(new AccessError("Not authorized to edit this list config"));
      }

      if ((sort.property as ListSortCustomProperty).propertyId !== undefined) {
        const property = sort.property as ListSortCustomProperty;
        await prisma.listSort.update({
          where: {
            listConfigId,
          },
          data: {
            propertyId: property.propertyId,
            dataType: property.dataType,
            property: null,
            direction: sort.direction,
          },
        });
        return ok(null);
      }

      const property = sort.property as ListSortNativeProperty;
      await prisma.listSort.update({
        where: {
          listConfigId,
        },
        data: {
          propertyId: null,
          dataType: null,
          property,
          direction: sort.direction,
        },
      });
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to update listConfig sort", { cause: error })
      );
    }
  }

  static async updateTags(
    listConfigId: string,
    tagging: List.TaggingContext
  ): Promise<Result<null, Error>> {
    try {
      await prisma.listFilterTag.deleteMany({ where: { listConfigId } });
      await prisma.listFilterTag.createMany({
        data: [
          ...tagging[ListFilterType.CONTAINS_ALL_OF].map((tag) => ({
            listConfigId,
            type: ListFilterType.CONTAINS_ALL_OF,
            tag,
          })),
          ...tagging[ListFilterType.CONTAINS_ONE_OF].map((tag) => ({
            listConfigId,
            type: ListFilterType.CONTAINS_ONE_OF,
            tag,
          })),
        ],
      });
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to update listConfig tags", { cause: error })
      );
    }
  }

  static async updateTypes(
    listConfigId: string,
    types: number[]
  ): Promise<Result<null, Error>> {
    console.log("Updating types:", types);
    try {
      await prisma.listFilterType.deleteMany({ where: { listConfigId } });
      await prisma.listFilterType.createMany({
        data: types.map((entityConfigId) => ({
          listConfigId,
          entityConfigId,
        })),
      });
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to update listConfig types", { cause: error })
      );
    }
  }

  static async updateText(
    listConfigId: string,
    text: List.TextContext[]
  ): Promise<Result<null, Error>> {
    try {
      await prisma.listFilterText.deleteMany({ where: { listConfigId } });
      await prisma.listFilterText.createMany({
        data: text.map((textRule) => ({
          ...textRule,
          listConfigId,
        })),
      });
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to update listConfig text", { cause: error })
      );
    }
  }

  static async updateTime(
    listConfigId: string,
    time: List.TimeContext
  ): Promise<Result<null, Error>> {
    try {
      switch (time.type) {
        case List.ListFilterTimeType.ALL_TIME:
          time = time as List.AllTimeContext;
          await prisma.listFilterTime.update({
            where: { listConfigId },
            data: {
              type: time.type,
            },
          });
        case List.ListFilterTimeType.EXACT_DATE:
          time = time as List.ExactDateContext;
          await prisma.listFilterTime.update({
            where: { listConfigId },
            data: {
              type: time.type,
              date1: time.date,
            },
          });
        case List.ListFilterTimeType.RANGE:
          time = time as List.RangeContext;
          await prisma.listFilterTime.update({
            where: { listConfigId },
            data: {
              type: time.type,
              date1: time.start,
              date2: time.end,
            },
          });
      }

      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to update listConfig time", { cause: error })
      );
    }
  }

  static async updateFilter(
    listConfigId: string,
    filter: List.ListFilter
  ): Promise<Result<null, Error>> {
    try {
      await prisma.listFilter.update({
        where: { listConfigId },
        data: {
          includeAll: filter.includeAll,
          includeUntagged: filter.includeUntagged,
          includeAllTagging: filter.includeAllTagging,
        },
      });
      return ok(null);
    } catch (error) {
      return err(new Error("Failed to update list filter", { cause: error }));
    }
  }

  static async updateProperties(
    listConfigId: string,
    properties: List.FilterProperty[]
  ): Promise<Result<null, Error>> {
    try {
      const [existingBoolean, existingDate, existingImage, existingInt, existingLongText, existingShortText] =
        await Promise.all([
          prisma.listFilterBooleanProperty.findMany({ where: { listConfigId }, select: { propertyValueId: true } }),
          prisma.listFilterDateProperty.findMany({ where: { listConfigId }, select: { propertyValueId: true } }),
          prisma.listFilterImageProperty.findMany({ where: { listConfigId }, select: { propertyValueId: true } }),
          prisma.listFilterIntProperty.findMany({ where: { listConfigId }, select: { propertyValueId: true } }),
          prisma.listFilterLongTextProperty.findMany({ where: { listConfigId }, select: { propertyValueId: true } }),
          prisma.listFilterShortTextProperty.findMany({ where: { listConfigId }, select: { propertyValueId: true } }),
        ]);

      await Promise.all([
        prisma.listFilterBooleanProperty.deleteMany({ where: { listConfigId } }),
        prisma.listFilterDateProperty.deleteMany({ where: { listConfigId } }),
        prisma.listFilterImageProperty.deleteMany({ where: { listConfigId } }),
        prisma.listFilterIntProperty.deleteMany({ where: { listConfigId } }),
        prisma.listFilterLongTextProperty.deleteMany({ where: { listConfigId } }),
        prisma.listFilterShortTextProperty.deleteMany({ where: { listConfigId } }),
      ]);

      const booleanValueIds = existingBoolean.map(p => p.propertyValueId);
      const dateValueIds = existingDate.map(p => p.propertyValueId);
      const imageValueIds = existingImage.map(p => p.propertyValueId);
      const intValueIds = existingInt.map(p => p.propertyValueId);
      const longTextValueIds = existingLongText.map(p => p.propertyValueId);
      const shortTextValueIds = existingShortText.map(p => p.propertyValueId);

      await Promise.all([
        booleanValueIds.length > 0 && prisma.booleanPropertyValue.deleteMany({ where: { id: { in: booleanValueIds } } }),
        dateValueIds.length > 0 && prisma.datePropertyValue.deleteMany({ where: { id: { in: dateValueIds } } }),
        imageValueIds.length > 0 && prisma.imagePropertyValue.deleteMany({ where: { id: { in: imageValueIds } } }),
        intValueIds.length > 0 && prisma.intPropertyValue.deleteMany({ where: { id: { in: intValueIds } } }),
        longTextValueIds.length > 0 && prisma.longTextPropertyValue.deleteMany({ where: { id: { in: longTextValueIds } } }),
        shortTextValueIds.length > 0 && prisma.shortTextPropertyValue.deleteMany({ where: { id: { in: shortTextValueIds } } }),
      ]);

      if (properties.length === 0) {
        return ok(null);
      }

      const propertyConfigIds = [...new Set(properties.map(p => p.propertyId))];
      const propertyConfigs = await prisma.propertyConfig.findMany({
        where: { id: { in: propertyConfigIds } },
        select: { id: true, dataType: true },
      });
      const propertyConfigMap = new Map(propertyConfigs.map(pc => [pc.id, pc.dataType]));

      for (const property of properties) {
        const dataType = propertyConfigMap.get(property.propertyId);
        if (!dataType) {
          continue;
        }

        switch (dataType) {
          case Entity.DataType.BOOLEAN: {
            const booleanValue = await prisma.booleanPropertyValue.create({ data: { value: property.value as boolean } });
            await prisma.listFilterBooleanProperty.create({
              data: { listConfigId, propertyConfigId: property.propertyId, propertyValueId: booleanValue.id },
            });
            break;
          }
          case Entity.DataType.DATE: {
            const dateValue = await prisma.datePropertyValue.create({ data: { value: property.value as Date } });
            await prisma.listFilterDateProperty.create({
              data: { listConfigId, propertyConfigId: property.propertyId, propertyValueId: dateValue.id },
            });
            break;
          }
          case Entity.DataType.IMAGE: {
            const imgVal = property.value as Entity.ImageDataValue;
            const imageValue = await prisma.imagePropertyValue.create({ data: { url: imgVal.src, altText: imgVal.alt } });
            await prisma.listFilterImageProperty.create({
              data: { listConfigId, propertyConfigId: property.propertyId, propertyValueId: imageValue.id },
            });
            break;
          }
          case Entity.DataType.INT: {
            const intValue = await prisma.intPropertyValue.create({ data: { value: property.value as number } });
            await prisma.listFilterIntProperty.create({
              data: { listConfigId, propertyConfigId: property.propertyId, propertyValueId: intValue.id },
            });
            break;
          }
          case Entity.DataType.LONG_TEXT: {
            const longTextValue = await prisma.longTextPropertyValue.create({ data: { value: property.value as string } });
            await prisma.listFilterLongTextProperty.create({
              data: { listConfigId, propertyConfigId: property.propertyId, propertyValueId: longTextValue.id, operation: property.operation },
            });
            break;
          }
          case Entity.DataType.SHORT_TEXT: {
            const shortTextValue = await prisma.shortTextPropertyValue.create({ data: { value: property.value as string } });
            await prisma.listFilterShortTextProperty.create({
              data: { listConfigId, propertyConfigId: property.propertyId, propertyValueId: shortTextValue.id, operation: property.operation },
            });
            break;
          }
        }
      }

      return ok(null);
    } catch (error) {
      return err(new Error("Failed to update listConfig properties", { cause: error }));
    }
  }

  static async getById(id: string): Promise<Result<List.ListConfig, Error>> {
    try {
      const listConfig = await prisma.listConfig.findFirstOrThrow({
        where: { id },
        include: prismaListConfigInclude,
      });

      return ok(ListConfig.mapDataToSpec(listConfig));
    } catch (error) {
      return err(new Error("Failed to get listConfig", { cause: error }));
    }
  }

  static async updateThemes(
    userId: string,
    listConfigId: string,
    themes: string[]
  ): Promise<Result<null, Error>> {
    try {
      const isAllowed = await ListConfig.isEditAllowed(userId, listConfigId);
      if (isAllowed.isErr()) {
        return err(isAllowed.error);
      }

      if (!isAllowed.value) {
        return err(new AccessError("Not authorized to edit this list config"));
      }

      await prisma.listConfigTheme.deleteMany({ where: { listConfigId } });
      await prisma.listConfigTheme.createMany({
        data: themes.map((theme, index) => ({
          listConfigId,
          theme,
          order: index,
        })),
      });
      return ok(null);
    } catch (error) {
      return err(
        new Error("Failed to update listConfig themes", { cause: error })
      );
    }
  }

  static async getByUser(
    userId: string
  ): Promise<Result<List.ListConfig[], Error>> {
    try {
      const userGroups = await prisma.accessPolicyGroupUser.findMany({
        where: { userId },
        select: { groupId: true },
      });
      const groupIds = userGroups.map((g) => String(g.groupId));

      const listConfigs = await prisma.listConfig.findMany({
        where: {
          OR: [
            { userId },
            {
              accessPolicy: {
                viewAccessPolicy: {
                  parties: {
                    some: { type: "user", userId },
                  },
                },
              },
            },
            {
              accessPolicy: {
                viewAccessPolicy: {
                  parties: {
                    some: {
                      type: "group",
                      groupId: { in: groupIds.map(Number) },
                    },
                  },
                },
              },
            },
          ],
        },
        include: prismaListConfigInclude,
        orderBy: { name: "asc" },
      });

      if (!listConfigs) {
        return ok([]);
      }

      return ok(
        listConfigs.map((listConfig) => ListConfig.mapDataToSpec(listConfig))
      );
    } catch (error) {
      return err(new Error("Failed to retrieve listConfigs", { cause: error }));
    }
  }

  static mapFilterTagsDataToSpec(
    data: PrismaListConfig["filter"]["tagging"]
  ): List.TaggingContext {
    const tagging: List.TaggingContext = {
      [List.ListFilterType.CONTAINS_ALL_OF]: [],
      [List.ListFilterType.CONTAINS_ONE_OF]: [],
    };

    data.forEach((filterTag) => {
      tagging[filterTag.type].push(filterTag.tag);
    });

    return tagging;
  }

  static mapFilterTypesDataToSpec(
    data: PrismaListConfig["filter"]["includeTypes"]
  ): List.ListFilter["includeTypes"] {
    const includeTypes: List.ListFilter["includeTypes"] = [];

    data.forEach((filterType) => {
      includeTypes.push(filterType.entityConfigId);
    });

    return includeTypes;
  }

  static mapFilterPropertiesDataToSpec(
    data: PrismaListConfig["filter"]
  ): List.FilterProperty[] {
    const properties: List.FilterProperty[] = [];

    data.booleanProperties.forEach(p => {
      properties.push({ propertyId: p.propertyConfigId, value: p.propertyValue.value, operation: List.TextType.CONTAINS });
    });
    data.dateProperties.forEach(p => {
      properties.push({ propertyId: p.propertyConfigId, value: p.propertyValue.value, operation: List.TextType.CONTAINS });
    });
    data.imageProperties.forEach(p => {
      properties.push({ propertyId: p.propertyConfigId, value: { src: p.propertyValue.url, alt: p.propertyValue.altText }, operation: List.TextType.CONTAINS });
    });
    data.intProperties.forEach(p => {
      properties.push({ propertyId: p.propertyConfigId, value: p.propertyValue.value, operation: List.TextType.CONTAINS });
    });
    data.longTextProperties.forEach(p => {
      properties.push({ propertyId: p.propertyConfigId, value: p.propertyValue.value, operation: p.operation as List.TextType });
    });
    data.shortTextProperties.forEach(p => {
      properties.push({ propertyId: p.propertyConfigId, value: p.propertyValue.value, operation: p.operation as List.TextType });
    });

    return properties;
  }

  static mapFilterDataToSpec(
    data: PrismaListConfig["filter"]
  ): List.ListFilter {
    return {
      includeAll: data.includeAll,
      includeUntagged: data.includeUntagged,
      includeAllTagging: data.includeAllTagging,
      includeTypes: ListConfig.mapFilterTypesDataToSpec(data.includeTypes),
      tagging: ListConfig.mapFilterTagsDataToSpec(data.tagging),
      properties: ListConfig.mapFilterPropertiesDataToSpec(data),
      time: ListConfig.mapTimeDataToSpec(data.time),
    };
  }

  static mapTextDataToSpec(
    data: PrismaListConfig["filter"]["text"]
  ): List.TextContext[] {
    return data.map((text) => ({
      type: text.type as List.TextType,
      subStr: text.subStr,
    }));
  }

  static mapTimeDataToSpec(
    data: PrismaListConfig["filter"]["time"]
  ): List.TimeContext {
    const timeType = data.type as List.ListFilterTimeType;
    switch (timeType) {
      case List.ListFilterTimeType.ALL_TIME:
        return {
          type: List.ListFilterTimeType.ALL_TIME,
        } as List.AllTimeContext;
      case List.ListFilterTimeType.EXACT_DATE:
        return {
          type: List.ListFilterTimeType.EXACT_DATE,
          date: data.date1,
        } as List.ExactDateContext;
      case List.ListFilterTimeType.RANGE:
        return {
          type: List.ListFilterTimeType.RANGE,
          start: data.date1,
          end: data.date2,
        } as List.RangeContext;
    }
  }

  static mapSortDataToSpec(data: PrismaListConfig["sort"]): List.ListSort {
    let property: ListSortProperty;
    if (data.propertyId && data.dataType) {
      property = {
        propertyId: data.propertyId,
        dataType: data.dataType,
      } as List.ListSortCustomProperty;
    } else {
      property = data.property as List.ListSortNativeProperty;
    }

    return {
      property,
      direction: data.direction as List.ListSortDirection,
    };
  }

  static mapSettingDataToSpec(data: PrismaListConfig["setting"]): Settings {
    return Setting.mapDataToSpec(data);
  }

  static mapThemesDataToSpec(data: PrismaListConfig["themes"]): string[] {
    return data.sort((a, b) => a.order - b.order).map((theme) => theme.theme);
  }

  static mapDataToSpec(data: PrismaListConfig): List.ListConfig {
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
      userId: data.userId,
      id: data.id,
      name: data.name,
      filter: ListConfig.mapFilterDataToSpec(data.filter),
      sort: ListConfig.mapSortDataToSpec(data.sort),
      setting: ListConfig.mapSettingDataToSpec(data.setting),
      themes: ListConfig.mapThemesDataToSpec(data.themes),
      viewAccessPolicy,
      editAccessPolicy,
    };
  }
}
