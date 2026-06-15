import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { Logger } from "./Logger";

export class EntitySuggestion {
  static async getPropertySuggestions(
    userId: string,
    propertyConfigId: number,
    query: string
  ): Promise<Result<string[], Error>> {
    try {
      const suggestions = await prisma.shortTextPropertyValue.findMany({
        distinct: ["value"],
        take: 10,
        where: {
          value: { startsWith: query, mode: "insensitive" },
          entityPropertyValue: {
            propertyConfigId,
          },
        },
        orderBy: { value: "asc" },
      });
      return ok(suggestions.map((s) => s.value));
    } catch (error) {
      return err(error);
    }
  }

  static async deleteStaleSuggestions(): Promise<Result<number, Error>> {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count } = await prisma.entity.deleteMany({
        where: {
          suggested: true,
          createdAt: { lte: cutoff },
        },
      });
      return ok(count);
    } catch (error) {
      return err(error);
    }
  }

  static async getSuggestions(
    userId: string,
    desc: string
  ): Promise<Result<string[], Error>> {
    try {
      const entities = await prisma.entity.findMany({
        take: 10,
        where: {
          userId,
        },
      });
      const suggestions = entities.map((e) => String(e.id));
      return ok(suggestions);
    } catch (error) {
      return err(error);
    }
  }

  static async suggestionExists(
    entityId: number
  ): Promise<Result<boolean, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId, suggested: true },
        select: { id: true },
      });
      return ok(entity !== null);
    } catch (error) {
      return err(
        new Error("Failed to check suggestion existence", { cause: error })
      );
    }
  }

  static async acceptSuggestion(
    entityId: number
  ): Promise<Result<void, Error>> {
    try {
      await prisma.entity.update({
        where: { id: entityId, suggested: true },
        data: { published: true },
      });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to accept suggestion", { cause: error }));
    }
  }

  static async hasMatchingEntityLoggedInPastHour(
    userId: string,
    entityConfigId: number,
    textValues: string[]
  ): Promise<Result<boolean, Error>> {
    try {
      if (textValues.length === 0) {
        Logger.log(
          "[Entity] hasMatchingEntityLoggedInPastHour: textValues is empty — skipping dedupe check"
        );
        return ok(false);
      }

      const oneHourAgo = new Date(Date.now() - 3600000);
      const entities = await prisma.entity.findMany({
        where: {
          userId,
          entityConfigId,
          suggested: false,
          createdAt: { gte: oneHourAgo },
        },
        include: {
          shortTextProperties: { include: { propertyValue: true } },
          longTextProperties: { include: { propertyValue: true } },
        },
      });

      Logger.log(
        `[Entity] hasMatchingEntityLoggedInPastHour: found ${entities.length} non-suggestion entities of type ${entityConfigId} logged in past hour`,
        { textValues }
      );

      for (const entity of entities) {
        const entityTextValues = [
          ...entity.shortTextProperties.map((p) => p.propertyValue.value),
          ...entity.longTextProperties.map((p) => p.propertyValue.value),
        ];

        if (textValues.every((v) => entityTextValues.includes(v))) {
          Logger.log(
            `[Entity] hasMatchingEntityLoggedInPastHour: match found on entity ${entity.id}`,
            { entityTextValues, textValues }
          );
          return ok(true);
        }
      }

      return ok(false);
    } catch (error) {
      return err(
        new Error("Failed to check for matching entity", { cause: error })
      );
    }
  }
}
