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
  propertyConfigCreateSchema,
  PropertyConfigUpdateBody,
  propertyConfigUpdateSchema,
} from "../models/PropertyConfig";
import { EntityPropertyConfig } from "api-spec/models/Entity";
import { Validation } from "io-ts";
import { Revision } from "api-spec/lib/Revision";

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
  let validation: Validation<PropertyConfigCreateBody>;

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
      id = parseInt(request.params.id);
      const createBody = (await request.json()) as PropertyConfigCreateBody;

      validation = propertyConfigCreateSchema.decode(createBody);
      if (validation._tag === "Left") {
        return {
          status: 400,
          body: JSON.stringify(validation.left),
        };
      }

      const createdRes = await PropertyConfig.create(
        userId,
        entityConfigId,
        createBody
      );

      if (createdRes.isErr()) {
        context.error(createdRes.error);

        return {
          status: 500,
          body: createdRes.error.message,
        };
      }

      return jsonReply<EntityPropertyConfig>(createdRes.value);
    case "PUT":
      if (!request.params.entityConfigId || !request.params.id) {
        return {
          status: 400,
        };
      }

      entityConfigId = parseInt(request.params.entityConfigId);
      id = parseInt(request.params.id);
      const updateBody = (await request.json()) as PropertyConfigUpdateBody;

      validation = propertyConfigUpdateSchema.decode(updateBody);
      if (validation._tag === "Left") {
        console.error(
          "Validation failed:",
          JSON.stringify(validation.left, null, 2)
        );
        return {
          status: 400,
          body: JSON.stringify(validation.left),
        };
      }

      if (validation.right.performDriftCheck) {
        const currentRes = await PropertyConfig.getById(userId, id);
        if (currentRes.isErr()) {
          context.error(currentRes.error);
          return {
            status: 404,
            body: currentRes.error.message,
          };
        }

        const revisionCheck = Revision.propertyIsSafe(currentRes.value, {
          ...validation.right,
          id,
          entityConfigId,
          userId,
        } as EntityPropertyConfig);

        if (revisionCheck.isValid === false) {
          console.error(
            "Revision conflict:",
            revisionCheck.problems.join(", ")
          );

          return {
            status: 409,
            body: "Revision conflict",
          };
        }
      }

      const updatedRes = await PropertyConfig.update(
        userId,
        entityConfigId,
        id,
        validation.right
      );

      if (updatedRes.isErr()) {
        context.error(updatedRes.error);

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
