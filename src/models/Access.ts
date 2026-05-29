import { z } from "zod";
import { Prisma } from "@prisma/client";

const prismaAccessPolicy =
  Prisma.validator<Prisma.AccessPolicyFindUniqueArgs>()({
    where: { id: 1 },
    include: {
      parties: {
        include: {
          user: true,
          group: { include: { users: { include: { user: true } } } },
        },
      },
    },
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

const AccessPolicyPartySchema = z.union([
  z.object({ type: z.literal("user"), id: z.string(), name: z.string() }),
  z.object({
    type: z.literal("group"),
    id: z.string(),
    name: z.string(),
    users: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
]);

export const AccessPolicyBodySchema = z.object({
  name: z.string(),
  description: z.string(),
  parties: z.array(AccessPolicyPartySchema),
});
export type AccessPolicyBody = z.infer<typeof AccessPolicyBodySchema>;

export const AccessPolicyGroupBodySchema = z.object({
  name: z.string(),
  users: z.array(z.string()),
});
export type AccessPolicyGroupBody = z.infer<typeof AccessPolicyGroupBodySchema>;

export const AccessPolicyAssignmentSchema = z.object({
  viewAccessPolicyId: z.number(),
  editAccessPolicyId: z.number(),
});
export type AccessPolicyAssignment = z.infer<typeof AccessPolicyAssignmentSchema>;
