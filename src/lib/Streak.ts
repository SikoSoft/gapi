import { FactContext, FactOperation } from "api-spec/models/Fact";
import { StreakRequest } from "api-spec/models/Medal";
import { ListFilterTimeType } from "api-spec/models/List";
import { SegmentationTimeUnit } from "api-spec/models/Statistic";
import { prisma } from "..";
import { Fact, FactValue } from "./Fact";
import { Logger } from "./Logger";
import { SegmentInfo } from "../models/Streak";

export class Streak {
  /**
   * Returns a human-readable string identifier for the segment that contains `utcDate`
   * after adjusting for the user's local timezone. Format by unit:
   * - HOUR  → "YYYY-MM-DDTHH"
   * - DAY   → "YYYY-MM-DD"
   * - WEEK  → "YYYY-Www" (ISO 8601, Monday-anchored)
   * - MONTH → "YYYY-MM"
   * - YEAR  → "YYYY"
   */
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

  /**
   * Convenience wrapper that returns only the key strings from `generateLookbackSegments`.
   * Index 0 is the current (most recent) period; index `length - 1` is the oldest.
   */
  static generateLookbackKeys(
    unit: SegmentationTimeUnit,
    length: number,
    now: Date,
    utcOffsetMinutes: number
  ): string[] {
    return Streak.generateLookbackSegments(unit, length, now, utcOffsetMinutes).map(s => s.key);
  }

  /**
   * Evaluates every StreakRequest and returns a map of alias → consecutive count.
   *
   * For each request the last `length` segments are walked from newest to oldest.
   * Evaluation stops at the first segment where the inner condition is not met —
   * that segment breaks the streak. The count is 0 if even the current segment fails.
   *
   * ANALYSIS_CLASSIFICATION streaks are resolved by querying the
   * `analysisClassificationResult` table directly (the Fact cache does not handle them).
   * All other operations use `Fact.resolve` with a date range injected by `injectDateRange`.
   */
  static async resolveStreaks(
    streakRequests: StreakRequest[],
    userId: string,
    utcOffsetMinutes: number
  ): Promise<Record<string, FactValue>> {
    const results: Record<string, FactValue> = {};
    const now = new Date();

    for (const req of streakRequests) {
      const segments = Streak.generateLookbackSegments(req.segmentUnit, req.length, now, utcOffsetMinutes);
      let count = 0;

      if (req.innerContext.operation === FactOperation.ANALYSIS_CLASSIFICATION) {
        const keys = segments.map(s => s.key);
        const rows = await prisma.analysisClassificationResult.findMany({
          where: {
            userId,
            analysisType: req.innerContext.analysisType,
            segmentUnit: req.segmentUnit,
            segmentKey: { in: keys },
          },
        });
        const byKey = new Map(rows.map(r => [r.segmentKey, JSON.parse(r.value) as FactValue]));
        for (const segment of segments) {
          const value = byKey.get(segment.key);
          if (value === undefined) {
            break;
          }
          if (!Streak.evalInner(value, req.innerOperator, req.innerValue)) {
            break;
          }
          count++;
        }
      } else {
        for (const segment of segments) {
          const ctx = Streak.injectDateRange(req.innerContext, segment.start, segment.end);
          if (!ctx) {
            Logger.error(
              `[Streak] Cannot inject date range into operation '${req.innerContext.operation}' for alias=${req.alias} — skipping`
            );
            break;
          }
          const value = await Fact.resolve(ctx, userId);
          if (value === undefined) {
            break;
          }
          if (!Streak.evalInner(value, req.innerOperator, req.innerValue)) {
            break;
          }
          count++;
        }
      }

      Logger.log(
        `[Streak] alias=${req.alias} unit=${req.segmentUnit} length=${req.length} utcOffset=${utcOffsetMinutes} count=${count}`
      );
      results[req.alias] = count;
    }

    return results;
  }

