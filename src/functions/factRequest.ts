import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { z } from "zod";
import { FactRequest } from "api-spec/models/Fact";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Fact } from "../lib/Fact";
import { Logger } from "../lib/Logger";

const BodySchema = z.array(
  z.object({
    alias: z.string(),
    context: z.unknown(),
  })
);

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

  const requests = parsed.data as FactRequest[];
  const userId = introspection.user.id;

  Logger.log(`[factRequest] POST userId=${userId} requests=${requests.length}`);
  for (let i = 0; i < requests.length; i++) {
    Logger.log(
      `[factRequest] request[${i}] alias=${requests[i].alias} op=${requests[i].context.operation}`
    );
  }

  const results: Record<string, string | number | boolean> = {};

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    Logger.log(
      `[factRequest] resolving request[${i}] alias=${req.alias} op=${req.context.operation}...`
    );
    const value = await Fact.resolve(req.context, userId);
    if (value !== undefined) {
      Logger.log(
        `[factRequest] request[${i}] alias=${
          req.alias
        } resolved value=${JSON.stringify(value)}`
      );
      results[req.alias] = value;
    } else {
      Logger.log(
        `[factRequest] request[${i}] alias=${req.alias} resolved undefined — omitted from results`
      );
    }
  }

  const resolvedCount = Object.keys(results).length;
  Logger.log(
    `[factRequest] done resolved=${resolvedCount}/${
      requests.length
    } results=${JSON.stringify(results)}`
  );

  return jsonReply({ results });
}

app.http("factRequest", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: factRequestHandler,
  route: "factRequest",
});
