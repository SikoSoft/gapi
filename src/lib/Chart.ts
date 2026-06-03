import { Result, err, ok } from "neverthrow";
import {
  ChartRequest,
  DataWindow,
  DataWindowType,
  SegmentedDataPoint,
  SegmentationType,
  SegmentationTimeUnit,
} from "api-spec/models/Statistic";
import {
  AnalysisClassificationFactContext,
  FactContext,
  FactOperation,
} from "api-spec/models/Fact";
import { ListFilterTimeType } from "api-spec/models/List";
import { prisma } from "..";
import {
  AssistSegment,
  ChartEntity,
  ChartEntityProperty,
  ChartSegment,
  PrismaChart,
  SavedChart,
} from "../models/Chart";
import { Assist } from "./Assist";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";
import { Fact } from "./Fact";
import { Logger } from "./Logger";

type WorkingValue = number | string | null;
type WorkingResult = Map<string, WorkingValue[]>;

export class Chart {
  static async getChartData(
    request: ChartRequest,
    userId: string
  ): Promise<Result<SegmentedDataPoint[], Error>> {
    try {
      const resolvedWindow = Chart.resolveDataWindow(request.config.dataWindow);
      const segments = Chart.generateSegments(request, resolvedWindow);

      const working: WorkingResult = new Map();
      for (const segment of segments) {
        working.set(segment.key, request.config.dataPoints.map(() => null));
      }

      const aiDataPointIndices: number[] = [];

      for (let i = 0; i < request.config.dataPoints.length; i++) {
        const dataPoint = request.config.dataPoints[i];

        if (dataPoint.operation === FactOperation.ANALYSIS_CLASSIFICATION) {
          aiDataPointIndices.push(i);
          continue;
        }

        for (const segment of segments) {
          const scopedContext = Chart.applySegmentToContext(dataPoint, segment);
          const raw = await Fact.resolve(scopedContext, userId);
          working.get(segment.key)![i] = Chart.toWorkingValue(raw);
        }
      }

      for (const i of aiDataPointIndices) {
        const dataPoint =
          request.config.dataPoints[i] as AnalysisClassificationFactContext;
        await Chart.resolveAnalysisClassificationDataPoint(
          dataPoint,
          i,
          segments,
          resolvedWindow,
          userId,
          working
        );
      }

      const result: SegmentedDataPoint[] = [];
      for (const segment of segments) {
        for (const value of working.get(segment.key)!) {
          result.push({ segment: segment.key, value: { value } });
        }
      }

      return ok(result);
    } catch (error) {
      return err(new Error("Failed to compute chart data", { cause: error }));
    }
  }

  private static toWorkingValue(raw: number | string | boolean | undefined | null): WorkingValue {
    if (raw === undefined || raw === null) {
      return null;
    }
    if (typeof raw === "boolean") {
      return raw ? 1 : 0;
    }
    return raw;
  }

  private static async resolveAnalysisClassificationDataPoint(
    dataPoint: AnalysisClassificationFactContext,
    dataPointIndex: number,
    segments: ChartSegment[],
    resolvedWindow: { start: Date; end: Date },
    userId: string,
    working: WorkingResult
  ): Promise<void> {
    const uncachedSegments: ChartSegment[] = [];

    for (const segment of segments) {
      const scopedContext = Chart.applySegmentToContext(dataPoint, segment);
      const cached = await Fact.fromCache(scopedContext, userId);
      if (cached !== undefined) {
        working.get(segment.key)![dataPointIndex] = cached as number;
      } else {
        uncachedSegments.push(segment);
      }
    }

    if (uncachedSegments.length === 0) {
      return;
    }

    const entities = await Chart.prefetchEntities(dataPoint, resolvedWindow, userId);

    const assistSegments: AssistSegment[] = [];
    for (const segment of uncachedSegments) {
      const hasEntities = entities.some(e => {
        const t = new Date(e.createdAt).getTime();
        return t >= segment.start.getTime() && t <= segment.end.getTime();
      });
      if (hasEntities) {
        assistSegments.push({
          key: segment.key,
          start: segment.start.toISOString(),
          end: segment.end.toISOString(),
        });
      }
    }

    if (assistSegments.length === 0) {
      return;
    }

    const assistResult = await Assist.analyzeChart({
      analysisType: dataPoint.analysisType,
      entities,
      segments: assistSegments,
    });

    if (assistResult.isErr()) {
      Logger.error("[Chart] Assist analyzeChart failed", {
        error: assistResult.error,
      });
      return;
    }

    for (const { key, value } of assistResult.value.results) {
      if (value === null) {
        continue;
      }
      const segment = uncachedSegments.find(s => s.key === key);
      if (!segment) {
        continue;
      }
      await Fact.writeCache(
        Chart.applySegmentToContext(dataPoint, segment),
        userId,
        value
      );
      working.get(key)![dataPointIndex] = value;
    }
  }

