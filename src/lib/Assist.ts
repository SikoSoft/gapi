import { Result, err, ok } from "neverthrow";
import { SettingName } from "api-spec/models/Setting";
import { prisma } from "..";
import { prismaListConfigInclude } from "../models/ListConfig";
import { Setting } from "./Setting";

export class Assist {
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

        const headers: Record<string, string> = {};

        headers["authorization"] = process.env.SYSTEM_API_KEY || "";

        await fetch(upstreamUrl.toString(), {
          method: "GET",
          headers,
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
