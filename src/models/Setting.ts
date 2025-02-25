import { Prisma } from "@prisma/client";

const prismaSetting = Prisma.validator<Prisma.SettingFindManyArgs>()({
  where: { listConfigId: "" },
  include: {
    numberSettings: true,
    textSettings: true,
    booleanSettings: true,
  },
});

export type PrismaSetting = Prisma.SettingGetPayload<typeof prismaSetting>;

export enum SettingDataName {
  BOOLEAN = "booleanSetting",
  NUMBER = "numberSetting",
  TEXT = "textSetting",
}
