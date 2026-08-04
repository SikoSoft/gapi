import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AnalysisClassificationType, FactContext, FactOperation, ParseStrategy } from "api-spec/models/Fact";
import { ListFilter } from "api-spec/models/List";
import { FormatterId } from "api-spec/models/Formatter";

export const PARSE_STRATEGY_CONFIG: Record<ParseStrategy, { matchPattern: string; capturePattern: string }> = {
  [ParseStrategy.LEADING_INTEGER]: {
    matchPattern: '^[0-9]',
    capturePattern: '^([0-9]+).*$',
  },
};

const filterSchema = z.custom<ListFilter>();

const factContextSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal(FactOperation.ENTITY_COUNT), filter: filterSchema }),
  z.object({ operation: z.literal(FactOperation.UNIQUE_TAG_COUNT), filter: filterSchema }),
  z.object({ operation: z.literal(FactOperation.MEDAL_COUNT), medalConfigId: z.number(), series: z.string(), start: z.string().optional(), end: z.string().optional() }),
  z.object({ operation: z.literal(FactOperation.ANALYSIS_CLASSIFICATION), filter: filterSchema, analysisType: z.nativeEnum(AnalysisClassificationType) }),
  z.object({ operation: z.literal(FactOperation.PROPERTY_SUM), filter: filterSchema, propertyConfigId: z.number(), parseStrategy: z.nativeEnum(ParseStrategy).optional() }),
]).transform(v => v as unknown as FactContext);

export const FactConfigBodySchema = z.object({
  name: z.string().min(1),
  context: factContextSchema,
  formatters: z.array(z.nativeEnum(FormatterId)).optional(),
});

export const FactConfigUpdateBodySchema = z.object({
  name: z.string().min(1).optional(),
  context: factContextSchema.optional(),
  formatters: z.array(z.nativeEnum(FormatterId)).optional(),
});

const prismaFactConfigValidator = Prisma.validator<Prisma.FactConfigDefaultArgs>()({
  include: { formatters: true },
});
export type PrismaFactConfig = Prisma.FactConfigGetPayload<typeof prismaFactConfigValidator>;
