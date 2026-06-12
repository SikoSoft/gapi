import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { SettingName } from "api-spec/models/Setting";
import { FactOperation } from "api-spec/models/Fact";
import { forbiddenReply, introspect, jsonReply } from "..";
import { AnalysisClassificationScheduler } from "../lib/AnalysisClassificationScheduler";
import { Logger } from "../lib/Logger";
import { Setting } from "../lib/Setting";
import { Streak } from "../lib/Streak";
import { HttpMethod } from "../models/Endpoint";
import { StreakConfigBodySchema, StreakConfigUpdateBodySchema } from "../models/Streak";

export async function streakRequestHandler(
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
      const listRes = await Streak.list(userId);
      if (listRes.isErr()) {
        context.error(listRes.error);
        return { status: 500 };
      }
      const streaks = listRes.value;

      const settingsRes = await Setting.getForUser(userId);
      const utcOffsetMinutes = settingsRes.isOk()
        ? (settingsRes.value[SettingName.TIMEZONE] as number) ?? 0
        : 0;

      for (const streak of streaks) {
        if (streak.context.innerContext.operation === FactOperation.ANALYSIS_CLASSIFICATION) {
          const req = { alias: String(streak.id), context: streak.context };
          await AnalysisClassificationScheduler.seedMissingSegments(req, userId, utcOffsetMinutes);
        }
      }

      const results = await Streak.resolveStreaks(streaks, userId, utcOffsetMinutes);

      return jsonReply({ streaks, results });
    }

    case HttpMethod.POST: {
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return { status: 400, body: "Invalid JSON" };
      }

      const parsed = StreakConfigBodySchema.safeParse(raw);
      if (!parsed.success) {
        return { status: 400, body: parsed.error.message };
      }

      Logger.log(`[streakRequest] POST userId=${userId} name=${parsed.data.name}`);

      const createRes = await Streak.create(userId, parsed.data.name, parsed.data.context);
      if (createRes.isErr()) {
        context.error(createRes.error);
        return { status: 500 };
      }

      return jsonReply({ streak: createRes.value });
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

      const parsed = StreakConfigUpdateBodySchema.safeParse(raw);
      if (!parsed.success) {
        return { status: 400, body: parsed.error.message };
      }

      Logger.log(`[streakRequest] PUT userId=${userId} id=${id}`);

      const updateRes = await Streak.update(id, userId, parsed.data.name, parsed.data.context);
      if (updateRes.isErr()) {
        context.error(updateRes.error);
        return { status: updateRes.error.message === "Streak not found" ? 404 : 500 };
      }

      return jsonReply({ streak: updateRes.value });
    }

    default:
      return { status: 405 };
  }
}

app.http("streakRequest", {
  methods: ["GET", "POST", "PUT"],
  authLevel: "anonymous",
  handler: streakRequestHandler,
  route: "streakRequest/{id?}",
});
