import { AnalysisClassificationType, FactOperation } from "api-spec/models/Fact";
import { StreakRequest } from "api-spec/models/Medal";
import { SettingName } from "api-spec/models/Setting";
import { ListFilter, ListFilterTimeType } from "api-spec/models/List";
import { SegmentationTimeUnit } from "api-spec/models/Statistic";
import { HookType } from "../models/Hook";
import { AssistSegment, ChartEntity, ChartEntityProperty } from "../models/Chart";
import { prisma } from "..";
import { Assist } from "./Assist";
import { EntityListQueryBuilder } from "./EntityListQueryBuilder";
import { Hook } from "./Hook";
import { Logger } from "./Logger";
import { Setting } from "./Setting";
import { Streak } from "./Streak";

interface ClassificationTarget {
  analysisType: AnalysisClassificationType;
  segmentUnit: SegmentationTimeUnit;
  filter: ListFilter;
}

export class AnalysisClassificationScheduler {
  /**
   * Entry point for the daily timer. Discovers every unique (analysisType, segmentUnit)
   * pair referenced by any MedalConfig streakRequest, finds qualifying users for each,
   * and requests AI classification of their most recently completed period. Results are
   * written to analysisClassificationResult and a hook is triggered per user so that
   * medal disbursement runs immediately after each write.
   */
  static async run(): Promise<void> {
    const targets = await AnalysisClassificationScheduler.collectTargets();
    Logger.log(`[AnalysisClassificationScheduler] run targets=${targets.length}`);

    const now = new Date();

    for (const target of targets) {
      await AnalysisClassificationScheduler.processTarget(target, now);
    }
  }