  /**
   * Builds an ordered array of the `length` most recent segments ending at `now`,
   * each carrying its key and exact UTC start/end boundaries.
   * Segment 0 is the current period; segment `length - 1` is the oldest.
   */
  private static generateLookbackSegments(
    unit: SegmentationTimeUnit,
    length: number,
    now: Date,
    utcOffsetMinutes: number
  ): SegmentInfo[] {
    const segments: SegmentInfo[] = [];
    for (let i = 0; i < length; i++) {
      const pivotUtc = Streak.subtractSegment(now, unit, i, utcOffsetMinutes);
      const key = Streak.segmentKey(unit, pivotUtc, utcOffsetMinutes);
      const { start, end } = Streak.segmentDateRange(unit, pivotUtc, utcOffsetMinutes);
      segments.push({ key, start, end });
    }
    return segments;
  }

  /**
   * Computes the inclusive UTC start and end of the segment that contains `pivotUtc`
   * after localizing by `utcOffsetMinutes`. Weeks are Monday-anchored (ISO 8601).
   * The returned dates are always in UTC regardless of the user's timezone.
   */
  private static segmentDateRange(
    unit: SegmentationTimeUnit,
    pivotUtc: Date,
    utcOffsetMinutes: number
  ): { start: Date; end: Date } {
    const localMs = pivotUtc.getTime() + utcOffsetMinutes * 60 * 1000;
    const local = new Date(localMs);

    let startLocalMs: number;
    let endLocalMs: number;

    switch (unit) {
      case SegmentationTimeUnit.HOUR: {
        const s = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), local.getUTCHours()));
        startLocalMs = s.getTime();
        endLocalMs = startLocalMs + 3600 * 1000 - 1;
        break;
      }
      case SegmentationTimeUnit.DAY: {
        const s = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
        startLocalMs = s.getTime();
        endLocalMs = startLocalMs + 86400 * 1000 - 1;
        break;
      }
      case SegmentationTimeUnit.WEEK: {
        const dayOfWeek = local.getUTCDay() || 7;
        const s = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (dayOfWeek - 1)));
        startLocalMs = s.getTime();
        endLocalMs = startLocalMs + 7 * 86400 * 1000 - 1;
        break;
      }
      case SegmentationTimeUnit.MONTH: {
        const s = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));
        startLocalMs = s.getTime();
        endLocalMs = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1)).getTime() - 1;
        break;
      }
      case SegmentationTimeUnit.YEAR: {
        const s = new Date(Date.UTC(local.getUTCFullYear(), 0, 1));
        startLocalMs = s.getTime();
        endLocalMs = new Date(Date.UTC(local.getUTCFullYear() + 1, 0, 1)).getTime() - 1;
        break;
      }
    }

    return {
      start: new Date(startLocalMs - utcOffsetMinutes * 60 * 1000),
      end: new Date(endLocalMs - utcOffsetMinutes * 60 * 1000),
    };
  }

  /**
   * Returns a copy of `ctx` with a time range filter injected so the fact is scoped
   * to a single streak segment. Returns null for operations that cannot accept a date
   * range (e.g. ANALYSIS_CLASSIFICATION, which is handled via a direct DB query instead).
   */
  private static injectDateRange(
    ctx: FactContext,
    start: Date,
    end: Date
  ): FactContext | null {
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    switch (ctx.operation) {
      case FactOperation.ENTITY_COUNT:
      case FactOperation.UNIQUE_TAG_COUNT:
        return {
          ...ctx,
          filter: {
            ...ctx.filter,
            time: { type: ListFilterTimeType.RANGE, start: startIso, end: endIso },
          },
        };
      case FactOperation.MEDAL_COUNT:
        return { ...ctx, start: startIso, end: endIso };
      default:
        return null;
    }
  }

  /**
   * Steps `n` periods into the past from `now`. HOUR/DAY/WEEK use fixed millisecond
   * arithmetic. MONTH/YEAR subtract calendar units in the user's local time to avoid
   * DST drift and variable-length month issues.
   */
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

  /**
   * Computes the ISO 8601 week number and corresponding year for `localDate`.
   * The ISO year may differ from the calendar year for dates in the first/last week.
   */
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

  /** Applies the streak's inner comparison operator to determine if a segment passes. */
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
