import { z } from "zod";
import { Prisma } from "@prisma/client";
import { SegmentationTimeUnit } from "api-spec/models/Statistic";
import { AnalysisClassificationType, FactOperation, StreakContext } from "api-spec/models/Fact";
import { ListFilter } from "api-spec/models/List";

export interface SegmentInfo {
  key: string;
  start: Date;
  end: Date;
}

const filterSchema = z.custom<ListFilter>();

const innerContextSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal(FactOperation.ENTITY_COUNT), filter: filterSchema }),
  z.object({ operation: z.literal(FactOperation.UNIQUE_TAG_COUNT), filter: filterSchema }),
  z.object({ operation: z.literal(FactOperation.MEDAL_COUNT), medalConfigId: z.number(), series: z.string(), start: z.string().optional(), end: z.string().optional() }),
  z.object({ operation: z.literal(FactOperation.ANALYSIS_CLASSIFICATION), filter: filterSchema, analysisType: z.nativeEnum(AnalysisClassificationType) }),
  z.object({ operation: z.literal(FactOperation.PROPERTY_SUM), filter: filterSchema, propertyConfigId: z.number() }),
]);

export const StreakContextSchema = z.object({
  segmentUnit: z.nativeEnum(SegmentationTimeUnit),
  length: z.number().int().positive(),
  innerContext: innerContextSchema,
  innerOperator: z.enum(["==", "!=", ">", ">=", "<", "<=", "contains"]),
  innerValue: z.union([z.string(), z.number(), z.boolean()]),
}).transform(v => v as unknown as StreakContext);

export const StreakConfigBodySchema = z.object({
  name: z.string().min(1),
  context: StreakContextSchema,
});

export const StreakConfigUpdateBodySchema = z.object({
  name: z.string().min(1).optional(),
  context: StreakContextSchema.optional(),
});

export interface StreakConfigBody {
  name: string;
  context: object;
}

export interface StreakConfigUpdateBody {
  name?: string;
  context?: object;
}

const prismaStreakConfigValidator = Prisma.validator<Prisma.StreakConfigDefaultArgs>()({});
export type PrismaStreakConfig = Prisma.StreakConfigGetPayload<typeof prismaStreakConfigValidator>;
