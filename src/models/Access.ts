import { Prisma } from "@prisma/client";

const prismaAccessPolicy =
  Prisma.validator<Prisma.AccessPolicyFindUniqueArgs>()({
    where: { id: 1 },
    include: { parties: true },
  });

export type PrismaAccessPolicy = Prisma.AccessPolicyGetPayload<
  typeof prismaAccessPolicy
>;


const prismaAccessPolicyGroup =
  Prisma.validator<Prisma.AccessPolicyGroupFindUniqueArgs>()({
    where: { id: 1, userId: "" },
    include: {
      users: { include: { user: true } },
    },
  });

export type PrismaAccessPolicyGroup = Prisma.AccessPolicyGroupGetPayload<
  typeof prismaAccessPolicyGroup
>;

const prismaAccessPolicyGroupUser =
  Prisma.validator<Prisma.AccessPolicyGroupUserFindUniqueArgs>()({
    where: { groupId_userId: { groupId: 1, userId: "" } },
    include: {
      user: true,
    },
  });

export type PrismaAccessPolicyGroupUser =
  Prisma.AccessPolicyGroupUserGetPayload<typeof prismaAccessPolicyGroupUser>;
