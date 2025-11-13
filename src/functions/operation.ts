import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply, prisma } from "..";
import { BulkOperation, OperationType } from "api-spec/models/Operation";
import { Tagging } from "../lib/Tagging";
import { Action } from "../lib/Action";

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
      for (const actionId of body.actions) {
        const deleteAllTagsRes = await Tagging.deleteAllEntityTags(actionId);
        if (deleteAllTagsRes.isErr()) {
          context.error(deleteAllTagsRes.error);

          return { status: 500 };
        }

        const deleteRes = await Action.delete(userId, actionId);
        if (deleteRes.isErr()) {
          context.error(deleteRes.error);

          return { status: 500 };
        }
      }
      break;
    case OperationType.ADD_TAGS:
      for (const actionId of body.actions) {
        const saveTagsRes = await Tagging.saveTags(body.operation.tags);
        if (saveTagsRes.isErr()) {
          context.error(saveTagsRes.error);

          return { status: 500 };
        }

        const addEntityTagsRes = await Tagging.addEntityTags(
          actionId,
          body.operation.tags
        );
        if (addEntityTagsRes.isErr()) {
          context.error(addEntityTagsRes.error);

          return { status: 500 };
        }
      }
      break;
    case OperationType.REMOVE_TAGS:
      for (const actionId of body.actions) {
        const deleteEntityTagsRes = await Tagging.deleteEntityTags(
          actionId,
          body.operation.tags
        );
        if (deleteEntityTagsRes.isErr()) {
          context.error(deleteEntityTagsRes.error);

          return { status: 500 };
        }
      }
      break;
    case OperationType.REPLACE_TAGS:
      for (const actionId of body.actions) {
        const deleteAllTagsRes = await Tagging.deleteAllEntityTags(actionId);
        if (deleteAllTagsRes.isErr()) {
          context.error(deleteAllTagsRes.error);

          return { status: 500 };
        }

        const saveTagsRes = await Tagging.saveTags(body.operation.tags);
        if (saveTagsRes.isErr()) {
          context.error(saveTagsRes.error);

          return { status: 500 };
        }

        const addActionTagsRes = await Tagging.addEntityTags(
          actionId,
          body.operation.tags
        );
        if (addActionTagsRes.isErr()) {
          context.error(addActionTagsRes.error);

          return { status: 500 };
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
