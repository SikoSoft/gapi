import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Entity } from "../lib/Entity";

export interface ExportBody {
  entityConfigIds: number[];
}

export async function entity(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  let body: ExportBody = (await request.json()) as ExportBody;

  const res = await Entity.export(userId, body.entityConfigIds);

  if (res.isErr()) {
    return {
      status: 500,
    };
  }

  return jsonReply({ ...res.value });
}

app.http("export", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: entity,
  route: "export",
});
