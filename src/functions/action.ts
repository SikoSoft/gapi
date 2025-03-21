import { Result } from "neverthrow";
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  forbiddenReply,
  getDefaultFilter,
  getDefaultSort,
  introspect,
  jsonReply,
} from "..";
import { ListFilter, ListSort, ListContext } from "api-spec/models/List";
import { Action } from "../lib/Action";
//import { Action as PrismaAction } from "@prisma/client";
import { ActionBodyPayload, PrismaAction, ActionItem } from "../models/Action";

const perPage = 25;

function getStart(request: HttpRequest): number {
  return request.query.has("start")
    ? parseInt(request.query.get("start") || "")
    : 0;
}

function getPerPage(request: HttpRequest): number {
  return request.query.has("perPage")
    ? parseInt(request.query.get("perPage") || "")
    : perPage;
}

function getFilter(request: HttpRequest): ListFilter {
  if (request.query.has("filter")) {
    return JSON.parse(request.query.get("filter")) as ListFilter;
  }

  return getDefaultFilter();
}

function getSort(request: HttpRequest): ListSort {
  if (request.query.has("sort")) {
    return JSON.parse(request.query.get("sort")) as ListSort;
  }

  return getDefaultSort();
}

function getContext(request: HttpRequest): ListContext | null {
  if (request.query.has("context")) {
    return JSON.parse(request.query.get("context")) as ListContext;
  }

  return null;
}

export async function action(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  let body: ActionBodyPayload;

  let actionRes: Result<ActionItem, Error>;
  switch (request.method) {
    case "POST":
      body = (await request.json()) as ActionBodyPayload;
      actionRes = await Action.create(userId, body);
      if (actionRes.isErr()) {
        return {
          status: 500,
        };
      }
      return jsonReply({ ...actionRes.value });
    case "PUT":
      body = (await request.json()) as ActionBodyPayload;
      actionRes = await Action.update(
        userId,
        parseInt(request.params.id),
        body
      );
      if (actionRes.isErr()) {
        return {
          status: 500,
        };
      }
      return jsonReply({ ...actionRes.value });
    case "DELETE":
      actionRes = await Action.delete(userId, parseInt(request.params.id));
      if (actionRes.isErr()) {
        return {
          status: 500,
        };
      }
      return jsonReply({ ...actionRes.value });
    case "GET":
      const start = getStart(request);
      const perPage = getPerPage(request);
      const filter = getFilter(request);
      const sort = getSort(request);
      const context = getContext(request);
      const actionListRes = await Action.getList({
        userId,
        filter,
        context,
        sort,
        start,
        perPage,
      });
      if (actionListRes.isErr()) {
        return {
          status: 500,
        };
      }
      return jsonReply(actionListRes.value);
  }
}

app.http("action", {
  methods: ["GET", "POST", "DELETE", "PUT"],
  authLevel: "anonymous",
  handler: action,
  route: "action/{id?}",
});
