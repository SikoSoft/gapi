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
import { EntityBodyPayload, EntityItem } from "../models/Entity";
import { Entity } from "../lib/Entity";

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

export async function entity(
  request: HttpRequest,
  _: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  let body: EntityBodyPayload;

  let entityRes: Result<EntityItem, Error>;
  switch (request.method) {
    case "POST":
      body = (await request.json()) as EntityBodyPayload;
      entityRes = await Entity.create(userId, body);
      if (entityRes.isErr()) {
        return {
          status: 500,
        };
      }
      return jsonReply({ ...entityRes.value });
    case "PUT":
      body = (await request.json()) as EntityBodyPayload;
      entityRes = await Entity.update(
        userId,
        parseInt(request.params.id),
        body
      );
      if (entityRes.isErr()) {
        return {
          status: 500,
        };
      }
      return jsonReply({ ...entityRes.value });
    case "DELETE":
      entityRes = await Entity.delete(userId, parseInt(request.params.id));
      if (entityRes.isErr()) {
        return {
          status: 500,
        };
      }
      return jsonReply({ ...entityRes.value });
    case "GET":
      const start = getStart(request);
      const perPage = getPerPage(request);
      const filter = getFilter(request);
      const sort = getSort(request);
      const context = getContext(request);
      const entityListRes = await Entity.getList({
        userId,
        filter,
        context,
        sort,
        start,
        perPage,
      });
      if (entityListRes.isErr()) {
        return {
          status: 500,
        };
      }
      return jsonReply(entityListRes.value);
  }
}

app.http("entity", {
  methods: ["GET", "POST", "DELETE", "PUT"],
  authLevel: "anonymous",
  handler: entity,
  route: "entity/{id?}",
});
