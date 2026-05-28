import { Result, err, ok } from "neverthrow";
import {
  ChartRequest,
  SegmentedData,
  SegmentedDataPoint,
  SegmentationType,
  SegmentationTimeUnit,
} from "api-spec/models/Statistic";
import { FactContext, FactOperation } from "api-spec/models/Fact";
import { ListFilterTimeType } from "api-spec/models/List";
import { ChartSegment } from "../models/Chart";
import { Fact } from "./Fact";

export class Chart {
  static async getChartData(
    request: ChartRequest,
    userId: string
  ): Promise<Result<SegmentedData, Error>> {
    try {
      const segments = Chart.generateSegments(request);
      const result: SegmentedData = {};

      for (const segment of segments) {
        const segmentValues: SegmentedDataPoint[] = [];
        for (const dataPoint of request.dataPoints) {
          const scopedContext = Chart.applySegmentToContext(dataPoint, segment);
          const value = await Fact.resolve(scopedContext, userId);
          segmentValues.push({ value: value ?? null });
        }
        result[segment.key] = segmentValues;
      }

      return ok(result);
    } catch (error) {
      return err(new Error("Failed to compute chart data", { cause: error }));
    }
  }

  private static generateSegments(request: ChartRequest): ChartSegment[] {
    if (request.segmentation.type === SegmentationType.TIME) {
      return Chart.generateTimeSegments(
        request.dataWindow.start,
        request.dataWindow.end,
        request.segmentation.unit
      );
    }
    return [];
  }

  private static generateTimeSegments(
    windowStart: Date,
    windowEnd: Date,
    unit: SegmentationTimeUnit
  ): ChartSegment[] {
    const segments: ChartSegment[] = [];
    let current = new Date(windowStart);

    while (current < windowEnd) {
      const start = new Date(current);
      const nextStart = Chart.advanceByUnit(start, unit);
      const end = new Date(
        Math.min(nextStart.getTime() - 1, windowEnd.getTime())
      );

      segments.push({
        key: Chart.formatSegmentKey(start, unit),
        start,
        end,
      });

      current = nextStart;
    }

    return segments;
  }

  private static advanceByUnit(date: Date, unit: SegmentationTimeUnit): Date {
    const next = new Date(date);
    switch (unit) {
      case SegmentationTimeUnit.HOUR:
        next.setUTCHours(next.getUTCHours() + 1);
        break;
      case SegmentationTimeUnit.DAY:
        next.setUTCDate(next.getUTCDate() + 1);
        break;
      case SegmentationTimeUnit.WEEK:
        next.setUTCDate(next.getUTCDate() + 7);
        break;
      case SegmentationTimeUnit.MONTH:
        next.setUTCMonth(next.getUTCMonth() + 1);
        break;
      case SegmentationTimeUnit.YEAR:
        next.setUTCFullYear(next.getUTCFullYear() + 1);
        break;
    }
    return next;
  }

  private static formatSegmentKey(
    start: Date,
    unit: SegmentationTimeUnit
  ): string {
    const y = start.getUTCFullYear();
    const m = String(start.getUTCMonth() + 1).padStart(2, "0");
    const d = String(start.getUTCDate()).padStart(2, "0");
    const h = String(start.getUTCHours()).padStart(2, "0");

    switch (unit) {
      case SegmentationTimeUnit.YEAR:
        return `${y}`;
      case SegmentationTimeUnit.MONTH:
        return `${y}-${m}`;
      case SegmentationTimeUnit.WEEK:
        return `${y}-W${String(Chart.isoWeekNumber(start)).padStart(2, "0")}`;
      case SegmentationTimeUnit.DAY:
        return `${y}-${m}-${d}`;
      case SegmentationTimeUnit.HOUR:
        return `${y}-${m}-${d}T${h}`;
    }
  }

  private static isoWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    const dayOfWeek = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private static applySegmentToContext(
    context: FactContext,
    segment: ChartSegment
  ): FactContext {
    const segmentTime = {
      type: ListFilterTimeType.RANGE as const,
      start: segment.start.toISOString(),
      end: segment.end.toISOString(),
    };

    switch (context.operation) {
      case FactOperation.ENTITY_COUNT:
      case FactOperation.UNIQUE_TAG_COUNT:
      case FactOperation.ANALYSIS_CLASSIFICATION:
        return {
          ...context,
          filter: { ...context.filter, time: segmentTime },
        };
      case FactOperation.MEDAL_COUNT:
        return {
          ...context,
          start: segment.start.toISOString(),
          end: segment.end.toISOString(),
        };
    }
  }
}
