import {
  ListFilter as ListFilterSpec,
  ListFilterTimeType,
  ListFilterType,
  ListSortDirection,
  ListSortProperty,
} from "api-spec/models/List";
import { TaggingContext } from "api-spec/models/List";
import { List } from "api-spec/models";
import { Prisma } from "@prisma/client";
import { prisma } from "..";

const prismaListConfig = Prisma.validator<Prisma.ListConfigFindManyArgs>()({
  where: { userId: "" },
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

export type PrismaListConfig = Prisma.ListConfigGetPayload<
  typeof prismaListConfig
>;

export class ListConfig {
  static async getByUser(userId: string): Promise<List.ListConfig[]> {
    return ListConfig.mapListConfigs(
      await prisma.listConfig.findMany({
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
      })
    );
  }

  static mapFilterTags(
    data: PrismaListConfig["filter"]["tagging"]
  ): List.TaggingContext {
    const tagging: List.TaggingContext = {
      [ListFilterType.CONTAINS_ALL_OF]: [],
      [ListFilterType.CONTAINS_ONE_OF]: [],
    };

    data.forEach((filterTag) => {
      tagging[filterTag.type].push(filterTag.tag);
    });

    return tagging;
  }

  static mapFilter(data: PrismaListConfig["filter"]): List.ListFilter {
    return {
      includeAll: data.includeAll,
      includeUntagged: data.includeUntagged,
      tagging: ListConfig.mapFilterTags(data.tagging),
      text: [],
      time: { type: ListFilterTimeType.EXACT_DATE, date: "" },
    };
  }

  static mapSort(data: PrismaListConfig["sort"]): List.ListSort {
    return {
      property: data.property as ListSortProperty,
      direction: data.direction as ListSortDirection,
    };
  }

  static mapListConfigs(data: PrismaListConfig[]): List.ListConfig[] {
    const listConfigs: List.ListConfig[] = [];

    data.forEach((listConfig) => {
      listConfigs.push({
        id: listConfig.id,
        name: listConfig.name,
        filter: ListConfig.mapFilter(listConfig.filter),
        sort: ListConfig.mapSort(listConfig.sort),
      });
    });

    return listConfigs;
  }
}
