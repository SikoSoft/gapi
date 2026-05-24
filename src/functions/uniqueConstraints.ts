import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { EntityConfig } from "../lib/EntityConfig";
import { Entity } from "api-spec/models";

export async function uniqueConstraints(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;

  const idParam = request.params.entityConfigId;
  if (!idParam) {
    return { status: 400 };
  }
  const entityConfigId = parseInt(idParam, 10);

  const isAllowed = await EntityConfig.isEditAllowed(userId, entityConfigId);
  if (isAllowed.isErr()) {
    context.error(isAllowed.error);
    return { status: 500 };
  }
  if (!isAllowed.value) {
    return forbiddenReply();
  }

  const body = (await request.json()) as Entity.EntityConfigUniqueConstraint[];

  const result = await EntityConfig.setUniqueConstraints(entityConfigId, body);
  if (result.isErr()) {
    context.error(result.error);
    return { status: 500 };
  }

  return jsonReply({ success: true });
}

app.http("uniqueConstraints", {
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: uniqueConstraints,
  route: "uniqueConstraints/{entityConfigId}",
});
