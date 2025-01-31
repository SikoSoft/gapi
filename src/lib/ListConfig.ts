import { List } from "api-spec/models";
import { prisma } from "..";
import { PrismaListConfig, PrismaListFilter } from "../models/ListConfig";
import { ListContextType, ListFilterType } from "api-spec/models/List";

export class ListConfig {
  static async update(
    userId: string,
    listConfig: List.ListConfig
  ): Promise<List.ListConfig> {
    //const sort = ListConfig.mapSortSpecToData(listConfig.id, listConfig.sort);
    //const filterText = ListConfig.mapFilterTextSpecToData(listConfig.filter.text);
    //const filterTags = ListConfig.mapFilterTagsSpecToData(listConfig.filter.tagging);
    //const filterTime = ListConfig.mapFilterTimeSpecToData(listConfig.filter.time);

    /*
    const filter: PrismaListFilter = {
      listId: listConfig.id,
      tagging: {
        
      }
    }
      */

    const result = await prisma.listConfig.update({
      data: {
        id: listConfig.id,
        name: listConfig.name,

        /*
        filter: {
          upsert: {
            create: 
          }
        },
        sort: {
          upsert: {
            create: sort,
            update: sort,
            where: { listId: listConfig.id },
          },
        },
        */
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
        },
      });

      return ListConfig.mapDataToSpec(listConfig);
    } catch (error) {
      console.error(`Failed to get listConfig by id ${id}`, error);
    }
  }

  static async getByUser(userId: string): Promise<List.ListConfig[]> {
    console.log("getByUser");
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
        },
      });

      if (!listConfigs) {
        return [];
      }

      return listConfigs.map((listConfig) =>
        ListConfig.mapDataToSpec(listConfig)
      );
    } catch (error) {
      console.error(`Failed to retrieve listConfigs for user ${userId}`);
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
    console.log(
      "mapFilterDataToSpec",
      data.listConfigId,
      JSON.stringify(data, null, 2)
    );
    let time: List.TimeContext;
    const timeType = data.time.type as List.ListFilterTimeType;
    switch (timeType) {
      case List.ListFilterTimeType.ALL_TIME:
        time = {
          type: List.ListFilterTimeType.ALL_TIME,
        } as List.AllTimeContext;
      case List.ListFilterTimeType.EXACT_DATE:
        time = {
          type: List.ListFilterTimeType.EXACT_DATE,
          date: data.time.date1,
        } as List.ExactDateContext;
      case List.ListFilterTimeType.RANGE:
        time = {
          type: List.ListFilterTimeType.RANGE,
          start: data.time.date1,
          end: data.time.date2,
        } as List.RangeContext;
    }
    return {
      includeAll: data.includeAll,
      includeUntagged: data.includeUntagged,
      tagging: ListConfig.mapFilterTagsDataToSpec(data.tagging),
      text: [],
      time: { type: List.ListFilterTimeType.EXACT_DATE, date: "" },
    };
  }

  /*
  static mapFilterSpecToData(
    spec: List.ListFilter
  ): PrismaListConfig["filter"] {}
  */

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

  static mapDataToSpec(data: PrismaListConfig): List.ListConfig {
    return {
      id: data.id,
      name: data.name,
      filter: ListConfig.mapFilterDataToSpec(data.filter),
      sort: ListConfig.mapSortDataToSpec(data.sort),
    };
  }
}
