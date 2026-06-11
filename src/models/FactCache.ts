import { Prisma } from "@prisma/client";
import { FactOperation } from "api-spec/models/Fact";

export interface FactResolveOptions {
  bypassCache?: boolean;
}

export const FACT_TTL_MS: Record<FactOperation, number> = {
  [FactOperation.ENTITY_COUNT]: 60 * 60 * 1000,
  [FactOperation.UNIQUE_TAG_COUNT]: 60 * 60 * 1000,
  [FactOperation.MEDAL_COUNT]: 60 * 60 * 1000,
  [FactOperation.ANALYSIS_CLASSIFICATION]: 24 * 60 * 60 * 1000,
  [FactOperation.PROPERTY_SUM]: 60 * 60 * 1000,
};

const prismaFactCacheValidator =
  Prisma.validator<Prisma.FactCacheDefaultArgs>()({});

export type PrismaFactCache = Prisma.FactCacheGetPayload<
  typeof prismaFactCacheValidator
>;
