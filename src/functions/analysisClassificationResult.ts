import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { z } from "zod";
import { AnalysisClassificationType } from "api-spec/models/Fact";
import { SegmentationTimeUnit } from "api-spec/models/Statistic";
import { jsonReply } from "..";
import { prisma } from "..";
import { Streak } from "../lib/Streak";
import { Logger } from "../lib/Logger";

const WriteBodySchema = z.object({
  userId: z.string().uuid(),
  analysisType: z.nativeEnum(AnalysisClassificationType),
  segmentUnit: z.nativeEnum(SegmentationTimeUnit),
  segmentKey: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export async function analysisClassificationResult(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || authHeader !== process.env.SYSTEM_API_KEY) {
    return { status: 401 };
  }

  switch (request.method) {
    case "POST": {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return { status: 400, body: "Invalid JSON" };
      }

      const parsed = WriteBodySchema.safeParse(body);
      if (!parsed.success) {
        return { status: 400, body: parsed.error.message };
      }

      const { userId, analysisType, segmentUnit, segmentKey, value } = parsed.data;

      try {
        const result = await prisma.analysisClassificationResult.upsert({
          where: {
            userId_analysisType_segmentUnit_segmentKey: {
              userId,
              analysisType,
              segmentUnit,
              segmentKey,
            },
          },
          create: { userId, analysisType, segmentUnit, segmentKey, value: JSON.stringify(value) },
          update: { value: JSON.stringify(value) },
        });

        Logger.log(
          `[analysisClassificationResult] upserted id=${result.id} userId=${userId} type=${analysisType} unit=${segmentUnit} key=${segmentKey}`
        );

        return jsonReply({ id: result.id, segmentKey: result.segmentKey });
      } catch (error) {
        context.error("[analysisClassificationResult] upsert failed", { error });
        return { status: 500 };
      }
    }

    case "GET": {
      const userId = request.query.get("userId");
      const analysisType = request.query.get("analysisType") as AnalysisClassificationType | null;
      const segmentUnit = request.query.get("segmentUnit") as SegmentationTimeUnit | null;
      const utcOffsetMinutes = Number(request.query.get("utcOffset") ?? 0);

      if (!userId) {
        return { status: 400, body: "userId is required" };
      }

      if (segmentUnit && request.query.get("lookback")) {
        const length = parseInt(request.query.get("lookback")!, 10);
        const keys = Streak.generateLookbackKeys(segmentUnit, length, new Date(), utcOffsetMinutes);
        const rows = await prisma.analysisClassificationResult.findMany({
          where: {
            userId,
            ...(analysisType ? { analysisType } : {}),
            segmentUnit,
            segmentKey: { in: keys },
          },
          orderBy: { segmentKey: "desc" },
        });
        return jsonReply({ results: rows });
      }

      const rows = await prisma.analysisClassificationResult.findMany({
        where: {
          userId,
          ...(analysisType ? { analysisType } : {}),
          ...(segmentUnit ? { segmentUnit } : {}),
        },
        orderBy: { segmentKey: "desc" },
        take: 100,
      });
      return jsonReply({ results: rows });
    }

    default:
      return { status: 405 };
  }
}

app.http("analysisClassificationResult", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: analysisClassificationResult,
  route: "analysisClassificationResult",
});
