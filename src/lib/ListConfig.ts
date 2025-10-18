import { Result, err, ok } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import { List } from "api-spec/models";
import { prisma } from "..";
import { PrismaListConfig } from "../models/ListConfig";
import {
  ListFilterTimeType,
  ListFilterType,
  ListSortDirection,
  ListSortProperty,
} from "api-spec/models/List";
import { Settings } from "api-spec/models/Setting";
import { Setting } from "./Setting";
import { setting } from "../functions/setting";

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
              property: ListSortProperty.CREATED_AT,
              direction: ListSortDirection.DESC,
            },
          },
        },
        include: {
          filter: {
            include: {
              time: true,
              text: true,
              tagging: true,
              includeTypes: true,
            },
          },
          sort: true,
          setting: {
            include: {
              numberSettings: true,
              textSettings: true,
              booleanSettings: true,
            },
          },
        },
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
      await prisma.listConfig.delete({
        where: { userId, id: listConfigId },
      });
      return ok(true);
    } catch (error) {
      return err(new Error("Failed to delete listConfig", { cause: error }));
    }
  }

  static async update(
    userId: string,
    listConfig: Omit<List.ListConfig, "setting">
  ): Promise<Result<List.ListConfig, Error>> {
    try {
      await prisma.listConfig.update({
        data: {
          id: listConfig.id,
          name: listConfig.name,
        },
        where: {
          id: listConfig.id,
          userId,
        },
      });

      await ListConfig.updateSort(listConfig.id, listConfig.sort);
      await ListConfig.updateTags(listConfig.id, listConfig.filter.tagging);
      await ListConfig.updateTime(listConfig.id, listConfig.filter.time);
      await ListConfig.updateText(listConfig.id, listConfig.filter.text);
      await ListConfig.updateTypes(
        listConfig.id,
        listConfig.filter.includeTypes
      );
      await ListConfig.updateFilter(listConfig.id, listConfig.filter);
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
    listConfigId: string,
    sort: List.ListSort
  ): Promise<Result<null, Error>> {
    try {
      await prisma.listSort.update({
        where: {
          listConfigId,
        },
        data: {
          ...sort,
        },
      });
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

  static async getById(id: string): Promise<Result<List.ListConfig, Error>> {
    try {
      const listConfig = await prisma.listConfig.findFirstOrThrow({
        where: { id },
        include: {
          filter: {
            include: {
              time: true,
              text: true,
              tagging: true,
              includeTypes: true,
            },
          },
          sort: true,
          setting: {
            include: {
              numberSettings: true,
              textSettings: true,
              booleanSettings: true,
            },
          },
        },
      });

      return ok(ListConfig.mapDataToSpec(listConfig));
    } catch (error) {
      return err(new Error("Failed to get listConfig", { cause: error }));
    }
  }

  static async getByUser(
    userId: string
  ): Promise<Result<List.ListConfig[], Error>> {
    try {
      const listConfigs = await prisma.listConfig.findMany({
        where: { userId },
        include: {
          filter: {
            include: {
              time: true,
              text: true,
              tagging: true,
              includeTypes: true,
            },
          },
          sort: true,
          setting: {
            include: {
              numberSettings: true,
              textSettings: true,
              booleanSettings: true,
            },
          },
        },
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

  static mapFilterDataToSpec(
    data: PrismaListConfig["filter"]
  ): List.ListFilter {
    return {
      includeAll: data.includeAll,
      includeUntagged: data.includeUntagged,
      includeAllTagging: data.includeAllTagging,
      includeTypes: ListConfig.mapFilterTypesDataToSpec(data.includeTypes),
      tagging: ListConfig.mapFilterTagsDataToSpec(data.tagging),
      text: ListConfig.mapTextDataToSpec(data.text),
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
    return {
      property: data.property as List.ListSortProperty,
      direction: data.direction as List.ListSortDirection,
    };
  }

  static mapSortSpecToData(
    listConfigId: string,
    spec: List.ListSort
  ): PrismaListConfig["sort"] {
    return {
      property: spec.property,
      direction: spec.direction,
      listConfigId,
    };
  }

  static mapSettingDataToSpec(data: PrismaListConfig["setting"]): Settings {
    return Setting.mapDataToSpec(data);
  }

  static mapDataToSpec(data: PrismaListConfig): List.ListConfig {
    return {
      id: data.id,
      name: data.name,
      filter: ListConfig.mapFilterDataToSpec(data.filter),
      sort: ListConfig.mapSortDataToSpec(data.sort),
      setting: ListConfig.mapSettingDataToSpec(data.setting),
    };
  }
}
