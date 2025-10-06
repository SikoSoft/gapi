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
import { EndpointConfig, EndpointName, HttpMethod } from "../models/Endpoint";

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
    case HttpMethod.GET:
      const entityConfigsRes = await EntityConfig.getByUser(userId);
      if (entityConfigsRes.isErr()) {
        return { status: 500 };
      }

      return jsonReply<
        EndpointConfig[EndpointName.ENTITY_CONFIG][HttpMethod.GET]["responseBody"]
      >({
        entityConfigs: entityConfigsRes.value,
      });
    case HttpMethod.POST:
      const createBody = (await request.json()) as EntityConfigCreateBody;
      const entityConfigRes = await EntityConfig.create(userId, {
        userId,
        name: createBody.name,
        description: createBody.description,
        properties: createBody.properties,
        revisionOf: createBody.revisionOf,
        allowPropertyOrdering: createBody.allowPropertyOrdering,
      });

      if (entityConfigRes.isErr()) {
        context.error(entityConfigRes.error);
        return {
          status: 500,
        };
      }
      return jsonReply({ ...entityConfigRes.value });
    case HttpMethod.PUT:
      const updateBody = (await request.json()) as EntityConfigUpdateBody;
      await EntityConfig.update(userId, updateBody);
      return jsonReply({ id: updateBody.id });
    case HttpMethod.DELETE:
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
