import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { z } from "zod";
import { FactRequest } from "api-spec/models/Medal";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Fact } from "../lib/Fact";

const BodySchema = z.object({
  requests: z.array(
    z.object({
      alias: z.string(),
      context: z.unknown(),
    })
  ),
});

export async function factRequestHandler(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  if (request.method !== "POST") {
    return { status: 405 };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { status: 400, body: "Invalid JSON" };
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, body: parsed.error.message };
  }

  const requests = parsed.data.requests as FactRequest[];
  const results: Record<string, string | number | boolean> = {};

  for (const req of requests) {
    const value = await Fact.resolve(req.context, introspection.user.id);
    if (value !== undefined) {
      results[req.alias] = value;
    }
  }

  return jsonReply({ results });
}

app.http("factRequest", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: factRequestHandler,
  route: "factRequest",
});
