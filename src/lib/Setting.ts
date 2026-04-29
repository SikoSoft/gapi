import { Result, ok, err } from "neverthrow";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "..";
import { PrismaSetting, SettingDataName } from "../models/Setting";
import {
  Setting as SettingSpec,
  Settings,
  defaultSettings,
  settingsConfig,
  SettingTypeConfig,
  ControlType,
  SettingConfig,
} from "api-spec/models/Setting";
import { ListConfig } from "./ListConfig";
import { AccessError } from "../errors/AccessError";

export type SettingConfigPart = Partial<SettingConfig>;

export class Setting {
  static async getByListConfigId(
    listConfigId: string
  ): Promise<Result<PrismaSetting, Error>> {
    const res = await prisma.setting.findFirst({
      where: { listConfigId },
      include: {
        intSettings: true,
        shortTextSettings: true,
        booleanSettings: true,
      },
    });

    if (!res) {
      return err(new Error("Setting not found"));
    }

    return ok(res);
  }

  static async update(
    userId: string,
    listConfigId: string,
    setting: SettingSpec
  ): Promise<Result<boolean, Error>> {
    try {
      const isAllowed = await ListConfig.isEditAllowed(userId, listConfigId);
      if (isAllowed.isErr()) {
        return err(isAllowed.error);
      }

      if (!isAllowed.value) {
        return err(new AccessError("Not authorized to edit this list config"));
      }

      if (!settingsConfig[setting.name]) {
        return err(new Error("Setting not found"));
      }

      const settingControlType = settingsConfig[setting.name].control.type;
      const settingType =
        Setting.getDataTypeFromControlType(settingControlType);

      const id = uuidv4();

      const settingRecord = await prisma.setting.upsert({
        where: { listConfigId },
        create: {
          id,
          listConfigId,
        },
        update: {},
      });

      switch (settingType) {
        case SettingDataName.BOOLEAN:
          return await Setting.updateBooleanSetting(settingRecord.id, setting);
        case SettingDataName.INT:
          return await Setting.updateNumberSetting(settingRecord.id, setting);
        case SettingDataName.SHORT_TEXT:
          return await Setting.updateTextSetting(settingRecord.id, setting);
      }
    } catch (error) {
      return err(new Error("Setting type not supported"));
    }
  }

  static async updateBooleanSetting(
    settingId: string,
    setting: SettingSpec
  ): Promise<Result<boolean, Error>> {
    const settingControlType = settingsConfig[setting.name].control.type;

    if (settingControlType !== ControlType.BOOLEAN) {
      throw new Error("Setting is not a boolean setting");
    }

    const value = setting.value as SettingTypeConfig[typeof settingControlType];

    try {
      await prisma.booleanSetting.upsert({
        where: { booleanSettingId: { settingId, name: setting.name } },
        create: {
          settingId,
          name: setting.name,
          value,
        },
        update: {
          value,
        },
      });
      return ok(true);
    } catch (error) {
      return err(error);
    }
  }

  static async updateTextSetting(
    settingId: string,
    setting: SettingSpec
  ): Promise<Result<boolean, Error>> {
    const settingControlType = settingsConfig[setting.name].control.type;

    if (
      settingControlType !== ControlType.TEXT &&
      settingControlType !== ControlType.SELECT
    ) {
      throw new Error("Setting is not a text setting");
    }

    const value = setting.value as SettingTypeConfig[typeof settingControlType];

    try {
      await prisma.shortTextSetting.upsert({
        where: { shortTextSettingId: { settingId, name: setting.name } },
        create: {
          settingId,
          name: setting.name,
          value,
        },
        update: {
          value,
        },
      });
      return ok(true);
    } catch (error) {
      console.log("Error updating text setting", error);
      return err(error);
    }
  }

  static async updateNumberSetting(
    settingId: string,
    setting: SettingSpec
  ): Promise<Result<boolean, Error>> {
    const settingControlType = settingsConfig[setting.name].control.type;

    if (settingControlType !== ControlType.NUMBER) {
      throw new Error("Setting is not a number setting");
    }

    const value = setting.value as SettingTypeConfig[typeof settingControlType];

    try {
      await prisma.intSetting.upsert({
        where: { intSettingId: { settingId, name: setting.name } },
        create: {
          settingId,
          name: setting.name,
          value,
        },
        update: {
          value,
        },
      });
      return ok(true);
    } catch (error) {
      return err(error);
    }
  }

  static getDataTypeFromControlType(controlType: string): SettingDataName {
    switch (controlType) {
      case "boolean":
        return SettingDataName.BOOLEAN;
      case "number":
        return SettingDataName.INT;
      case "text":
        return SettingDataName.SHORT_TEXT;
      default:
        return SettingDataName.SHORT_TEXT;
    }
  }

  static mapDataToSpec(data: PrismaSetting): Settings {
    const booleanSettings: Partial<SettingSpec> = {};
    const intSettings: Partial<SettingSpec> = {};
    const shortTextSettings: Partial<SettingSpec> = {};

    if (data?.booleanSettings?.length) {
      data.booleanSettings.forEach((setting) => {
        booleanSettings[setting.name] = setting.value;
      });
    }

    if (data?.intSettings?.length) {
      data.intSettings.forEach((setting) => {
        intSettings[setting.name] = setting.value;
      });
    }

    if (data?.shortTextSettings?.length) {
      data.shortTextSettings.forEach((setting) => {
        shortTextSettings[setting.name] = setting.value;
      });
    }

    return {
      ...defaultSettings,
      ...booleanSettings,
      ...intSettings,
      ...shortTextSettings,
    };
  }
}
