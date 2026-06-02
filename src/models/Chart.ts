import { z } from "zod";
import {
  ChartRequest,
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
  dataWindow: z.object({
    start: z.string(),
    end: z.string(),
  }),
  segmentation: z.object({
    type: z.nativeEnum(SegmentationType),
    unit: z.nativeEnum(SegmentationTimeUnit),
  }),
  dataPoints: z.array(z.record(z.string(), z.unknown())),
});

// Preserves api-spec type compatibility for the handler
export type ChartRequestBody = Omit<ChartRequest, "dataWindow"> & {
  dataWindow: {
    start: string;
    end: string;
  };
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
