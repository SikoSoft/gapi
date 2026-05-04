import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ENABLE_NUKE, forbiddenReply, introspect, jsonReply } from "..";
import { Entity } from "../lib/Entity";

import { Data } from "../lib/Data";
import { ExportDataContents, NukedDataType } from "api-spec/models/Data";
import { IntrospectionUser } from "api-spec/models/Introspection";

export interface ExportBody {
  entityConfigIds: number[];
  startDate?: string;
  endDate?: string;
}

async function handleExport(
  context: InvocationContext,
  request: HttpRequest,
  introspection: IntrospectionUser
): Promise<HttpResponseInit> {
  const userId = introspection.user.id;

  let body: ExportBody = (await request.json()) as ExportBody;

  const startDate = body.startDate ? new Date(body.startDate) : undefined;
  const endDate = body.endDate ? new Date(body.endDate) : undefined;
  context.log(
    "Exporting data with body:",
    body,
    "startDate:",
    startDate,
    "endDate:",
    endDate
  );

  const res = await Entity.export(
    userId,
    body.entityConfigIds,
    startDate,
    endDate
  );

  if (res.isErr()) {
    return {
      status: 500,
    };
  }

  return jsonReply({ entities: res.value, success: true });
}

async function handleImport(
  context: InvocationContext,
  request: HttpRequest,
  introspection: IntrospectionUser
): Promise<HttpResponseInit> {
  const userId = introspection.user.id;

  let body = (await request.json()) as ExportDataContents & {
    timeZone: number;
  };

  const res = await Data.import(userId, body, body.timeZone);

  if (res.isErr()) {
    context.error("Failed to import data:", res.error);
    return {
      status: 500,
    };
  }

  return jsonReply({ entities: res.value });
}

async function handleDelete(
  context: InvocationContext,
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

    context.log(`Nuked data for operation: ${operation}`);

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

  context.log("Received data request with method:", request.method);

  switch (request.method) {
    case "POST":
      switch (request.params.operation) {
        case "export":
          return await handleExport(context, request, introspection);
        case "import":
          return await handleImport(context, request, introspection);
      }
    case "DELETE":
      return await handleDelete(
        context,
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
