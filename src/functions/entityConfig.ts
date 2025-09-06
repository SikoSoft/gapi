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

export async function listConfig(
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
      const entityConfigs = await EntityConfig.getByUser(userId);
      return jsonReply({ entityConfigs });
    case "POST":
      const createBody = (await request.json()) as EntityConfigCreateBody;
      const entityConfig = await EntityConfig.create(userId, {
        name: createBody.name,
        description: createBody.description,
        properties: createBody.properties,
      });
      return jsonReply({ ...entityConfig });
    case "PUT":
      const updateBody = (await request.json()) as EntityConfigUpdateBody;
      await EntityConfig.update(userId, updateBody);
      return jsonReply({ id: updateBody.id });
    case "DELETE":
      let id: number;
      if (!request.params.id) {
        return {
          status: 400,
        };
      }
      id = parseInt(request.params.id);
      const status = await EntityConfig.delete(userId, id);
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

app.http("entityConfig", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: listConfig,
  route: "entityConfig/{id?}",
});
