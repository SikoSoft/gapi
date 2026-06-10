import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { z } from "zod";
import { StreakRequest } from "api-spec/models/Medal";
import { SettingName } from "api-spec/models/Setting";
import { SegmentationTimeUnit } from "api-spec/models/Statistic";
import { FactOperation } from "api-spec/models/Fact";
import { forbiddenReply, introspect, jsonReply } from "..";
import { AnalysisClassificationScheduler } from "../lib/AnalysisClassificationScheduler";
import { Logger } from "../lib/Logger";
import { Setting } from "../lib/Setting";
import { Streak } from "../lib/Streak";

const BodySchema = z.array(
  z.object({
    alias: z.string(),
    segmentUnit: z.nativeEnum(SegmentationTimeUnit),
    length: z.number().int().positive(),
    innerContext: z.unknown(),
    innerOperator: z.enum(["==", "!=", ">", ">=", "<", "<=", "contains"]),
    innerValue: z.union([z.string(), z.number(), z.boolean()]),
  })
);

export async function streakRequestHandler(
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

  const requests = parsed.data as StreakRequest[];
  const userId = introspection.user.id;

  Logger.log(`[streakRequest] POST userId=${userId} requests=${requests.length}`);
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const op = req.innerContext.operation;
    const extra = op === FactOperation.ANALYSIS_CLASSIFICATION
      ? ` analysisType=${req.innerContext.analysisType}`
      : "";
    Logger.log(`[streakRequest] request[${i}] alias=${req.alias} op=${op}${extra} segmentUnit=${req.segmentUnit} length=${req.length} operator=${req.innerOperator} innerValue=${JSON.stringify(req.innerValue)}`);
  }

  const settingsRes = await Setting.getForUser(userId);
  const utcOffsetMinutes = settingsRes.isOk()
    ? (settingsRes.value[SettingName.TIMEZONE] as number) ?? 0
    : 0;
  Logger.log(`[streakRequest] utcOffsetMinutes=${utcOffsetMinutes}`);

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    if (req.innerContext.operation === FactOperation.ANALYSIS_CLASSIFICATION) {
      Logger.log(`[streakRequest] request[${i}] alias=${req.alias} seeding missing analysisClassificationResult segments...`);
      await AnalysisClassificationScheduler.seedMissingSegments(req, userId, utcOffsetMinutes);
      Logger.log(`[streakRequest] request[${i}] alias=${req.alias} seeding complete`);
    }
  }

  Logger.log(`[streakRequest] resolving streaks for ${requests.length} request(s)...`);
  const results = await Streak.resolveStreaks(requests, userId, utcOffsetMinutes);
  Logger.log(`[streakRequest] done results=${JSON.stringify(results)}`);

  return jsonReply({ results });
}

app.http("streakRequest", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: streakRequestHandler,
  route: "streakRequest",
});
