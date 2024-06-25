import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { jsonReply, prisma } from "..";
import { BulkOperation, OperationType } from "api-spec/models/Operation";
import { Tagging } from "../lib/Tagging";

export type RequestBody = BulkOperation;

export async function operation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const body = (await request.json()) as RequestBody;

  console.log("operation", body);
  switch (body.operation.type) {
    case OperationType.DELETE:
      for (const actionId of body.actions) {
        await Tagging.deleteAllActionTags(actionId);
        await prisma.action.delete({ where: { id: actionId } });
      }
      break;
    case OperationType.ADD_TAGS:
      console.log("add tags");
      for (const actionId of body.actions) {
        console.log("add tags", actionId);
        await Tagging.saveTags(body.operation.tags);
        await Tagging.addActionTags(actionId, body.operation.tags);
      }
      break;
    case OperationType.REMOVE_TAGS:
      for (const actionId of body.actions) {
        await Tagging.deleteActionTags(actionId, body.operation.tags);
      }
      break;
    case OperationType.REPLACE_TAGS:
      for (const actionId of body.actions) {
        await Tagging.deleteAllActionTags(actionId);
        await Tagging.saveTags(body.operation.tags);
        await Tagging.addActionTags(actionId, body.operation.tags);
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
