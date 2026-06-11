import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  ChartConfigType,
  ChartConfigV1,
  ChartConfigV2,
  ChartVersion,
  DataWindowType,
  SegmentationType,
  SegmentationTimeUnit,
} from "api-spec/models/Statistic";
import { AnalysisClassificationType } from "api-spec/models/Fact";

export interface ChartSegment {
  key: string;
  start: Date;
  end: Date;
}

export type ChartRequestBodyDataWindow =
  | { type: DataWindowType.CUSTOM; start: string; end: string }
  | { type: Exclude<DataWindowType, DataWindowType.CUSTOM> };

export type ChartRequestBodyConfigV1 = Omit<ChartConfigV1, "dataWindow"> & {
  dataWindow: ChartRequestBodyDataWindow;
};

export type ChartRequestBodyConfigV2 = Omit<ChartConfigV2, "dataWindow"> & {
  dataWindow: ChartRequestBodyDataWindow;
};

export type ChartRequestBodyConfig = ChartRequestBodyConfigV1 | ChartRequestBodyConfigV2;

export type ChartRequestBody = {
  config: ChartRequestBodyConfig;
  name?: string;
  save?: boolean;
  resync?: boolean;
};

const dataWindowSchema = z.union([
  z.object({
    type: z.literal(DataWindowType.CUSTOM),
    start: z.string(),
    end: z.string(),
  }),
  z.object({
    type: z.enum([
      DataWindowType.YEAR_TO_DATE,
      DataWindowType.MONTH_TO_DATE,
      DataWindowType.WEEK_TO_DATE,
      DataWindowType.LAST_365_DAYS,
      DataWindowType.LAST_30_DAYS,
      DataWindowType.LAST_7_DAYS,
    ]),
  }),
]);

const segmentationSchema = z.object({
  type: z.nativeEnum(SegmentationType),
  unit: z.nativeEnum(SegmentationTimeUnit),
});

const dataPointsSchema = z.array(z.record(z.string(), z.unknown()));

export const ChartRequestBodySchema = z.object({
  config: z.union([
    z.object({
      version: z.literal(ChartVersion.V1),
      dataWindow: dataWindowSchema,
      segmentation: segmentationSchema,
      dataPoints: dataPointsSchema,
    }),
    z.object({
      version: z.literal(ChartVersion.V2),
      type: z.nativeEnum(ChartConfigType),
      dataWindow: dataWindowSchema,
      segmentation: segmentationSchema,
      dataPoints: dataPointsSchema,
    }),
  ]),
  name: z.string().optional(),
  save: z.boolean().optional(),
  resync: z.boolean().optional(),
});

export interface SavedChart {
  id: number;
  name: string;
  config: Prisma.JsonValue;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const prismaChartValidator = Prisma.validator<Prisma.ChartDefaultArgs>()({});
export type PrismaChart = Prisma.ChartGetPayload<typeof prismaChartValidator>;

export interface ChartUpdateBody {
  name: string;
  config: object;
}

export interface ChartEntityProperty {
  propertyConfigId: number;
  value: string | number | boolean | null;
}

export interface ChartEntity {
  id: number;
  createdAt: string;
  tags: string[];
  properties: ChartEntityProperty[];
}

export interface AssistSegment {
  key: string;
  start: string;
  end: string;
}

export interface AssistAnalyzeChartRequest {
  analysisType: AnalysisClassificationType;
  entities: ChartEntity[];
  segments: AssistSegment[];
}

export interface AssistSegmentResult {
  key: string;
  value: number | null;
}

export interface AssistAnalyzeChartResponse {
  results: AssistSegmentResult[];
}