  private static async prefetchEntities(
    dataPoint: AnalysisClassificationFactContext,
    resolvedWindow: { start: Date; end: Date },
    userId: string
  ): Promise<ChartEntity[]> {
    const builder = new EntityListQueryBuilder();
    builder.setUserId(userId);
    builder.setFilter({
      ...dataPoint.filter,
      time: {
        type: ListFilterTimeType.RANGE,
        start: resolvedWindow.start.toISOString(),
        end: resolvedWindow.end.toISOString(),
      },
    });
    const entityIds = await builder.runIdsQuery();

    if (entityIds.length === 0) {
      return [];
    }

    const entities = await prisma.entity.findMany({
      where: { id: { in: entityIds } },
      include: {
        tags: { select: { label: true } },
        booleanProperties: {
          include: { propertyValue: { select: { value: true } } },
        },
        dateProperties: {
          include: { propertyValue: { select: { value: true } } },
        },
        intProperties: {
          include: { propertyValue: { select: { value: true } } },
        },
        longTextProperties: {
          include: { propertyValue: { select: { value: true } } },
        },
        shortTextProperties: {
          include: { propertyValue: { select: { value: true } } },
        },
      },
    });

    return entities.map(entity => {
      const properties: ChartEntityProperty[] = [
        ...entity.booleanProperties.map(p => ({
          propertyConfigId: p.propertyConfigId,
          value: p.propertyValue.value,
        })),
        ...entity.dateProperties.map(p => ({
          propertyConfigId: p.propertyConfigId,
          value: p.propertyValue.value.toISOString(),
        })),
        ...entity.intProperties.map(p => ({
          propertyConfigId: p.propertyConfigId,
          value: p.propertyValue.value,
        })),
        ...entity.longTextProperties.map(p => ({
          propertyConfigId: p.propertyConfigId,
          value: p.propertyValue.value,
        })),
        ...entity.shortTextProperties.map(p => ({
          propertyConfigId: p.propertyConfigId,
          value: p.propertyValue.value,
        })),
      ];

      return {
        id: entity.id,
        createdAt: entity.createdAt.toISOString(),
        tags: entity.tags.map(t => t.label),
        properties,
      };
    });
  }

  private static generateSegments(
    request: ChartRequest,
    resolvedWindow: { start: Date; end: Date }
  ): ChartSegment[] {
    if (request.config.segmentation.type === SegmentationType.TIME) {
      return Chart.generateTimeSegments(
        resolvedWindow.start,
        resolvedWindow.end,
        request.config.segmentation.unit
      );
    }
    return [];
  }

  private static resolveDataWindow(dataWindow: DataWindow): { start: Date; end: Date } {
    if (dataWindow.type === DataWindowType.CUSTOM) {
      return { start: dataWindow.start, end: dataWindow.end };
    }

    const now = new Date();

    switch (dataWindow.type) {
      case DataWindowType.YEAR_TO_DATE:
        return {
          start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
          end: now,
        };
      case DataWindowType.MONTH_TO_DATE:
        return {
          start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
          end: now,
        };
      case DataWindowType.WEEK_TO_DATE: {
        const daysBack = (now.getUTCDay() + 6) % 7;
        return {
          start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack)),
          end: now,
        };
      }
      case DataWindowType.LAST_365_DAYS:
        return { start: new Date(now.getTime() - 365 * 86400000), end: now };
      case DataWindowType.LAST_30_DAYS:
        return { start: new Date(now.getTime() - 30 * 86400000), end: now };
      case DataWindowType.LAST_7_DAYS:
        return { start: new Date(now.getTime() - 7 * 86400000), end: now };
    }
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

  static async getCharts(userId: string): Promise<Result<SavedChart[], Error>> {
    try {
      const charts = await prisma.chart.findMany({
        where: { userId },
      });
      return ok(charts.map(Chart.mapDataToSpec));
    } catch (error) {
      return err(new Error("Failed to get charts", { cause: error }));
    }
  }

  static async getChart(userId: string, id: number): Promise<Result<SavedChart | null, Error>> {
    try {
      const chart = await prisma.chart.findFirst({
        where: { id, userId },
      });
      return ok(chart ? Chart.mapDataToSpec(chart) : null);
    } catch (error) {
      return err(new Error("Failed to get chart", { cause: error }));
    }
  }

  static async deleteChart(userId: string, id: number): Promise<Result<void, Error>> {
    try {
      await prisma.chart.delete({
        where: { id, userId },
      });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to delete chart", { cause: error }));
    }
  }

  static async saveChart(
    userId: string,
    name: string,
    config: object
  ): Promise<Result<SavedChart, Error>> {
    try {
      const chart = await prisma.chart.create({
        data: {
          name,
          config,
          userId,
        },
      });
      return ok(Chart.mapDataToSpec(chart));
    } catch (error) {
      return err(new Error("Failed to save chart", { cause: error }));
    }
  }

  static async updateChart(
    userId: string,
    id: number,
    name: string,
    config: object
  ): Promise<Result<SavedChart, Error>> {
    try {
      const chart = await prisma.chart.update({
        where: { id, userId },
        data: {
          name,
          config,
        },
      });
      return ok(Chart.mapDataToSpec(chart));
    } catch (error) {
      return err(new Error("Failed to update chart", { cause: error }));
    }
  }

  static mapDataToSpec(data: PrismaChart): SavedChart {
    return {
      id: data.id,
      name: data.name,
      config: data.config,
      userId: data.userId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
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
