import { Result, err, ok } from "neverthrow";
import { Prisma } from "@prisma/client";
import { prisma } from "..";
import { Medal as MedalSpec } from "api-spec/models";
import { Criteria, Criterion } from "api-spec/models/Medal";
import { FactRequest, StreakRequest } from "api-spec/models/Fact";
import { SettingName } from "api-spec/models/Setting";
import { HookContext } from "../models/Hook";
import {
  CriteriaProgress,
  MedalConfigCreateBody,
  MedalConfigUpdateBody,
  MedalConfigWithProgress,
  PrismaMedal,
  PrismaMedalConfig,
} from "../models/Medal";
import { Fact, FactValue } from "./Fact";
import { Logger } from "./Logger";
import { Notification } from "./Notification";
import { Setting } from "./Setting";
import { Streak } from "./Streak";

export class Medal {
  /** Converts a Prisma MedalConfig row to the api-spec wire contract. */
  static mapConfigToSpec(config: PrismaMedalConfig): MedalSpec.MedalConfig {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      series: config.series,
      recurrence: config.recurrence,
      prestige: config.prestige,
      icon: config.icon,
      factRequests: config.factRequests as unknown as FactRequest[],
      streakRequests: (config.streakRequests as unknown as StreakRequest[] | null) ?? [],
      criteria: config.criteria as MedalSpec.Criterion | MedalSpec.Criteria,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  /** Converts a Prisma Medal row (an earned instance) to the api-spec wire contract. */
  static mapMedalToSpec(medal: PrismaMedal): MedalSpec.Medal {
    return {
      id: medal.id,
      userId: medal.userId,
      medalConfigId: medal.medalConfigId,
      awardedAt: medal.awardedAt.toISOString(),
    };
  }

  /**
   * Creates a new MedalConfig. Validates that every alias referenced in `criteria`
   * is declared in either `factRequests` or `streakRequests`; rejects with an error
   * listing the unknown aliases otherwise.
   */
  static async createConfig(
    body: MedalConfigCreateBody
  ): Promise<Result<MedalSpec.MedalConfig, Error>> {
    const invalidAliases = Medal.invalidCriteriaAliases(
      body.criteria,
      body.factRequests,
      body.streakRequests
    );
    if (invalidAliases.length > 0) {
      return err(
        new Error(
          `Criteria reference undefined aliases: ${invalidAliases.join(", ")}`
        )
      );
    }
    try {
      const config = await prisma.medalConfig.create({
        data: {
          name: body.name,
          description: body.description,
          series: body.series,
          recurrence: body.recurrence,
          prestige: body.prestige,
          icon: body.icon,
          factRequests: body.factRequests as unknown as Prisma.InputJsonValue,
          streakRequests: body.streakRequests as unknown as Prisma.InputJsonValue,
          criteria: body.criteria as Prisma.InputJsonValue,
        },
      });
      return ok(Medal.mapConfigToSpec(config));
    } catch (error) {
      return err(new Error("Failed to create medal config", { cause: error }));
    }
  }

  /** Updates an existing MedalConfig. Applies the same alias-validation as `createConfig`. */
  static async updateConfig(
    id: number,
    body: MedalConfigUpdateBody
  ): Promise<Result<MedalSpec.MedalConfig, Error>> {
    const invalidAliases = Medal.invalidCriteriaAliases(
      body.criteria,
      body.factRequests,
      body.streakRequests
    );
    if (invalidAliases.length > 0) {
      return err(
        new Error(
          `Criteria reference undefined aliases: ${invalidAliases.join(", ")}`
        )
      );
    }
    try {
      const config = await prisma.medalConfig.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          series: body.series,
          recurrence: body.recurrence,
          prestige: body.prestige,
          icon: body.icon,
          factRequests: body.factRequests as unknown as Prisma.InputJsonValue,
          streakRequests: body.streakRequests as unknown as Prisma.InputJsonValue,
          criteria: body.criteria as Prisma.InputJsonValue,
        },
      });
      return ok(Medal.mapConfigToSpec(config));
    } catch (error) {
      return err(new Error("Failed to update medal config", { cause: error }));
    }
  }

  /** Deletes a MedalConfig and cascades to all earned Medal instances. */
  static async deleteConfig(id: number): Promise<Result<void, Error>> {
    try {
      await prisma.medalConfig.delete({ where: { id } });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to delete medal config", { cause: error }));
    }
  }

  /** Fetches a single MedalConfig by id. Returns an error if not found. */
  static async getConfig(
    id: number
  ): Promise<Result<MedalSpec.MedalConfig, Error>> {
    try {
      const config = await prisma.medalConfig.findUnique({ where: { id } });
      if (!config) {
        return err(new Error("Medal config not found"));
      }
      return ok(Medal.mapConfigToSpec(config));
    } catch (error) {
      return err(new Error("Failed to fetch medal config", { cause: error }));
    }
  }

  /** Returns all MedalConfigs ordered by `prestige` descending (highest first). */
  static async getConfigs(): Promise<Result<MedalSpec.MedalConfig[], Error>> {
    try {
      const configs = await prisma.medalConfig.findMany({
        orderBy: { prestige: "desc" },
      });
      return ok(configs.map(Medal.mapConfigToSpec));
    } catch (error) {
      return err(new Error("Failed to fetch medal configs", { cause: error }));
    }
  }

  /**
   * Returns a MedalConfig augmented with `criteriaProgress` — the user's current
   * resolved fact values for each factRequest. Used to render progress UI.
   * Note: streakRequest values are not included in criteriaProgress (only factRequests).
   */
  static async getConfigWithProgress(
    id: number,
    userId: string
  ): Promise<Result<MedalConfigWithProgress, Error>> {
    try {
      const config = await prisma.medalConfig.findUnique({ where: { id } });
      if (!config) {
        return err(new Error("Medal config not found"));
      }
      const base = Medal.mapConfigToSpec(config);
      const criteriaProgress = await Medal.resolveCriteriaProgress(
        base.factRequests,
        userId
      );
      return ok({ ...base, criteriaProgress });
    } catch (error) {
      return err(new Error("Failed to fetch medal config", { cause: error }));
    }
  }

  /** Returns all MedalConfigs with criteriaProgress, ordered by `prestige` descending. */
  static async getConfigsWithProgress(
    userId: string
  ): Promise<Result<MedalConfigWithProgress[], Error>> {
    try {
      const configs = await prisma.medalConfig.findMany({
        orderBy: { prestige: "desc" },
      });
      const results = await Promise.all(
        configs.map(async (config) => {
          const base = Medal.mapConfigToSpec(config);
          const criteriaProgress = await Medal.resolveCriteriaProgress(
            base.factRequests,
            userId
          );
          return { ...base, criteriaProgress };
        })
      );
      return ok(results);
    } catch (error) {
      return err(new Error("Failed to fetch medal configs", { cause: error }));
    }
  }

  /** Returns all medals the user has already earned, newest first. */
  static async getMedals(
    userId: string
  ): Promise<Result<MedalSpec.Medal[], Error>> {
    try {
      const medals = await prisma.medal.findMany({
        where: { userId },
        orderBy: { awardedAt: "desc" },
      });
      return ok(medals.map(Medal.mapMedalToSpec));
    } catch (error) {
      return err(new Error("Failed to fetch medals", { cause: error }));
    }
  }

  /**
   * Directly awards a medal without evaluating criteria or checking recurrence.
   * Intended for administrative/manual grants; normal disbursement goes through
   * `checkForDisbursement` which enforces all rules.
   */
  static async giveMedal(
    userId: string,
    medalConfigId: number
  ): Promise<Result<MedalSpec.Medal, Error>> {
    try {
      const medal = await prisma.medal.create({
        data: { userId, medalConfigId },
      });
      return ok(Medal.mapMedalToSpec(medal));
    } catch (error) {
      return err(new Error("Failed to give medal", { cause: error }));
    }
  }

  /**
   * Core hook entry point — called after user data changes to determine whether
   * any medals should be awarded. For each MedalConfig:
   *   1. Resolves all factRequests via Fact.resolve (cached).
   *   2. If any fact is unresolvable the config is skipped entirely.
   *   3. Resolves streakRequests via Streak.resolveStreaks (if present).
   *   4. Evaluates the criteria tree; skips if false.
   *   5. Creates a Medal record inside a Serializable transaction that also
   *      re-checks the recurrence cap atomically to prevent double-awards.
   *   6. Sends a push notification on success.
   *
   * The user's TIMEZONE setting (stored as UTC offset minutes) is used to localize
   * streak segment boundaries.
   */
  static async checkForDisbursement(context: HookContext): Promise<void> {
    const { userId } = context;

    const configsRes = await Medal.getConfigs();
    if (configsRes.isErr()) {
      Logger.error("[Medal] Failed to load medal configs", {
        error: configsRes.error,
      });
      return;
    }

    const settingsRes = await Setting.getForUser(userId);
    const utcOffsetMinutes = settingsRes.isOk()
      ? (settingsRes.value[SettingName.TIMEZONE] as number ?? 0)
      : 0;

    Logger.log(`[Medal] checkForDisbursement userId=${userId} configs=${configsRes.value.length} utcOffset=${utcOffsetMinutes}`);
    for (const config of configsRes.value) {
      const facts: Record<string, FactValue> = {};
      let factsResolved = true;

      Logger.log(`[Medal] processing config id=${config.id} name=${config.name} factRequests=${config.factRequests.length} streakRequests=${config.streakRequests.length}`);
      for (const factRequest of config.factRequests) {
        Logger.log(`[Medal] resolving fact alias=${factRequest.alias} op=${factRequest.context.operation} configId=${config.id}`);
        const value = await Fact.resolve(factRequest.context, userId);
        if (value === undefined) {
          Logger.error(
            `[Medal] Unresolved fact '${factRequest.alias}' for medalConfig ${config.id} — skipping config`
          );
          factsResolved = false;
          break;
        }
        Logger.log(`[Medal] resolved fact alias=${factRequest.alias} op=${factRequest.context.operation} configId=${config.id} value=${JSON.stringify(value)}`);
        facts[factRequest.alias] = value;
      }

      if (!factsResolved) {
        continue;
      }

      for (const streakReq of config.streakRequests) {
        const { current } = await Streak.resolveContext(streakReq.context, userId, utcOffsetMinutes);
        facts[streakReq.alias] = current;
      }

      const criteria = config.criteria as Criterion | Criteria;
      if (!Medal.evaluateCriteria(criteria, facts)) {
        continue;
      }

      let medalCreated = false;
      try {
        await prisma.$transaction(
          async (tx) => {
            const existingCount = await tx.medal.count({
              where: { userId, medalConfigId: config.id },
            });

            if (config.recurrence > 0 && existingCount >= config.recurrence) {
              return;
            }

            await tx.medal.create({
              data: { userId, medalConfigId: config.id },
            });
            medalCreated = true;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        Logger.error(
          `[Medal] Failed to give medal ${config.id} to user ${userId}`,
          { error }
        );
      }

      if (medalCreated) {
        const notificationResult = await Notification.send({
          userId,
          title: `Medal Earned: ${config.name}`,
          body: config.description,
          actions: [],
        });
        if (notificationResult.isErr()) {
          Logger.error(
            `[Medal] Failed to send notification for medal ${config.id} to user ${userId}`,
            { error: notificationResult.error }
          );
        }
      }
    }
  }

  /**
   * Resolves the current value of each factRequest for display purposes.
   * Entries whose fact resolves to undefined are omitted (e.g. ANALYSIS_CLASSIFICATION
   * before the pipeline has seeded its result).
   */
  private static async resolveCriteriaProgress(
    factRequests: FactRequest[],
    userId: string
  ): Promise<CriteriaProgress[]> {
    const progress: CriteriaProgress[] = [];
    for (const factRequest of factRequests) {
      const value = await Fact.resolve(factRequest.context, userId);
      if (value !== undefined) {
        progress.push({ alias: factRequest.alias, value });
      }
    }
    return progress;
  }

  /** Recursively extracts every alias string referenced in a criteria tree (leaf `fact` fields). */
  private static collectCriteriaAliases(
    criteria: Criterion | Criteria
  ): string[] {
    if ("fact" in criteria) {
      return [criteria.fact];
    }
    return [...(criteria.all ?? []), ...(criteria.any ?? [])].flatMap((child) =>
      Medal.collectCriteriaAliases(child as Criterion | Criteria)
    );
  }

  /**
   * Returns the list of aliases referenced in `criteria` that are not defined in
   * either `factRequests` or `streakRequests`. An empty array means the config is valid.
   */
  private static invalidCriteriaAliases(
    criteria: Criterion | Criteria,
    factRequests: FactRequest[],
    streakRequests: StreakRequest[] = []
  ): string[] {
    const defined = new Set([
      ...factRequests.map(fr => fr.alias),
      ...streakRequests.map(sr => sr.alias),
    ]);
    return Medal.collectCriteriaAliases(criteria).filter(
      (alias) => !defined.has(alias)
    );
  }

  /**
   * Recursively evaluates a criteria tree against resolved fact values.
   * A Criterion (leaf) delegates to `evaluateCriterion`.
   * A Criteria node with `all` requires every child to pass (logical AND).
   * A Criteria node with `any` requires at least one child to pass (logical OR).
   * An empty node (neither all nor any) returns false.
   */
  private static evaluateCriteria(
    criteria: Criterion | Criteria,
    facts: Record<string, FactValue>
  ): boolean {
    if ("fact" in criteria) {
      return Medal.evaluateCriterion(criteria, facts);
    }
    if (criteria.all) {
      return criteria.all.every((child) =>
        Medal.evaluateCriteria(child as Criterion | Criteria, facts)
      );
    }
    if (criteria.any) {
      return criteria.any.some((child) =>
        Medal.evaluateCriteria(child as Criterion | Criteria, facts)
      );
    }
    return false;
  }

  /**
   * Evaluates a single criterion leaf. Looks up the fact value by alias and applies
   * the operator. `contains` is array-membership when `value` is an array, otherwise
   * substring match. An unknown alias logs an error and returns false.
   */
  private static evaluateCriterion(
    criterion: Criterion,
    facts: Record<string, FactValue>
  ): boolean {
    const factValue = facts[criterion.fact];
    if (factValue === undefined) {
      Logger.error(
        `[Medal] Criterion references unknown fact alias '${criterion.fact}'`
      );
      return false;
    }
    const { operator, value } = criterion;

    switch (operator) {
      case "==":
        return factValue == value;
      case "!=":
        return factValue != value;
      case ">":
        return (factValue as number) > (value as number);
      case ">=":
        return (factValue as number) >= (value as number);
      case "<":
        return (factValue as number) < (value as number);
      case "<=":
        return (factValue as number) <= (value as number);
      case "contains":
        if (Array.isArray(value)) {
          return (value as unknown[]).includes(factValue);
        }
        return String(factValue).includes(String(value));
      default: {
        const exhaustive: never = operator;
        Logger.error(`[Medal] Unknown operator: ${exhaustive}`);
        return false;
      }
    }
  }
}
