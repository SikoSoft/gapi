import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ENABLE_NUKE, forbiddenReply, introspect, jsonReply } from "..";
import { Entity } from "../lib/Entity";
import { IntrospectionUser } from "../models/Introspection";
import { Data } from "../lib/Data";

export interface ExportBody {
  entityConfigIds: number[];
}

async function handleExport(
  request: HttpRequest,
  introspection: IntrospectionUser
): Promise<HttpResponseInit> {
  const userId = introspection.user.id;

  let body: ExportBody = (await request.json()) as ExportBody;

  const res = await Entity.export(userId, body.entityConfigIds);

  if (res.isErr()) {
    return {
      status: 500,
    };
  }

  return jsonReply({ entities: res.value });
}

async function handleDelete(
  request: HttpRequest,
  introspection: IntrospectionUser
): Promise<HttpResponseInit> {
  if (ENABLE_NUKE) {
    await Data.reset();

    return {
      status: 202,
    };
  }

  return {
    status: 400,
  };
}

export async function data(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  switch (request.method) {
    case "POST":
      return await handleExport(request, introspection);
    case "DELETE":
      return await handleDelete(request, introspection);
  }
}

app.http("data", {
  methods: ["POST", "DELETE"],
  authLevel: "anonymous",
  handler: data,
  route: "data",
});
