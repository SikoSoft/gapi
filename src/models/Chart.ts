import { z } from "zod";
import {
  ChartRequest,
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

export const ChartRequestBodySchema = z.object({
  dataWindow: z.union([
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
  ]),
  segmentation: z.object({
    type: z.nativeEnum(SegmentationType),
    unit: z.nativeEnum(SegmentationTimeUnit),
  }),
  dataPoints: z.array(z.record(z.string(), z.unknown())),
});

export type ChartRequestBodyDataWindow =
  | { type: DataWindowType.CUSTOM; start: string; end: string }
  | { type: Exclude<DataWindowType, DataWindowType.CUSTOM> };

export type ChartRequestBody = Omit<ChartRequest, "dataWindow"> & {
  dataWindow: ChartRequestBodyDataWindow;
};

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
