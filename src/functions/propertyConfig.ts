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

  switch (request.method) {
    case "GET":
      return jsonReply({});
    case "POST":
      const createBody = (await request.json()) as PropertyConfigCreateBody;
      const created = await PropertyConfig.create(userId, createBody);
      return jsonReply(created);
    case "PUT":
      const updateBody = (await request.json()) as PropertyConfigUpdateBody;
      const updated = await PropertyConfig.update(
        userId,
        parseInt(request.params.id),
        updateBody
      );
      return jsonReply(updated);
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
