import { z } from "zod";
import { ChartRequest } from "api-spec/models/Statistic";
import { SegmentationType, SegmentationTimeUnit } from "api-spec/models/Statistic";

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
