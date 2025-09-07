import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";

import { EntityConfig } from "../lib/EntityConfig";
import {
  EntityConfigCreateBody,
  EntityConfigUpdateBody,
} from "../models/Entity";
import { PropertyConfig } from "../lib/PropertyConfig";

export async function propertyConfig(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;

  switch (request.method) {
    case "GET":
      return jsonReply({});
    case "POST":
      return jsonReply({});
    case "PUT":
      return jsonReply({});
    case "DELETE":
      let id: number;
      if (!request.params.id) {
        return {
          status: 400,
        };
      }
      id = parseInt(request.params.id);
      const status = await PropertyConfig.delete(userId, id);
      if (status) {
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
  route: "propertyConfig/{id?}",
});
