import { Prisma } from "@prisma/client";

const prismaSetting = Prisma.validator<Prisma.SettingFindManyArgs>()({
  where: { listConfigId: "" },
  include: {
    intSettings: true,
    shortTextSettings: true,
    booleanSettings: true,
  },
});

export type PrismaSetting = Prisma.SettingGetPayload<typeof prismaSetting>;

export enum SettingDataName {
  BOOLEAN = "booleanSetting",
  INT = "intSetting",
  SHORT_TEXT = "shortTextSetting",
}
