import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";

import { PropertyConfig } from "../lib/PropertyConfig";
import {
  CalculatedPropertyConfigCreateBody,
  calculatedPropertyConfigCreateSchema,
  calculatedPropertyConfigUpdateSchema,
  PropertyConfigCreateBody,
  propertyConfigCreateSchema,
  propertyConfigUpdateSchema,
} from "../models/PropertyConfig";
import { EntityPropertyConfig } from "api-spec/models/Entity";
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

      if ("calculation" in createBody) {
        const calcResult = calculatedPropertyConfigCreateSchema.safeParse(createBody);
        if (!calcResult.success) {
          return { status: 400, body: JSON.stringify(calcResult.error.issues) };
        }
        const calcRes = await PropertyConfig.createCalculated(
          userId,
          entityConfigId,
          calcResult.data as CalculatedPropertyConfigCreateBody
        );
        if (calcRes.isErr()) {
          context.error(calcRes.error);
          return { status: 500, body: calcRes.error.message };
        }
        return jsonReply(calcRes.value);
      }

      const createResult = propertyConfigCreateSchema.safeParse(createBody);
      if (!createResult.success) {
        return {
          status: 400,
          body: JSON.stringify(createResult.error.issues),
        };
      }

      const createdRes = await PropertyConfig.create(
        userId,
        entityConfigId,
        createResult.data
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
      const updateBody = (await request.json()) as PropertyConfigCreateBody;

      if ("calculation" in updateBody) {
        const calcResult = calculatedPropertyConfigUpdateSchema.safeParse(updateBody);
        if (!calcResult.success) {
          return { status: 400, body: JSON.stringify(calcResult.error.issues) };
        }
        const calcRes = await PropertyConfig.updateCalculated(
          userId,
          entityConfigId,
          id,
          calcResult.data as CalculatedPropertyConfigCreateBody
        );
        if (calcRes.isErr()) {
          context.error(calcRes.error);
          return { status: 500, body: calcRes.error.message };
        }
        return jsonReply(calcRes.value);
      }

      const updateResult = propertyConfigUpdateSchema.safeParse(updateBody);
      if (!updateResult.success) {
        console.error(
          "Validation failed:",
          JSON.stringify(updateResult.error.issues, null, 2)
        );
        return {
          status: 400,
          body: JSON.stringify(updateResult.error.issues),
        };
      }

      if (updateResult.data.performDriftCheck) {
        const currentRes = await PropertyConfig.getById(userId, id);
        if (currentRes.isErr()) {
          context.error(currentRes.error);
          return {
            status: 404,
            body: currentRes.error.message,
          };
        }

        const revisionCheck = Revision.propertyIsSafe(currentRes.value, {
          ...updateResult.data,
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
        updateResult.data
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
