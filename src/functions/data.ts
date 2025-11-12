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
import { ExportDataContents, NukedDataType } from "api-spec/models/Data";

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

async function handleImport(
  request: HttpRequest,
  introspection: IntrospectionUser
): Promise<HttpResponseInit> {
  const userId = introspection.user.id;

  let body = (await request.json()) as ExportDataContents & {
    timeZone: number;
  };

  const res = await Data.import(userId, body, body.timeZone);

  if (res.isErr()) {
    console.error("Failed to import data:", res.error);
    return {
      status: 500,
    };
  }

  return jsonReply({ entities: res.value });
}

async function handleDelete(
  request: HttpRequest,
  introspection: IntrospectionUser,
  operation: string
): Promise<HttpResponseInit> {
  if (ENABLE_NUKE) {
    if (!operationIsNukable(operation)) {
      return {
        status: 400,
      };
    }

    await Data.reset([operation]);

    return {
      status: 202,
    };
  }

  return {
    status: 400,
  };
}

const operationIsNukable = (operation: string): operation is NukedDataType => {
  return Object.values(NukedDataType).includes(operation as NukedDataType);
};

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
      switch (request.params.operation) {
        case "export":
          return await handleExport(request, introspection);
        case "import":
          return await handleImport(request, introspection);
      }
    case "DELETE":
      return await handleDelete(
        request,
        introspection,
        request.params.operation
      );
  }
}

app.http("data", {
  methods: ["POST", "DELETE"],
  authLevel: "anonymous",
  handler: data,
  route: "data/{operation?}",
});
