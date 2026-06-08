import { Prisma } from "@prisma/client";

const prismaAnalysisClassificationResultValidator =
  Prisma.validator<Prisma.AnalysisClassificationResultDefaultArgs>()({});

export type PrismaAnalysisClassificationResult =
  Prisma.AnalysisClassificationResultGetPayload<
    typeof prismaAnalysisClassificationResultValidator
  >;