  /**
   * Scans all MedalConfigs and returns the unique (analysisType, segmentUnit, filter)
   * combinations from any streakRequest that uses ANALYSIS_CLASSIFICATION.
   * Deduplicates on (analysisType, segmentUnit) — the first filter encountered wins,
   * since analysisClassificationResult stores one value per (user, type, unit, key)
   * regardless of which medal config requested it.
   */
  private static async collectTargets(): Promise<ClassificationTarget[]> {
    const configs = await prisma.medalConfig.findMany();
    const seen = new Set<string>();
    const targets: ClassificationTarget[] = [];

    for (const config of configs) {
      const streakRequests = config.streakRequests as unknown as StreakRequest[];
      for (const req of streakRequests) {
        if (req.innerContext.operation !== FactOperation.ANALYSIS_CLASSIFICATION) {
          continue;
        }
        const key = `${req.innerContext.analysisType}:${req.segmentUnit}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        targets.push({
          analysisType: req.innerContext.analysisType,
          segmentUnit: req.segmentUnit,
          filter: req.innerContext.filter,
        });
      }
    }

    return targets;
  }

  /**
   * Returns entityConfig IDs eligible for AI classification: those with
   * aiClassifyEnabled = true, intersected with filter.includeTypes when that
   * list is non-empty. An empty filter.includeTypes means all aiClassifyEnabled
   * configs qualify.
   */
  private static async eligibleEntityConfigIds(filter: ListFilter): Promise<number[]> {
    const rows = await prisma.entityConfig.findMany({
      where: { aiClassifyEnabled: true },
      select: { id: true },
    });
    const aiEnabled = rows.map(r => r.id);

    if (filter.includeTypes && filter.includeTypes.length > 0) {
      return aiEnabled.filter(id => filter.includeTypes!.includes(id));
    }

    return aiEnabled;
  }

  /**
   * Resolves eligible entity configs, finds distinct users who have created
   * entities of those types in the last 30 days, and classifies the most
   * recently completed segment for each.
   */
  private static async processTarget(target: ClassificationTarget, now: Date): Promise<void> {
    const eligibleConfigIds = await AnalysisClassificationScheduler.eligibleEntityConfigIds(
      target.filter
    );

    if (eligibleConfigIds.length === 0) {
      Logger.log(
        `[AnalysisClassificationScheduler] no aiClassifyEnabled entityConfigs for analysisType=${target.analysisType} — skipping`
      );
      return;
    }

    const recentUserRows = await prisma.entity.findMany({
      where: {
        entityConfigId: { in: eligibleConfigIds },
        createdAt: { gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) },
      },
      select: { userId: true },
      distinct: ["userId"],
    });

    Logger.log(
      `[AnalysisClassificationScheduler] analysisType=${target.analysisType} segmentUnit=${target.segmentUnit} eligibleConfigs=${eligibleConfigIds.length} users=${recentUserRows.length}`
    );

    for (const { userId } of recentUserRows) {
      await AnalysisClassificationScheduler.classifyForUser(
        userId,
        target,
        eligibleConfigIds,
        now
      );
    }
  }

  /**
   * Classifies the most recently completed segment for one user:
   * 1. Reads the user's UTC offset from TIMEZONE setting.
   * 2. Computes the just-completed segment boundary (segments[1] = one full period back).
   * 3. Skips if a result already exists for that segment.
   * 4. Fetches entities for the window using the target filter restricted to eligible configs.
   * 5. Calls Assist.analyzeChart and upserts results.
   * 6. Triggers a hook so medal disbursement runs immediately after each write.
   */
  private static async classifyForUser(
    userId: string,
    target: ClassificationTarget,
    eligibleConfigIds: number[],
    now: Date
  ): Promise<void> {
    const settingsRes = await Setting.getForUser(userId);
    const utcOffsetMinutes = settingsRes.isOk()
      ? ((settingsRes.value[SettingName.TIMEZONE] as number) ?? 0)
      : 0;

    // segments[0] = current (possibly incomplete) period
    // segments[1] = the just-completed period we want to classify
    const segments = Streak.generateLookbackSegments(
      target.segmentUnit,
      2,
      now,
      utcOffsetMinutes
    );

    if (segments.length < 2) {
      return;
    }

    const segment = segments[1];

    const existing = await prisma.analysisClassificationResult.findUnique({
      where: {
        userId_analysisType_segmentUnit_segmentKey: {
          userId,
          analysisType: target.analysisType,
          segmentUnit: target.segmentUnit,
          segmentKey: segment.key,
        },
      },
    });

    if (existing) {
      Logger.log(
        `[AnalysisClassificationScheduler] userId=${userId} analysisType=${target.analysisType} segmentKey=${segment.key} already classified — skipping`
      );
      return;
    }

    // Restrict entity fetch to the eligible config IDs so aiClassifyEnabled is always enforced,
    // even when filter.includeTypes was empty (meaning "all aiClassifyEnabled types").
    const entities = await AnalysisClassificationScheduler.fetchEntitiesForSegment(
      userId,
      { ...target.filter, includeTypes: eligibleConfigIds },
      segment.start,
      segment.end
    );

    if (entities.length === 0) {
      Logger.log(
        `[AnalysisClassificationScheduler] userId=${userId} analysisType=${target.analysisType} segmentKey=${segment.key} no entities — skipping`
      );
      return;
    }

    const assistSegment: AssistSegment = {
      key: segment.key,
      start: segment.start.toISOString(),
      end: segment.end.toISOString(),
    };

    const assistResult = await Assist.analyzeChart({
      analysisType: target.analysisType,
      entities,
      segments: [assistSegment],
    });

    if (assistResult.isErr()) {
      Logger.error(
        `[AnalysisClassificationScheduler] Assist.analyzeChart failed userId=${userId} analysisType=${target.analysisType} segmentKey=${segment.key}`,
        { error: assistResult.error }
      );
      return;
    }

    let wroteAny = false;

    for (const { key, value } of assistResult.value.results) {
      if (value === null) {
        continue;
      }
      try {
        await prisma.analysisClassificationResult.upsert({
          where: {
            userId_analysisType_segmentUnit_segmentKey: {
              userId,
              analysisType: target.analysisType,
              segmentUnit: target.segmentUnit,
              segmentKey: key,
            },
          },
          create: {
            userId,
            analysisType: target.analysisType,
            segmentUnit: target.segmentUnit,
            segmentKey: key,
            value: JSON.stringify(value),
          },
          update: { value: JSON.stringify(value) },
        });
        Logger.log(
          `[AnalysisClassificationScheduler] upserted userId=${userId} analysisType=${target.analysisType} segmentUnit=${target.segmentUnit} segmentKey=${key} value=${value}`
        );
        wroteAny = true;
      } catch (error) {
        Logger.error(
          `[AnalysisClassificationScheduler] upsert failed userId=${userId} analysisType=${target.analysisType} segmentKey=${key}`,
          { error }
        );
      }
    }

    if (wroteAny) {
      await Hook.trigger({
        type: HookType.POST_ANALYSIS_CLASSIFICATION,
        userId,
        analysisType: target.analysisType,
        segmentUnit: target.segmentUnit,
        segmentKey: segment.key,
        value: assistResult.value.results.find(r => r.key === segment.key)?.value ?? 0,
      });
    }
  }

  /**
   * Fetches entities for a user within a date range, applying the provided filter
   * (which already has includeTypes restricted to aiClassifyEnabled configs) combined
   * with the segment's time bounds. Returns entities in the shape expected by Assist.
   */
  private static async fetchEntitiesForSegment(
    userId: string,
    filter: ListFilter,
    start: Date,
    end: Date
  ): Promise<ChartEntity[]> {
    const builder = new EntityListQueryBuilder();
    builder.setUserId(userId);
    builder.setFilter({
      ...filter,
      time: {
        type: ListFilterTimeType.RANGE,
        start: start.toISOString(),
        end: end.toISOString(),
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
        booleanProperties: { include: { propertyValue: { select: { value: true } } } },
        dateProperties: { include: { propertyValue: { select: { value: true } } } },
        intProperties: { include: { propertyValue: { select: { value: true } } } },
        longTextProperties: { include: { propertyValue: { select: { value: true } } } },
        shortTextProperties: { include: { propertyValue: { select: { value: true } } } },
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
}
