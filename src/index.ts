import { Result, err, ok } from "neverthrow";
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
import { Introspection } from "./models/Introspection";
import { IdentityManager } from "./lib/IdentityManager";

export const defaultUser = "f00300fd-dd74-4e17-8624-b67295cfa053";

export const prisma = new PrismaClient();

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
    property: ListSortProperty.OCCURRED_AT,
    direction: ListSortDirection.DESC,
  };
}

export const getIp = (req: HttpRequest): string => {
  return req.headers["x-forwarded-for"]
    ? req.headers["x-forwarded-for"].replace(/:[0-9]+/, "")
    : "0.0.0.0";
};
