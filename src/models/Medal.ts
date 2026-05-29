import { z } from "zod";
import { Prisma } from "@prisma/client";
import { Medal as MedalSpec } from "api-spec/models";

const CriterionSchema = z.object({
  fact: z.string(),
  operator: z.enum(["==", "!=", ">", ">=", "<", "<=", "contains"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

const FactRequestSchema = z.object({
  alias: z.string(),
  context: z.unknown(),
});

export const MedalConfigCreateBodySchema = z.object({
  name: z.string(),
  description: z.string(),
  series: z.string(),
  recurrence: z.number(),
  prestige: z.number(),
  icon: z.string(),
  factRequests: z.array(FactRequestSchema),
  criteria: z.unknown(),
});

// Preserves api-spec type compatibility for the handler
export interface MedalConfigCreateBody {
  name: string;
  description: string;
  series: string;
  recurrence: number;
  prestige: number;
  icon: string;
  factRequests: MedalSpec.FactRequest[];
  criteria: MedalSpec.Criterion | MedalSpec.Criteria;
}
export type MedalConfigUpdateBody = MedalConfigCreateBody;

const prismaMedalConfigValidator =
  Prisma.validator<Prisma.MedalConfigDefaultArgs>()({});

export type PrismaMedalConfig = Prisma.MedalConfigGetPayload<
  typeof prismaMedalConfigValidator
>;

const prismaMedalValidator = Prisma.validator<Prisma.MedalDefaultArgs>()({});

export type PrismaMedal = Prisma.MedalGetPayload<typeof prismaMedalValidator>;
