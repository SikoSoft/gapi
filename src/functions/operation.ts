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

  console.log("operation", body);
  switch (body.operation.type) {
    case OperationType.DELETE:
      for (const actionId of body.actions) {
        if ((await Tagging.deleteAllActionTags(actionId)).isErr()) {
          return { status: 500 };
        }
        if ((await Action.delete(userId, actionId)).isErr()) {
          return { status: 500 };
        }
      }
      break;
    case OperationType.ADD_TAGS:
      for (const actionId of body.actions) {
        if ((await Tagging.saveTags(body.operation.tags)).isErr()) {
          return { status: 500 };
        }
        if (
          (await Tagging.addActionTags(actionId, body.operation.tags)).isErr()
        ) {
          return { status: 500 };
        }
      }
      break;
    case OperationType.REMOVE_TAGS:
      for (const actionId of body.actions) {
        if (
          (
            await Tagging.deleteActionTags(actionId, body.operation.tags)
          ).isErr()
        ) {
          return { status: 500 };
        }
      }
      break;
    case OperationType.REPLACE_TAGS:
      for (const actionId of body.actions) {
        if ((await Tagging.deleteAllActionTags(actionId)).isErr()) {
          return { status: 500 };
        }
        if ((await Tagging.saveTags(body.operation.tags)).isErr()) {
          return { status: 500 };
        }
        if (
          (await Tagging.addActionTags(actionId, body.operation.tags)).isErr()
        ) {
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
