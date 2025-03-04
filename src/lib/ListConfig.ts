import { List } from "api-spec/models";
import { prisma } from "..";
import { PrismaListConfig } from "../models/ListConfig";
import { ListFilterType } from "api-spec/models/List";
import { Settings } from "api-spec/models/Setting";
import { Setting } from "./Setting";

export class ListConfig {
  static async delete(userId: string, listConfigId: string): Promise<boolean> {
    const result = await prisma.listConfig.delete({
      where: { userId, id: listConfigId },
    });
    if (result) {
      return true;
    }
    return false;
  }

  static async update(
    userId: string,
    listConfig: Omit<List.ListConfig, "setting">
  ): Promise<List.ListConfig> {
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
    await ListConfig.updateFilter(listConfig.id, listConfig.filter);
    return await ListConfig.getById(listConfig.id);
  }

  static async updateSort(
    listConfigId: string,
    sort: List.ListSort
  ): Promise<void> {
    await prisma.listSort.update({
      where: {
        listConfigId,
      },
      data: {
        ...sort,
      },
    });
  }

  static async updateTags(
    listConfigId: string,
    tagging: List.TaggingContext
  ): Promise<void> {
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
  }

  static async updateText(
    listConfigId: string,
    text: List.TextContext[]
  ): Promise<void> {
    await prisma.listFilterText.deleteMany({ where: { listConfigId } });
    await prisma.listFilterText.createMany({
      data: text.map((textRule) => ({
        ...textRule,
        listConfigId,
      })),
    });
  }

  static async updateTime(
    listConfigId: string,
    time: List.TimeContext
  ): Promise<void> {
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
  }

  static async updateFilter(
    listConfigId: string,
    filter: List.ListFilter
  ): Promise<void> {
    await prisma.listFilter.update({
      where: { listConfigId },
      data: {
        includeAll: filter.includeAll,
        includeUntagged: filter.includeUntagged,
        includeAllTagging: filter.includeAllTagging,
      },
    });
  }

  static async getById(id: string): Promise<List.ListConfig> {
    try {
      const listConfig = await prisma.listConfig.findFirstOrThrow({
        where: { id },
        include: {
          filter: {
            include: {
              time: true,
              text: true,
              tagging: true,
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

      return ListConfig.mapDataToSpec(listConfig);
    } catch (error) {
      console.error(`Failed to get listConfig by id ${id}`, error);
    }
  }

  static async getByUser(userId: string): Promise<List.ListConfig[]> {
    try {
      const listConfigs = await prisma.listConfig.findMany({
        where: { userId },
        include: {
          filter: {
            include: {
              time: true,
              text: true,
              tagging: true,
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
        return [];
      }

      return listConfigs.map((listConfig) =>
        ListConfig.mapDataToSpec(listConfig)
      );
    } catch (error) {
      console.error(`Failed to retrieve listConfigs for user ${userId}`, error);
      return [];
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

  static mapFilterDataToSpec(
    data: PrismaListConfig["filter"]
  ): List.ListFilter {
    return {
      includeAll: data.includeAll,
      includeUntagged: data.includeUntagged,
      includeAllTagging: data.includeAllTagging,
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
