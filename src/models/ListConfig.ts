import { Prisma } from "@prisma/client";

const prismaListConfig = Prisma.validator<Prisma.ListConfigFindManyArgs>()({
  where: { userId: "" },
  include: {
    filter: {
      include: {
        time: true,
        text: true,
        tagging: true,
      },
    },
    sort: true,
  },
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
  },
});

export type PrismaListFilter = Prisma.ListFilterGetPayload<
  typeof prismaListFilter
>;
