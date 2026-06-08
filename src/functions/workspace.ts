import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Workspace as WorkspaceLib } from "../lib/Workspace";
import { Workspace as WorkspaceSpec } from "api-spec/models";
import { WorkspaceCreateBody, WorkspaceUpdateBody } from "../models/Workspace";
import { HttpMethod } from "../models/Endpoint";

export async function workspace(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  switch (request.method) {
    case HttpMethod.GET: {
      if (request.params.id) {
        const res = await WorkspaceLib.getById(userId, request.params.id);
        if (res.isErr()) {
          context.error(res.error);
          return { status: 404 };
        }
        return jsonReply<WorkspaceSpec.Workspace>({ ...res.value });
      }

      const res = await WorkspaceLib.getByUser(userId);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }
      return jsonReply<{ workspaces: WorkspaceSpec.Workspace[] }>({ workspaces: res.value });
    }
    case HttpMethod.POST: {
      const body = (await request.json()) as WorkspaceCreateBody;
      const res = await WorkspaceLib.create(userId, body.name, body.color, body.theme, body.showEverything, body.listConfigs);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 400 };
      }
      return jsonReply<WorkspaceSpec.Workspace>({ ...res.value });
    }
    case HttpMethod.PUT: {
      const body = (await request.json()) as WorkspaceUpdateBody;
      const res = await WorkspaceLib.update(userId, request.params.id, body.name, body.color, body.theme, body.showEverything, body.listConfigs);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 400 };
      }
      return jsonReply<WorkspaceSpec.Workspace>({ ...res.value });
    }
    case HttpMethod.DELETE: {
      const res = await WorkspaceLib.delete(userId, request.params.id);
      if (res.isErr()) {
        context.error(res.error);
        return { status: 400 };
      }
      if (!res.value) {
        return { status: 404 };
      }
      return { status: 204 };
    }
  }
}

app.http("workspace", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: workspace,
  route: "workspace/{id?}",
});
