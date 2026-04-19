import { Prisma } from "@prisma/client";

export const prismaListConfigInclude = {
  filter: {
    include: {
      time: true,
      text: true,
      tagging: true,
      includeTypes: true,
    },
  },
  sort: true,
  setting: {
    include: {
      numberSettings: true,
      textSettings: true,
      booleanSettings: true,
    },
  },
  themes: true,
  accessPolicy: {
    include: {
      viewAccessPolicy: {
        include: { parties: true },
      },
      editAccessPolicy: {
        include: { parties: true },
      },
    },
  },
} satisfies Prisma.ListConfigFindManyArgs["include"];

const prismaListConfig = Prisma.validator<Prisma.ListConfigFindManyArgs>()({
  where: { userId: "" },
  include: prismaListConfigInclude,
});

export type PrismaListConfig = Prisma.ListConfigGetPayload<
  typeof prismaListConfig
>;

const prismaListFilter = Prisma.validator<Prisma.ListFilterFindManyArgs>()({
  where: { listConfigId: "" },
  include: {
    text: true,
    tagging: true,
    time: true,
    includeTypes: true,
  },
});

export type PrismaListFilter = Prisma.ListFilterGetPayload<
  typeof prismaListFilter
>;
