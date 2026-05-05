import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply, prisma } from "..";
import { BulkOperation, OperationType } from "api-spec/models/Operation";
import { Tagging } from "../lib/Tagging";
import { Entity } from "../lib/Entity";
import { ValidationError } from "../errors/ValidationError";

export type RequestBody = BulkOperation;

export async function operation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;
  const body = (await request.json()) as RequestBody;

  switch (body.operation.type) {
    case OperationType.DELETE:
      for (const entityId of body.entities) {
        const deleteAllTagsRes = await Tagging.deleteAllEntityTags(entityId);
        if (deleteAllTagsRes.isErr()) {
          context.error(deleteAllTagsRes.error);

          return { status: 500 };
        }

        const deleteRes = await Entity.delete(userId, entityId);
        if (deleteRes.isErr()) {
          context.error(deleteRes.error);

          return { status: 500 };
        }
      }
      break;
    case OperationType.ADD_TAGS:
      for (const entityId of body.entities) {
        const saveTagsRes = await Tagging.saveTags(body.operation.tags);
        if (saveTagsRes.isErr()) {
          context.error(saveTagsRes.error);

          return { status: 500 };
        }

        const addEntityTagsRes = await Tagging.addEntityTags(
          entityId,
          body.operation.tags
        );
        if (addEntityTagsRes.isErr()) {
          context.error(addEntityTagsRes.error);

          return { status: 500 };
        }
      }
      break;
    case OperationType.REMOVE_TAGS:
      for (const entityId of body.entities) {
        const deleteEntityTagsRes = await Tagging.deleteEntityTags(
          entityId,
          body.operation.tags
        );
        if (deleteEntityTagsRes.isErr()) {
          context.error(deleteEntityTagsRes.error);

          return { status: 500 };
        }
      }
      break;
    case OperationType.REPLACE_TAGS:
      for (const entityId of body.entities) {
        const deleteAllTagsRes = await Tagging.deleteAllEntityTags(entityId);
        if (deleteAllTagsRes.isErr()) {
          context.error(deleteAllTagsRes.error);

          return { status: 500 };
        }

        const saveTagsRes = await Tagging.saveTags(body.operation.tags);
        if (saveTagsRes.isErr()) {
          context.error(saveTagsRes.error);

          return { status: 500 };
        }

        const addEntityTagsRes = await Tagging.addEntityTags(
          entityId,
          body.operation.tags
        );
        if (addEntityTagsRes.isErr()) {
          context.error(addEntityTagsRes.error);

          return { status: 500 };
        }
      }
      break;
    case OperationType.ADD_PROPERTIES:
      for (const entityId of body.entities) {
        const addPropertiesRes = await Entity.addProperties(
          entityId,
          body.operation.properties,
          0
        );
        if (addPropertiesRes.isErr()) {
          context.error(addPropertiesRes.error);
          return {
            status:
              addPropertiesRes.error instanceof ValidationError ? 400 : 500,
          };
        }
      }
      break;
    case OperationType.REMOVE_PROPERTIES:
      for (const entityId of body.entities) {
        const removePropertiesRes = await Entity.removeProperties(
          entityId,
          body.operation.properties
        );
        if (removePropertiesRes.isErr()) {
          context.error(removePropertiesRes.error);
          return { status: 500 };
        }
      }
      break;
    case OperationType.REPLACE_PROPERTIES:
      for (const entityId of body.entities) {
        const replacePropertiesRes = await Entity.replaceProperties(
          entityId,
          body.operation.properties,
          0
        );
        if (replacePropertiesRes.isErr()) {
          context.error(replacePropertiesRes.error);
          return {
            status:
              replacePropertiesRes.error instanceof ValidationError ? 400 : 500,
          };
        }
      }
      break;
  }

  return jsonReply({ status: 1 });
}

app.http("operation", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: operation,
});
