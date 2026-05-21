import { Prisma } from "@prisma/client";
import { Medal as MedalSpec } from "api-spec/models";

// Local extension of Criterion until api-spec includes the params field.
// Remove this and import Criterion directly from api-spec once the version
// containing params has been published and installed.
export interface CriterionWithParams extends MedalSpec.Criterion {
  params?: Record<string, unknown>;
}

export type CriteriaWithParams = {
  any?: (CriterionWithParams | CriteriaWithParams)[];
  all?: (CriterionWithParams | CriteriaWithParams)[];
};

export interface MedalConfigCreateBody {
  name: string;
  description: string;
  series: string;
  recurrence: number;
  prestige: number;
  icon: string;
  criteria: CriterionWithParams | CriteriaWithParams;
}

export type MedalConfigUpdateBody = MedalConfigCreateBody;

const prismaMedalConfigValidator =
  Prisma.validator<Prisma.MedalConfigDefaultArgs>()({});

export type PrismaMedalConfig = Prisma.MedalConfigGetPayload<
  typeof prismaMedalConfigValidator
>;

const prismaMedalValidator = Prisma.validator<Prisma.MedalDefaultArgs>()({});

export type PrismaMedal = Prisma.MedalGetPayload<typeof prismaMedalValidator>;
