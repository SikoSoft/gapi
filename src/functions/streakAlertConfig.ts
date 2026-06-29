import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { StreakAlertConfig } from "../lib/StreakAlertConfig";
import { Logger } from "../lib/Logger";
import { HttpMethod } from "../models/Endpoint";
import { StreakAlertConfigBodySchema, StreakAlertConfigUpdateBodySchema } from "../models/StreakAlert";

export async function streakAlertConfigHandler(
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
      const listRes = await StreakAlertConfig.list(userId);
      if (listRes.isErr()) {
        context.error(listRes.error);
        return { status: 500 };
      }
      return jsonReply({ alertConfigs: listRes.value });
    }

    case HttpMethod.POST: {
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return { status: 400, body: "Invalid JSON" };
      }

      const parsed = StreakAlertConfigBodySchema.safeParse(raw);
      if (!parsed.success) {
        return { status: 400, body: parsed.error.message };
      }

      Logger.log(`[streakAlertConfig] POST userId=${userId} streakId=${parsed.data.streakId}`);

      const createRes = await StreakAlertConfig.create(userId, parsed.data.streakId, parsed.data.noticeTime);
      if (createRes.isErr()) {
        context.error(createRes.error);
        return { status: 500 };
      }

      return jsonReply({ alertConfig: createRes.value });
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

      const parsed = StreakAlertConfigUpdateBodySchema.safeParse(raw);
      if (!parsed.success) {
        return { status: 400, body: parsed.error.message };
      }

      Logger.log(`[streakAlertConfig] PUT userId=${userId} id=${id}`);

      const updateRes = await StreakAlertConfig.update(id, userId, parsed.data.noticeTime);
      if (updateRes.isErr()) {
        context.error(updateRes.error);
        return { status: updateRes.error.message === "Streak alert config not found" ? 404 : 500 };
      }

      return jsonReply({ alertConfig: updateRes.value });
    }

    case HttpMethod.DELETE: {
      const idParam = request.params.id;
      if (!idParam) {
        return { status: 400 };
      }
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return { status: 400 };
      }

      Logger.log(`[streakAlertConfig] DELETE userId=${userId} id=${id}`);

      const removeRes = await StreakAlertConfig.remove(id, userId);
      if (removeRes.isErr()) {
        context.error(removeRes.error);
        return { status: removeRes.error.message === "Streak alert config not found" ? 404 : 500 };
      }

      return { status: 204 };
    }

    default:
      return { status: 405 };
  }
}

app.http("streakAlertConfig", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  handler: streakAlertConfigHandler,
  route: "streakAlertConfig/{id?}",
});
