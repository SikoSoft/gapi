import { Prisma } from "@prisma/client";

export const prismaListConfigInclude = {
  filter: {
    include: {
      time: true,
      text: true,
      tagging: true,
      includeTypes: true,
      booleanProperties: { include: { propertyValue: true } },
      dateProperties: { include: { propertyValue: true } },
      imageProperties: { include: { propertyValue: true } },
      intProperties: { include: { propertyValue: true } },
      longTextProperties: { include: { propertyValue: true } },
      shortTextProperties: { include: { propertyValue: true } },
    },
  },
  sort: true,
  setting: {
    include: {
      intSettings: true,
      shortTextSettings: true,
      booleanSettings: true,
    },
  },
  themes: true,
  accessPolicy: {
    include: {
      viewAccessPolicy: {
        include: {
          parties: {
            include: {
              user: true,
              group: { include: { users: { include: { user: true } } } },
            },
          },
        },
      },
      editAccessPolicy: {
        include: {
          parties: {
            include: {
              user: true,
              group: { include: { users: { include: { user: true } } } },
            },
          },
        },
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
    booleanProperties: { include: { propertyValue: true } },
    dateProperties: { include: { propertyValue: true } },
    imageProperties: { include: { propertyValue: true } },
    intProperties: { include: { propertyValue: true } },
    longTextProperties: { include: { propertyValue: true } },
    shortTextProperties: { include: { propertyValue: true } },
  },
});

export type PrismaListFilter = Prisma.ListFilterGetPayload<
  typeof prismaListFilter
>;
