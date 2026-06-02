import { Result, err, ok } from "neverthrow";
import { SettingName } from "api-spec/models/Setting";
import { prisma } from "..";
import { prismaListConfigInclude } from "../models/ListConfig";
import {
  AssistAnalyzeChartRequest,
  AssistAnalyzeChartResponse,
} from "../models/Chart";
import { Setting } from "./Setting";

export class Assist {
  static async analyzeChart(
    body: AssistAnalyzeChartRequest
  ): Promise<Result<AssistAnalyzeChartResponse, Error>> {
    try {
      const upstreamBaseUrl = process.env.ASSIST_API_BASE_URL;
      if (!upstreamBaseUrl) {
        return err(new Error("Missing ASSIST_API_BASE_URL environment variable"));
      }

      const url = new URL("/assist/analyzeChart", upstreamBaseUrl);
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: process.env.SYSTEM_API_KEY || "",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return err(
          new Error(`Assist analyzeChart returned ${response.status}`)
        );
      }

      return ok((await response.json()) as AssistAnalyzeChartResponse);
    } catch (error) {
      return err(new Error("Failed to call Assist analyzeChart", { cause: error }));
    }
  }

  static async getSuggestionLock(
    yyyy: number,
    mm: number,
    dd: number
  ): Promise<Result<boolean, Error>> {
    try {
      const lock = await prisma.suggestionLock.findUnique({
        where: { yyyy_mm_dd: { yyyy, mm, dd } },
      });
      return ok(lock !== null);
    } catch (error) {
      return err(
        new Error("Failed to check suggestion lock", { cause: error })
      );
    }
  }

  static async setSuggestionLock(
    yyyy: number,
    mm: number,
    dd: number
  ): Promise<Result<void, Error>> {
    try {
      await prisma.suggestionLock.create({ data: { yyyy, mm, dd } });
      return ok(undefined);
    } catch (error) {
      return err(new Error("Failed to set suggestion lock", { cause: error }));
    }
  }

  static async getListConfigSuggestions(): Promise<Result<void, Error>> {
    try {
      const upstreamBaseUrl = process.env.ASSIST_API_BASE_URL;
      if (!upstreamBaseUrl) {
        return err(
          new Error("Missing ASSIST_API_BASE_URL environment variable")
        );
      }

      const listConfigs = await prisma.listConfig.findMany({
        include: prismaListConfigInclude,
      });

      for (const listConfig of listConfigs) {
        const settings = Setting.mapDataToSpec(listConfig.setting);
        if (!settings[SettingName.ASSIST_SUGGESTION_ENABLED]) {
          continue;
        }

        const upstreamUrl = new URL("/assist/suggestEntity", upstreamBaseUrl);
        upstreamUrl.searchParams.set("listConfigId", listConfig.id);

        await fetch(upstreamUrl.toString(), {
          method: "GET",
          headers: { authorization: process.env.SYSTEM_API_KEY || "" },
        });
      }

      return ok(undefined);
    } catch (error) {
      return err(
        new Error("Failed to get list config suggestions", { cause: error })
      );
    }
  }
}
