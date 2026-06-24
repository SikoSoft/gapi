import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { prisma } from "../index";

export async function health(
  _request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    context.error("[gapi:health] database check failed", error);
    return {
      status: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        db: "error",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }

  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ok: true,
      db: "ok",
      time: new Date().toISOString(),
    }),
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: health,
  route: "health",
});
