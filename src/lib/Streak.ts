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
   * Evaluates every StreakRequest and returns a map of alias → longest consecutive count
   * found anywhere within the lookback window.
   *
   * All `length` segments are examined regardless of where breaks occur, so a gap caused
   * by missing data (e.g. scheduler downtime) does not hide an earlier run. A segment
   * where the condition fails or data is absent resets the current run; the highest run
   * seen across the full window is returned.
   *
   * ANALYSIS_CLASSIFICATION streaks query the `analysisClassificationResult` table by
   * (userId, analysisType, segmentUnit, segmentKey). The `filter` field on the innerContext
   * is NOT applied here — it is required by the FactContext type but unused in this path.
   *
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
      const op = req.innerContext.operation;
      Logger.log(
        `[Streak] resolveStreaks start alias=${req.alias} op=${op} segmentUnit=${req.segmentUnit}` +
        ` length=${req.length} utcOffset=${utcOffsetMinutes} operator=${req.innerOperator} innerValue=${JSON.stringify(req.innerValue)}`
      );

      const segments = Streak.generateLookbackSegments(req.segmentUnit, req.length, now, utcOffsetMinutes);
      let maxCount = 0;
      let currentCount = 0;

      if (op === FactOperation.ANALYSIS_CLASSIFICATION) {
        const keys = segments.map(s => s.key);
        Logger.log(
          `[Streak] resolveStreaks alias=${req.alias} ANALYSIS_CLASSIFICATION querying analysisClassificationResult` +
          ` analysisType=${req.innerContext.analysisType} segmentUnit=${req.segmentUnit} keys=[${keys.join(",")}]`
        );

        const rows = await prisma.analysisClassificationResult.findMany({
          where: {
            userId,
            analysisType: req.innerContext.analysisType,
            segmentUnit: req.segmentUnit,
            segmentKey: { in: keys },
          },
        });

        const byKey = new Map(rows.map(r => [r.segmentKey, JSON.parse(r.value) as FactValue]));
        const foundKeys = [...byKey.keys()];
        const missingKeys = keys.filter(k => !byKey.has(k));
        Logger.log(
          `[Streak] resolveStreaks alias=${req.alias} DB returned rows=${rows.length}` +
          ` found=[${foundKeys.join(",")}]` +
          ` missing=[${missingKeys.join(",")}]`
        );

        for (const segment of segments) {
          const value = byKey.get(segment.key);
          if (value !== undefined && Streak.evalInner(value, req.innerOperator, req.innerValue)) {
            currentCount++;
            if (currentCount > maxCount) { maxCount = currentCount; }
            Logger.log(
              `[Streak] resolveStreaks alias=${req.alias} segment=${segment.key} value=${JSON.stringify(value)}` +
              ` condition: ${JSON.stringify(value)} ${req.innerOperator} ${JSON.stringify(req.innerValue)} → PASS` +
              ` currentCount=${currentCount} maxCount=${maxCount}`
            );
          } else {
            const reason = value === undefined ? "no data" : `${JSON.stringify(value)} ${req.innerOperator} ${JSON.stringify(req.innerValue)} is false`;
            Logger.log(
              `[Streak] resolveStreaks alias=${req.alias} segment=${segment.key} value=${JSON.stringify(value)}` +
              ` → RESET (${reason}) currentCount=0 maxCount=${maxCount}`
            );
            currentCount = 0;
          }
        }
      } else {
        for (const segment of segments) {
          const ctx = Streak.injectDateRange(req.innerContext, segment.start, segment.end);
          if (!ctx) {
            Logger.error(
              `[Streak] resolveStreaks alias=${req.alias} Cannot inject date range into op=${op} — skipping remaining segments`
            );
            break;
          }

          const contextKey = Fact.contextKey(ctx);
          Logger.log(
            `[Streak] resolveStreaks alias=${req.alias} segment=${segment.key}` +
            ` [${segment.start.toISOString()} → ${segment.end.toISOString()}]` +
            ` injected op=${op} contextKey=${contextKey} — calling Fact.resolve...`
          );

          const value = await Fact.resolve(ctx, userId);
          if (value !== undefined && Streak.evalInner(value, req.innerOperator, req.innerValue)) {
            currentCount++;
            if (currentCount > maxCount) { maxCount = currentCount; }
            Logger.log(
              `[Streak] resolveStreaks alias=${req.alias} segment=${segment.key} value=${JSON.stringify(value)}` +
              ` condition: ${JSON.stringify(value)} ${req.innerOperator} ${JSON.stringify(req.innerValue)} → PASS` +
              ` currentCount=${currentCount} maxCount=${maxCount}`
            );
          } else {
            const reason = value === undefined ? "undefined from Fact.resolve" : `${JSON.stringify(value)} ${req.innerOperator} ${JSON.stringify(req.innerValue)} is false`;
            Logger.log(
              `[Streak] resolveStreaks alias=${req.alias} segment=${segment.key} value=${JSON.stringify(value)}` +
              ` → RESET (${reason}) currentCount=0 maxCount=${maxCount}`
            );
            currentCount = 0;
          }
        }
      }

      const count = Math.max(maxCount, currentCount);
      Logger.log(
        `[Streak] resolveStreaks alias=${req.alias} COMPLETE maxRun=${maxCount} finalCurrent=${currentCount} count=${count}`
      );
      results[req.alias] = count;
    }

    return results;
  }

  /**
   * Builds an ordered array of the `length` most recent segments ending at `now`,
   * each carrying its key and exact UTC start/end boundaries.
   * Segment 0 is the current (possibly incomplete) period; segment `length - 1` is the oldest.
   */
  static generateLookbackSegments(
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
    if (segments.length > 0) {
      const newest = segments[0];
      const oldest = segments[segments.length - 1];
      Logger.log(
        `[Streak] generateLookbackSegments unit=${unit} length=${length} utcOffset=${utcOffsetMinutes} now=${now.toISOString()}` +
        ` → newest: key=${newest.key} [${newest.start.toISOString()} → ${newest.end.toISOString()}]` +
        ` oldest: key=${oldest.key} [${oldest.start.toISOString()} → ${oldest.end.toISOString()}]`
      );
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
   * ENTITY_COUNT, UNIQUE_TAG_COUNT, and PROPERTY_SUM inject the range into filter.time.
   * MEDAL_COUNT injects into top-level start/end fields.
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
      case FactOperation.PROPERTY_SUM:
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
