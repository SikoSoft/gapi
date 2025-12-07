import { Result } from "neverthrow";
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  forbiddenReply,
  introspect,
  jsonReply,
  getStart,
  getPerPage,
  getFilter,
  getSort,
  getContext,
} from "..";
import { Entity as EntitySpec } from "api-spec/models";
import { EntityBodyPayload } from "../models/Entity";
import { Entity } from "../lib/Entity";

export async function entity(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  let body: EntityBodyPayload;

  let entityRes: Result<EntitySpec.Entity, Error>;
  switch (request.method) {
    case "POST":
      body = (await request.json()) as EntityBodyPayload;
      entityRes = await Entity.create(userId, body);

      if (entityRes.isErr()) {
        context.error(entityRes.error);

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
        context.error(entityRes.error);

        return {
          status: 500,
        };
      }
      return jsonReply({ ...entityRes.value });
    case "DELETE":
      entityRes = await Entity.delete(userId, parseInt(request.params.id));

      if (entityRes.isErr()) {
        context.error(entityRes.error);

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
      const listContext = getContext(request);
      const entityListRes = await Entity.getList({
        userId,
        filter,
        context: listContext,
        sort,
        start,
        perPage,
      });

      if (entityListRes.isErr()) {
        context.error(entityListRes.error);

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
