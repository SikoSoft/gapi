import { FactContext, FactOperation, Streak as StreakSpec, StreakAlertConfig as StreakAlertConfigSpec, StreakContext, StreakResult } from "api-spec/models/Fact";
import { ListFilterTimeType } from "api-spec/models/List";
import { SegmentationTimeUnit } from "api-spec/models/Statistic";
import { ok, err, Result } from "neverthrow";
import { prisma } from "..";
import { Fact, FactValue } from "./Fact";
import { Logger } from "./Logger";
import { PrismaStreakConfig, SegmentInfo } from "../models/Streak";

export class Streak {
  static mapToSpec(row: PrismaStreakConfig): StreakSpec {
    return {
      id: row.id,
      name: row.name,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      context: row.context as unknown as StreakContext,
      alerts: row.alertConfigs.map((a): StreakAlertConfigSpec => ({
        id: a.id,
        streakId: a.streakId,
        userId: a.userId,
        noticeTime: a.noticeTime,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    };
  }

  static async list(userId: string): Promise<Result<StreakSpec[], Error>> {
    try {
      const rows = await prisma.streakConfig.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { alertConfigs: true },
      });
      return ok(rows.map(Streak.mapToSpec));
    } catch (e) {
      return err(new Error("Failed to list streaks", { cause: e }));
    }
  }

  static async create(userId: string, name: string, context: StreakContext): Promise<Result<StreakSpec, Error>> {
    try {
      const row = await prisma.streakConfig.create({
        data: { userId, name, context: context as object },
        include: { alertConfigs: true },
      });
      return ok(Streak.mapToSpec(row));
    } catch (e) {
      return err(new Error("Failed to create streak", { cause: e }));
    }
  }

  static async update(id: number, userId: string, name?: string, context?: StreakContext): Promise<Result<StreakSpec, Error>> {
    try {
      const row = await prisma.streakConfig.findFirst({ where: { id, userId } });
      if (!row) {
        return err(new Error("Streak not found"));
      }
      const updated = await prisma.streakConfig.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(context !== undefined && { context: context as object }),
        },
        include: { alertConfigs: true },
      });
      return ok(Streak.mapToSpec(updated));
    } catch (e) {
      return err(new Error("Failed to update streak", { cause: e }));
    }
  }

  /**
   * Invalidates the `FactCache` rows backing a single saved streak (`StreakConfig`),
   * scoped to `userId`. Streaks have no cache table of their own — `resolveContext`
   * caches each lookback segment as a separate `Fact.resolve` call, so this regenerates
   * the *current* set of segment context keys the same way `resolveContext` does and
   * deletes those rows. ANALYSIS_CLASSIFICATION streaks never touch `FactCache` (they
   * read `analysisClassificationResult` directly), so this is a no-op for them.
   */
  static async invalidateForConfig(
    streakConfigId: number,
    userId: string,
    utcOffsetMinutes: number
  ): Promise<Result<void, Error>> {
    try {
      const row = await prisma.streakConfig.findFirst({
        where: { id: streakConfigId, userId },
      });
      if (!row) {
        return err(new Error("Streak not found"));
      }
      const ctx = row.context as unknown as StreakContext;

      if (ctx.innerContext.operation === FactOperation.ANALYSIS_CLASSIFICATION) {
        Logger.log(`[Streak] invalidateForConfig id=${streakConfigId} op=ANALYSIS_CLASSIFICATION — no FactCache rows to clear`);
        return ok(undefined);
      }

      const segments = Streak.generateLookbackSegments(ctx.segmentUnit, ctx.length, new Date(), utcOffsetMinutes);
      const contextKeys = segments
        .map((segment) => Streak.injectDateRange(ctx.innerContext, segment.start, segment.end))
        .filter((injected): injected is FactContext => injected !== null)
        .map((injected) => Fact.contextKey(injected));

      Logger.log(`[Streak] invalidateForConfig id=${streakConfigId} clearing ${contextKeys.length} FactCache rows`);
      await prisma.factCache.deleteMany({ where: { userId, contextKey: { in: contextKeys } } });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to invalidate streak cache for config", { cause: error }));
    }
  }

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
   * Evaluates a single StreakContext for a user and returns the current and longest
   * consecutive run lengths. Used by both resolveStreaks (for DB-backed streaks) and
   * Medal.checkForDisbursement (for config-level StreakRequests without DB IDs).
   *
   * ANALYSIS_CLASSIFICATION queries the `analysisClassificationResult` table directly.
   * All other operations use Fact.resolve with a date range injected per segment.
   */
  static async resolveContext(
    ctx: StreakContext,
    userId: string,
    utcOffsetMinutes: number,
    bypassCache = false
  ): Promise<{ current: number; longest: number }> {
    const now = new Date();
    const op = ctx.innerContext.operation;
    const segments = Streak.generateLookbackSegments(ctx.segmentUnit, ctx.length, now, utcOffsetMinutes);
    let longest = 0;
    let current = 0;
    let runLength = 0;
    let currentStillActive = true;

    if (op === FactOperation.ANALYSIS_CLASSIFICATION) {
      const keys = segments.map(s => s.key);
      Logger.log(
        `[Streak] resolveContext ANALYSIS_CLASSIFICATION querying analysisClassificationResult` +
        ` analysisType=${ctx.innerContext.analysisType} segmentUnit=${ctx.segmentUnit} keys=[${keys.join(",")}]`
      );

      const rows = await prisma.analysisClassificationResult.findMany({
        where: {
          userId,
          analysisType: ctx.innerContext.analysisType,
          segmentUnit: ctx.segmentUnit,
          segmentKey: { in: keys },
        },
      });

      const byKey = new Map(rows.map(r => [r.segmentKey, JSON.parse(r.value) as FactValue]));
      const foundKeys = [...byKey.keys()];
      const missingKeys = keys.filter(k => !byKey.has(k));
      Logger.log(
        `[Streak] resolveContext DB returned rows=${rows.length}` +
        ` found=[${foundKeys.join(",")}]` +
        ` missing=[${missingKeys.join(",")}]`
      );

      // Segment 0 is the current (possibly in-progress) period. Classification results for
      // the current period may not have been written yet even when the user has met the
      // condition today, because results are computed and stored on a schedule. Treating a
      // missing segment-0 row as a streak break would always reset `current` to 0 mid-day.
      // We skip it instead so the current streak reflects the unbroken run up through the
      // most recently completed period.
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const value = byKey.get(segment.key);
        if (i === 0 && value === undefined) {
          Logger.log(
            `[Streak] resolveContext segment=${segment.key} (current period) has no data yet — skipping without breaking streak`
          );
          continue;
        }
        if (value !== undefined && Streak.evalInner(value, ctx.innerOperator, ctx.innerValue)) {
          runLength++;
          if (currentStillActive) { current = runLength; }
          if (runLength > longest) { longest = runLength; }
          Logger.log(
            `[Streak] resolveContext segment=${segment.key} value=${JSON.stringify(value)}` +
            ` condition: ${JSON.stringify(value)} ${ctx.innerOperator} ${JSON.stringify(ctx.innerValue)} → PASS` +
            ` runLength=${runLength} current=${current} longest=${longest}`
          );
        } else {
          const reason = value === undefined ? "no data" : `${JSON.stringify(value)} ${ctx.innerOperator} ${JSON.stringify(ctx.innerValue)} is false`;
          Logger.log(
            `[Streak] resolveContext segment=${segment.key} value=${JSON.stringify(value)}` +
            ` → RESET (${reason}) runLength=0 current=${current} longest=${longest}`
          );
          currentStillActive = false;
          runLength = 0;
        }
      }
    } else {
      // Segment 0 is the current (possibly in-progress) period. Fact data for the current
      // period may return undefined or zero simply because the period hasn't ended yet, not
      // because the user failed the condition. Skipping a missing segment-0 value preserves
      // the current streak through the most recently completed period rather than always
      // resetting it to 0 mid-period.
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const injected = Streak.injectDateRange(ctx.innerContext, segment.start, segment.end);
        if (!injected) {
          Logger.error(
            `[Streak] resolveContext Cannot inject date range into op=${op} — skipping remaining segments`
          );
          break;
        }

        const contextKey = Fact.contextKey(injected);
        Logger.log(
          `[Streak] resolveContext segment=${segment.key}` +
          ` [${segment.start.toISOString()} → ${segment.end.toISOString()}]` +
          ` injected op=${op} contextKey=${contextKey} — calling Fact.resolve...`
        );

        const value = await Fact.resolve(injected, userId, { bypassCache });
        if (i === 0 && value === undefined) {
          Logger.log(
            `[Streak] resolveContext segment=${segment.key} (current period) returned undefined — skipping without breaking streak`
          );
          continue;
        }
        if (value !== undefined && Streak.evalInner(value, ctx.innerOperator, ctx.innerValue)) {
          runLength++;
          if (currentStillActive) { current = runLength; }
          if (runLength > longest) { longest = runLength; }
          Logger.log(
            `[Streak] resolveContext segment=${segment.key} value=${JSON.stringify(value)}` +
            ` condition: ${JSON.stringify(value)} ${ctx.innerOperator} ${JSON.stringify(ctx.innerValue)} → PASS` +
            ` runLength=${runLength} current=${current} longest=${longest}`
          );
        } else {
          const reason = value === undefined ? "undefined from Fact.resolve" : `${JSON.stringify(value)} ${ctx.innerOperator} ${JSON.stringify(ctx.innerValue)} is false`;
          Logger.log(
            `[Streak] resolveContext segment=${segment.key} value=${JSON.stringify(value)}` +
            ` → RESET (${reason}) runLength=0 current=${current} longest=${longest}`
          );
          currentStillActive = false;
          runLength = 0;
        }
      }
    }

    Logger.log(`[Streak] resolveContext COMPLETE op=${op} current=${current} longest=${longest}`);
    return { current, longest };
  }

  /**
   * Evaluates every saved Streak and returns a StreakResult[] with separate `current`
   * (consecutive count from the most recent period backwards until first break) and
   * `longest` (longest consecutive run anywhere in the lookback window).
   *
   * ANALYSIS_CLASSIFICATION streaks query the `analysisClassificationResult` table by
   * (userId, analysisType, segmentUnit, segmentKey). The `filter` field on the innerContext
   * is NOT applied here — it is required by the FactContext type but unused in this path.
   *
   * All other operations use `Fact.resolve` with a date range injected by `injectDateRange`.
   */
  static async resolveStreaks(
    streaks: StreakSpec[],
    userId: string,
    utcOffsetMinutes: number,
    bypassCache = false
  ): Promise<StreakResult[]> {
    const results: StreakResult[] = [];

    for (const streak of streaks) {
      const ctx = streak.context;
      Logger.log(
        `[Streak] resolveStreaks start id=${streak.id} op=${ctx.innerContext.operation} segmentUnit=${ctx.segmentUnit}` +
        ` length=${ctx.length} utcOffset=${utcOffsetMinutes} operator=${ctx.innerOperator} innerValue=${JSON.stringify(ctx.innerValue)}`
      );

      const { current, longest } = await Streak.resolveContext(ctx, userId, utcOffsetMinutes, bypassCache);

      Logger.log(
        `[Streak] resolveStreaks id=${streak.id} COMPLETE current=${current} longest=${longest}`
      );
      results.push({ streakId: streak.id, current, longest });
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
