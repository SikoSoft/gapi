import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  frontEndLogSchema,
} from "../models/FrontEndLog";
import { FrontEndLog } from "../lib/FrontEndLog";

export async function log(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { status: 400, body: JSON.stringify({ message: "Invalid JSON" }) };
  }

  const parseResult = frontEndLogSchema.safeParse(body);

  if (!parseResult.success) {
    return { status: 400, body: JSON.stringify(parseResult.error.issues) };
  }

  const payload = parseResult.data;

  context.log("front-end error report", {
    type: payload.type,
    message: payload.message,
    url: payload.url,
    userAgent: payload.userAgent,
    timestamp: payload.timestamp,
  });

  const result = await FrontEndLog.create(payload);

  if (result.isErr()) {
    context.error(result.error);
    return { status: 500 };
  }

  return {
    status: 202,
    headers: { "Access-Control-Allow-Origin": "*" },
  };
}

app.http("log", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: log,
  route: "log",
});
