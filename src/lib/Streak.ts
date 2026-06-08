import { FactOperation } from "api-spec/models/Fact";
import { StreakRequest } from "api-spec/models/Medal";
import { SegmentationTimeUnit } from "api-spec/models/Statistic";
import { prisma } from "..";
import { FactValue } from "./Fact";
import { Logger } from "./Logger";

export class Streak {
  static segmentKey(unit: SegmentationTimeUnit, utcDate: Date, utcOffsetMinutes: number): string {
    const localMs = utcDate.getTime() + utcOffsetMinutes * 60 * 1000;
    const d = new Date(localMs);
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, "0");
    const D = String(d.getUTCDate()).padStart(2, "0");
    const H = String(d.getUTCHours()).padStart(2, "0");

    switch (unit) {
      case SegmentationTimeUnit.HOUR:
        return `${Y}-${M}-${D}T${H}`;
      case SegmentationTimeUnit.DAY:
        return `${Y}-${M}-${D}`;
      case SegmentationTimeUnit.WEEK: {
        const { year, week } = Streak.isoWeek(d);
        return `${year}-W${String(week).padStart(2, "0")}`;
      }
      case SegmentationTimeUnit.MONTH:
        return `${Y}-${M}`;
      case SegmentationTimeUnit.YEAR:
        return `${Y}`;
    }
  }

  static generateLookbackKeys(
    unit: SegmentationTimeUnit,
    length: number,
    now: Date,
    utcOffsetMinutes: number
  ): string[] {
    const keys: string[] = [];
    for (let i = 0; i < length; i++) {
      const segmentDate = Streak.subtractSegment(now, unit, i, utcOffsetMinutes);
      keys.push(Streak.segmentKey(unit, segmentDate, utcOffsetMinutes));
    }
    return keys;
  }

  static async resolveStreaks(
    streakRequests: StreakRequest[],
    userId: string,
    utcOffsetMinutes: number
  ): Promise<Record<string, FactValue>> {
    const results: Record<string, FactValue> = {};
    const now = new Date();

    for (const req of streakRequests) {
      const innerCtx = req.innerContext;
      if (innerCtx.operation !== FactOperation.ANALYSIS_CLASSIFICATION) {
        Logger.error(
          `[Streak] Unsupported innerContext operation '${innerCtx.operation}' for alias=${req.alias} — only analysisClassification is supported`
        );
        results[req.alias] = 0;
        continue;
      }

      const keys = Streak.generateLookbackKeys(req.segmentUnit, req.length, now, utcOffsetMinutes);

      const rows = await prisma.analysisClassificationResult.findMany({
        where: {
          userId,
          analysisType: innerCtx.analysisType,
          segmentUnit: req.segmentUnit,
          segmentKey: { in: keys },
        },
      });

      const byKey = new Map(
        rows.map(r => [r.segmentKey, JSON.parse(r.value) as FactValue])
      );

      let count = 0;
      for (const key of keys) {
        const value = byKey.get(key);
        if (value === undefined) {
          break;
        }
        if (!Streak.evalInner(value, req.innerOperator, req.innerValue)) {
          break;
        }
        count++;
      }

      Logger.log(
        `[Streak] alias=${req.alias} unit=${req.segmentUnit} length=${req.length} utcOffset=${utcOffsetMinutes} count=${count}`
      );
      results[req.alias] = count;
    }

    return results;
  }

  private static subtractSegment(
    now: Date,
    unit: SegmentationTimeUnit,
    n: number,
    utcOffsetMinutes: number
  ): Date {
    switch (unit) {
      case SegmentationTimeUnit.HOUR:
        return new Date(now.getTime() - n * 3600 * 1000);
      case SegmentationTimeUnit.DAY:
        return new Date(now.getTime() - n * 86400 * 1000);
      case SegmentationTimeUnit.WEEK:
        return new Date(now.getTime() - n * 7 * 86400 * 1000);
      case SegmentationTimeUnit.MONTH: {
        const localMs = now.getTime() + utcOffsetMinutes * 60 * 1000;
        const local = new Date(localMs);
        local.setUTCMonth(local.getUTCMonth() - n);
        return new Date(local.getTime() - utcOffsetMinutes * 60 * 1000);
      }
      case SegmentationTimeUnit.YEAR: {
        const localMs = now.getTime() + utcOffsetMinutes * 60 * 1000;
        const local = new Date(localMs);
        local.setUTCFullYear(local.getUTCFullYear() - n);
        return new Date(local.getTime() - utcOffsetMinutes * 60 * 1000);
      }
    }
  }

  private static isoWeek(localDate: Date): { year: number; week: number } {
    const d = new Date(
      Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { year: d.getUTCFullYear(), week };
  }

  private static evalInner(
    value: FactValue,
    operator: string,
    target: string | number | boolean
  ): boolean {
    switch (operator) {
      case "==": return value == target;
      case "!=": return value != target;
      case ">": return (value as number) > (target as number);
      case ">=": return (value as number) >= (target as number);
      case "<": return (value as number) < (target as number);
      case "<=": return (value as number) <= (target as number);
      case "contains": return String(value).includes(String(target));
      default:
        Logger.error(`[Streak] Unknown inner operator: ${operator}`);
        return false;
    }
  }
}
