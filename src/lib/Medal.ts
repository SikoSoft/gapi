import { Result, err, ok } from "neverthrow";
import { Prisma } from "@prisma/client";
import { prisma } from "..";
import { Medal as MedalSpec } from "api-spec/models";
import { Criteria, Criterion, FactRequest } from "api-spec/models/Medal";
import { HookContext } from "../models/Hook";
import {
  MedalConfigCreateBody,
  MedalConfigUpdateBody,
  PrismaMedal,
  PrismaMedalConfig,
} from "../models/Medal";
import { Fact, FactValue } from "./Fact";
import { Logger } from "./Logger";

export class Medal {
  static mapConfigToSpec(config: PrismaMedalConfig): MedalSpec.MedalConfig {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      series: config.series,
      recurrence: config.recurrence,
      prestige: config.prestige,
      icon: config.icon,
      factRequests: config.factRequests as unknown as MedalSpec.FactRequest[],
      criteria: config.criteria as MedalSpec.Criterion | MedalSpec.Criteria,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  static mapMedalToSpec(medal: PrismaMedal): MedalSpec.Medal {
    return {
      id: medal.id,
      userId: medal.userId,
      medalConfigId: medal.medalConfigId,
      awardedAt: medal.awardedAt.toISOString(),
    };
  }

  static async createConfig(
    body: MedalConfigCreateBody
  ): Promise<Result<MedalSpec.MedalConfig, Error>> {
    const invalidAliases = Medal.invalidCriteriaAliases(body.criteria, body.factRequests);
    if (invalidAliases.length > 0) {
      return err(
        new Error(`Criteria reference undefined fact aliases: ${invalidAliases.join(", ")}`)
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
          criteria: body.criteria as Prisma.InputJsonValue,
        },
      });
      return ok(Medal.mapConfigToSpec(config));
    } catch (error) {
      return err(new Error("Failed to create medal config", { cause: error }));
    }
  }

  static async updateConfig(
    id: number,
    body: MedalConfigUpdateBody
  ): Promise<Result<MedalSpec.MedalConfig, Error>> {
    const invalidAliases = Medal.invalidCriteriaAliases(body.criteria, body.factRequests);
    if (invalidAliases.length > 0) {
      return err(
        new Error(`Criteria reference undefined fact aliases: ${invalidAliases.join(", ")}`)
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
          criteria: body.criteria as Prisma.InputJsonValue,
        },
      });
      return ok(Medal.mapConfigToSpec(config));
    } catch (error) {
      return err(new Error("Failed to update medal config", { cause: error }));
    }
  }

  static async deleteConfig(id: number): Promise<Result<void, Error>> {
    try {
      await prisma.medalConfig.delete({ where: { id } });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to delete medal config", { cause: error }));
    }
  }

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

  static async checkForDisbursement(context: HookContext): Promise<void> {
    const { userId } = context;

    const configsRes = await Medal.getConfigs();
    if (configsRes.isErr()) {
      Logger.error("[Medal] Failed to load medal configs", {
        error: configsRes.error,
      });
      return;
    }

    for (const config of configsRes.value) {
      const facts: Record<string, FactValue> = {};
      let factsResolved = true;

      for (const factRequest of config.factRequests) {
        const value = await Fact.resolve(factRequest, userId);
        if (value === undefined) {
          Logger.error(
            `[Medal] Unresolved fact '${factRequest.alias}' for medalConfig ${config.id} — skipping config`
          );
          factsResolved = false;
          break;
        }
        facts[factRequest.alias] = value;
      }

      if (!factsResolved) {
        continue;
      }

      const criteria = config.criteria as Criterion | Criteria;
      if (!Medal.evaluateCriteria(criteria, facts)) {
        continue;
      }

      const existingCount = await prisma.medal.count({
        where: { userId, medalConfigId: config.id },
      });

      if (config.recurrence === 0 && existingCount > 0) {
        continue;
      }

      const giveRes = await Medal.giveMedal(userId, config.id);
      if (giveRes.isErr()) {
        Logger.error(
          `[Medal] Failed to give medal ${config.id} to user ${userId}`,
          { error: giveRes.error }
        );
      }
    }
  }

  private static collectCriteriaAliases(
    criteria: Criterion | Criteria
  ): string[] {
    if ("fact" in criteria) {
      return [criteria.fact];
    }
    return [
      ...(criteria.all ?? []),
      ...(criteria.any ?? []),
    ].flatMap(child =>
      Medal.collectCriteriaAliases(child as Criterion | Criteria)
    );
  }

  private static invalidCriteriaAliases(
    criteria: Criterion | Criteria,
    factRequests: FactRequest[]
  ): string[] {
    const defined = new Set(factRequests.map(fr => fr.alias));
    return Medal.collectCriteriaAliases(criteria).filter(
      alias => !defined.has(alias)
    );
  }

  private static evaluateCriteria(
    criteria: Criterion | Criteria,
    facts: Record<string, FactValue>
  ): boolean {
    if ("fact" in criteria) {
      return Medal.evaluateCriterion(criteria, facts);
    }
    if (criteria.all) {
      return criteria.all.every(child =>
        Medal.evaluateCriteria(child as Criterion | Criteria, facts)
      );
    }
    if (criteria.any) {
      return criteria.any.some(child =>
        Medal.evaluateCriteria(child as Criterion | Criteria, facts)
      );
    }
    return false;
  }

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
