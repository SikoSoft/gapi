import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Fact } from "../lib/Fact";
import { Logger } from "../lib/Logger";
import { HttpMethod } from "../models/Endpoint";
import { FactConfigBodySchema, FactConfigUpdateBodySchema } from "../models/Fact";

export async function factConfigHandler(
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
      const bypassCache = request.query.get("bypassCache") === "true";

      const listRes = await Fact.listConfigs(userId);
      if (listRes.isErr()) {
        context.error(listRes.error);
        return { status: 500 };
      }
      const facts = listRes.value;

      const results = await Fact.resolveFactConfigs(facts, userId, bypassCache);

      return jsonReply({ facts, results });
    }

    case HttpMethod.POST: {
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return { status: 400, body: "Invalid JSON" };
      }

      const parsed = FactConfigBodySchema.safeParse(raw);
      if (!parsed.success) {
        return { status: 400, body: parsed.error.message };
      }

      Logger.log(`[factConfig] POST userId=${userId} name=${parsed.data.name}`);

      const createRes = await Fact.createConfig(userId, parsed.data.name, parsed.data.context);
      if (createRes.isErr()) {
        context.error(createRes.error);
        return { status: 500 };
      }

      return jsonReply({ fact: createRes.value });
    }

    case HttpMethod.PUT: {
      const idParam = request.params.id;
      if (!idParam) {
        return { status: 400 };
      }
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return { status: 400 };
      }

      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return { status: 400, body: "Invalid JSON" };
      }

      const parsed = FactConfigUpdateBodySchema.safeParse(raw);
      if (!parsed.success) {
        return { status: 400, body: parsed.error.message };
      }

      Logger.log(`[factConfig] PUT userId=${userId} id=${id}`);

      const updateRes = await Fact.updateConfig(id, userId, parsed.data.name, parsed.data.context);
      if (updateRes.isErr()) {
        context.error(updateRes.error);
        return { status: updateRes.error.message === "Fact config not found" ? 404 : 500 };
      }

      return jsonReply({ fact: updateRes.value });
    }

    default:
      return { status: 405 };
  }
}

app.http("factConfig", {
  methods: ["GET", "POST", "PUT"],
  authLevel: "anonymous",
  handler: factConfigHandler,
  route: "factConfig/{id?}",
});
