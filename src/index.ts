import crypto from "crypto";
import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { PrismaClient } from "@prisma/client";
import {
  ListContext,
  ListFilter,
  ListFilterTimeType,
  ListFilterType,
  ListSort,
  ListSortDirection,
  ListSortNativeProperty,
} from "api-spec/models/List";
import { Introspection } from "./models/Introspection";
import { IdentityManager } from "./lib/IdentityManager";

export const ENABLE_NUKE = process.env.ENABLE_NUKE === "1" || false;

export const defaultUser = "f00300fd-dd74-4e17-8624-b67295cfa053";

export const prisma = new PrismaClient({
  //log: ["query", "info", "warn", "error"],
});

export const jsonReply = <T>(
  object: T = {} as T,
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

export const forbiddenReply = (): HttpResponseInit => {
  return {
    status: 403,
  };
};

export const introspect = async (
  request: HttpRequest
): Promise<Introspection> => {
  if (request.headers.has("authorization")) {
    const authToken = request.headers.get("authorization")!;

    const sessionRes = await IdentityManager.getSessionByAuthToken(authToken);

    if (sessionRes.isErr()) {
      return {
        isLoggedIn: false,
      };
    }

    const session = sessionRes.value;

    if (session) {
      return {
        isLoggedIn: true,
        user: {
          id: session.userId,
          sessionId: authToken,
          roles: session.user.roles.map((r) => r.role.label),
        },
        expiresAt: session.expiresAt,
      };
    }
  }

  return {
    isLoggedIn: false,
  };
};

export const userIdFromRequest = (request: HttpRequest): string => {
  return defaultUser;
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
    includeAllTagging: true,
    includeTypes: [],
  };
}

export function getDefaultSort(): ListSort {
  return {
    property: ListSortNativeProperty.CREATED_AT,
    direction: ListSortDirection.DESC,
  };
}

export const getIp = (req: HttpRequest): string => {
  return req.headers["x-forwarded-for"]
    ? req.headers["x-forwarded-for"].replace(/:[0-9]+/, "")
    : "0.0.0.0";
};

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function getStart(request: HttpRequest): number {
  return request.query.has("start")
    ? parseInt(request.query.get("start") || "")
    : 0;
}

export function getPerPage(request: HttpRequest): number {
  return request.query.has("perPage")
    ? parseInt(request.query.get("perPage") || "")
    : 25;
}

export function getFilter(request: HttpRequest): ListFilter {
  if (request.query.has("filter")) {
    return JSON.parse(request.query.get("filter")) as ListFilter;
  }

  return getDefaultFilter();
}

export function getSort(request: HttpRequest): ListSort {
  if (request.query.has("sort")) {
    return JSON.parse(request.query.get("sort")) as ListSort;
  }

  return getDefaultSort();
}

export function getContext(request: HttpRequest): ListContext | null {
  if (request.query.has("context")) {
    return JSON.parse(request.query.get("context")) as ListContext;
  }

  return null;
}
