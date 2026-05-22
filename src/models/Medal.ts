import { Prisma } from "@prisma/client";
import { Medal as MedalSpec } from "api-spec/models";

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
