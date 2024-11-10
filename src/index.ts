import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { PrismaClient } from "@prisma/client";
import {
  ListFilter,
  ListFilterTimeType,
  ListFilterType,
  ListSort,
  ListSortDirection,
  ListSortProperty,
} from "api-spec/models/List";

export const prisma = new PrismaClient();

export const jsonReply = (
  object: Object = {},
  status: number = 200
): HttpResponseInit => {
  return {
    status,
    headers: {
      "content-type": "application/json",
    },
    ...(Object.keys(object).length ? { body: JSON.stringify(object) } : {}),
  };
};

export const userIdFromRequest = (request: HttpRequest): string => {
  return "f00300fd-dd74-4e17-8624-b67295cfa053";
};

export function getDefaultFilter(): ListFilter {
  return {
    tagging: {
      [ListFilterType.CONTAINS_ONE_OF]: [],
      [ListFilterType.CONTAINS_ALL_OF]: [],
    },
    time: {
      type: ListFilterTimeType.ALL_TIME,
    },
    text: [],
    includeUntagged: true,
    includeAll: true,
  };
}

export function getDefaultSort(): ListSort {
  return {
    property: ListSortProperty.OCCURRED_AT,
    direction: ListSortDirection.DESC,
  };
}
