import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";

import { PropertyConfig } from "../lib/PropertyConfig";
import {
  PropertyConfigCreateBody,
  PropertyConfigUpdateBody,
} from "../models/PropertyConfig";

export async function propertyConfig(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;
  let entityConfigId: number;
  let id: number;

  switch (request.method) {
    case "GET":
      return jsonReply({});
    case "POST":
      if (!request.params.entityConfigId) {
        return {
          status: 400,
        };
      }

      entityConfigId = parseInt(request.params.entityConfigId);
      const createBody = (await request.json()) as PropertyConfigCreateBody;
      const createdRes = await PropertyConfig.create(
        userId,
        entityConfigId,
        createBody
      );

      if (createdRes.isErr()) {
        return {
          status: 500,
          body: createdRes.error.message,
        };
      }

      return jsonReply(createdRes.value);
    case "PUT":
      if (!request.params.entityConfigId || !request.params.id) {
        return {
          status: 400,
        };
      }

      entityConfigId = parseInt(request.params.entityConfigId);
      id = parseInt(request.params.id);
      const updateBody = (await request.json()) as PropertyConfigUpdateBody;
      const updatedRes = await PropertyConfig.update(
        userId,
        entityConfigId,
        id,
        updateBody
      );

      if (updatedRes.isErr()) {
        return {
          status: 500,
          body: updatedRes.error.message,
        };
      }

      return jsonReply(updatedRes.value);
    case "DELETE":
      if (!request.params.id) {
        return {
          status: 400,
        };
      }

      id = parseInt(request.params.id);
      const deleteRes = await PropertyConfig.delete(userId, id);
      if (deleteRes.isOk() && deleteRes.value) {
        return {
          status: 204,
        };
      }
      return {
        status: 400,
      };
  }
}

app.http("propertyConfig", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: propertyConfig,
  route: "propertyConfig/{entityConfigId}/{id?}",
});
