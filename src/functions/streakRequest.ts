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

  const settingsRes = await Setting.getForUser(introspection.user.id);
  const utcOffsetMinutes = settingsRes.isOk()
    ? (settingsRes.value[SettingName.TIMEZONE] as number) ?? 0
    : 0;

  for (const req of requests) {
    if (req.innerContext.operation === FactOperation.ANALYSIS_CLASSIFICATION) {
      await AnalysisClassificationScheduler.seedMissingSegments(
        req,
        introspection.user.id,
        utcOffsetMinutes
      );
    }
  }

  const results = await Streak.resolveStreaks(
    requests,
    introspection.user.id,
    utcOffsetMinutes
  );

  return jsonReply({ results });
}

app.http("streakRequest", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: streakRequestHandler,
  route: "streakRequest",
});
