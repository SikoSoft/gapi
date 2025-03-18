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

export type SettingConfigPart = Partial<SettingConfig>;

export class Setting {
  static async getByListConfigId(
    listConfigId: string
  ): Promise<Result<PrismaSetting, Error>> {
    const res = await prisma.setting.findFirst({
      where: { listConfigId },
      include: {
        numberSettings: true,
        textSettings: true,
        booleanSettings: true,
      },
    });

    if (!res) {
      return err(new Error("Setting not found"));
    }

    return ok(res);
  }

  static async update(
    listConfigId: string,
    setting: SettingSpec
  ): Promise<Result<boolean, Error>> {
    if (!settingsConfig[setting.name]) {
      return err(new Error("Setting not found"));
    }

    const settingControlType = settingsConfig[setting.name].control.type;
    const settingType = Setting.getDataTypeFromControlType(settingControlType);

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
      case SettingDataName.NUMBER:
        return await Setting.updateNumberSetting(settingRecord.id, setting);
      case SettingDataName.TEXT:
        return await Setting.updateTextSetting(settingRecord.id, setting);
    }

    return err(new Error("Setting type not supported"));
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
      await prisma.textSetting.upsert({
        where: { settingId, name: setting.name },
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
      await prisma.numberSetting.upsert({
        where: { settingId, name: setting.name },
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
        return SettingDataName.NUMBER;
      case "text":
        return SettingDataName.TEXT;
      default:
        return SettingDataName.TEXT;
    }
  }

  static mapDataToSpec(data: PrismaSetting): Settings {
    const booleanSettings: Partial<SettingSpec> = {};
    const numberSettings: Partial<SettingSpec> = {};
    const textSettings: Partial<SettingSpec> = {};

    if (data?.booleanSettings?.length) {
      data.booleanSettings.forEach((setting) => {
        booleanSettings[setting.name] = setting.value;
      });
    }

    if (data?.numberSettings?.length) {
      data.numberSettings.forEach((setting) => {
        numberSettings[setting.name] = setting.value;
      });
    }

    if (data?.textSettings?.length) {
      data.textSettings.forEach((setting) => {
        textSettings[setting.name] = setting.value;
      });
    }

    return {
      ...defaultSettings,
      ...booleanSettings,
      ...numberSettings,
      ...textSettings,
    };
  }
}
