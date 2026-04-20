import { Result, err, ok } from "neverthrow";
import { Access } from "api-spec/models";
import { prisma } from "..";
import {
  PrismaAccessPolicy,
  PrismaAccessPolicyGroup,
  PrismaAccessPolicyGroupUser,
} from "../models/Access";
import { AccessPolicyGroup } from "api-spec/models/Access";

export interface AccessPolicyRecord {
  id: number;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessPolicyGroupRecord {
  id: number;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AccessPolicy {
  static mapDataToSpec(
    data: PrismaAccessPolicy | null
  ): Access.AccessPolicy | null {
    return AccessPolicy.mapPolicy(data);
  }

  static mapPolicy(
    policy: PrismaAccessPolicy | null
  ): Access.AccessPolicy | null {
    if (!policy) {
      return null;
    }

    return {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      parties: policy.parties.map((p) => {
        if (p.type === Access.AccessPartyType.USER) {
          return {
            type: Access.AccessPartyType.USER,
            id: String(p.id),
            name: p.user?.username ?? "",
            userId: p.userId ?? "",
          } as Access.AccessPolicyUserParty;
        } else {
          return {
            type: Access.AccessPartyType.GROUP,
            id: String(p.id),
            name: p.group?.name ?? "",
            groupId: String(p.groupId ?? ""),
            users: p.group
              ? p.group.users.map((ug) => AccessPolicy.mapGroupUser(ug))
              : [],
          } as Access.AccessPolicyGroupParty;
        }
      }),
    };
  }

  static mapGroup(group: PrismaAccessPolicyGroup): Access.AccessPolicyGroup {
    return {
      id: String(group.id),
      name: group.name,
      users: group.users.map((ug) => AccessPolicy.mapGroupUser(ug)),
    };
  }

  static mapGroupUser(
    groupUser: PrismaAccessPolicyGroupUser
  ): Access.AccessPolicyUserParty {
    return {
      type: Access.AccessPartyType.USER,
      id: String(groupUser.userId),
      name: groupUser.user?.username ?? "",
    };
  }

  static async get(): Promise<Result<Access.AccessPolicy[], Error>> {
    try {
      const policies = await prisma.accessPolicy.findMany({
        include: {
          parties: {
            include: {
              user: true,
              group: { include: { users: { include: { user: true } } } },
            },
          },
        },
      });
      return ok(policies.map((p) => AccessPolicy.mapPolicy(p)));
    } catch (error) {
      return err(new Error("Failed to get access policies", { cause: error }));
    }
  }

  static async getById(
    id: number
  ): Promise<Result<Access.AccessPolicy | null, Error>> {
    try {
      const policy = await prisma.accessPolicy.findUnique({
        where: { id },
        include: {
          parties: {
            include: {
              user: true,
              group: { include: { users: { include: { user: true } } } },
            },
          },
        },
      });
      return ok(policy ? AccessPolicy.mapPolicy(policy) : null);
    } catch (error) {
      return err(new Error("Failed to get access policy", { cause: error }));
    }
  }

  static async create(
    name: string,
    description: string,
    parties: Access.AccessPolicyParty[]
  ): Promise<Result<Access.AccessPolicy, Error>> {
    try {
      const policy = await prisma.accessPolicy.create({
        data: {
          name,
          description,
          parties: {
            createMany: {
              data: parties.map((p) =>
                p.type === Access.AccessPartyType.USER
                  ? { type: p.type, userId: p.id }
                  : { type: p.type, groupId: parseInt(p.id, 10) }
              ),
            },
          },
        },
        include: {
          parties: {
            include: {
              user: true,
              group: { include: { users: { include: { user: true } } } },
            },
          },
        },
      });
      return ok(AccessPolicy.mapPolicy(policy));
    } catch (error) {
      return err(new Error("Failed to create access policy", { cause: error }));
    }
  }

  static async update(
    id: number,
    name: string,
    description: string,
    parties: Access.AccessPolicyParty[]
  ): Promise<Result<Access.AccessPolicy, Error>> {
    try {
      const policy = await prisma.$transaction(async (tx) => {
        await tx.accessPolicyParty.deleteMany({
          where: { accessPolicyId: id },
        });
        return tx.accessPolicy.update({
          where: { id },
          data: {
            name,
            description,
            parties: {
              createMany: {
                data: parties.map((p) =>
                  p.type === Access.AccessPartyType.USER
                    ? { type: p.type, userId: p.id }
                    : { type: p.type, groupId: parseInt(p.id, 10) }
                ),
              },
            },
          },
          include: {
            parties: {
              include: {
                user: true,
                group: { include: { users: { include: { user: true } } } },
              },
            },
          },
        });
      });
      return ok(AccessPolicy.mapPolicy(policy));
    } catch (error) {
      return err(new Error("Failed to update access policy", { cause: error }));
    }
  }

  static async delete(id: number): Promise<Result<boolean, Error>> {
    try {
      await prisma.accessPolicy.delete({ where: { id } });
      return ok(true);
    } catch (error) {
      return err(new Error("Failed to delete access policy", { cause: error }));
    }
  }

  static async getGroups(
    userId: string
  ): Promise<Result<AccessPolicyGroup[], Error>> {
    try {
      const groups = await prisma.accessPolicyGroup.findMany({
        where: { userId },
        include: { users: { include: { user: true } } },
      });
      return ok(groups.map((g) => AccessPolicy.mapGroup(g)));
    } catch (error) {
      return err(
        new Error("Failed to get access policy groups", { cause: error })
      );
    }
  }

  static async createGroup(
    userId: string,
    name: string,
    users: string[]
  ): Promise<Result<AccessPolicyGroupRecord, Error>> {
    try {
      const group = await prisma.accessPolicyGroup.create({
        data: {
          userId,
          name,
          users: {
            createMany: { data: users.map((uid) => ({ userId: uid })) },
          },
        },
      });
      return ok(group);
    } catch (error) {
      return err(
        new Error("Failed to create access policy group", { cause: error })
      );
    }
  }

  static async updateGroup(
    userId: string,
    id: number,
    name: string,
    users: string[]
  ): Promise<Result<AccessPolicyGroupRecord, Error>> {
    try {
      const group = await prisma.$transaction(async (tx) => {
        await tx.accessPolicyGroupUser.deleteMany({ where: { groupId: id } });
        return tx.accessPolicyGroup.update({
          where: { id, userId },
          data: {
            name,
            users: {
              createMany: { data: users.map((uid) => ({ userId: uid })) },
            },
          },
        });
      });
      return ok(group);
    } catch (error) {
      return err(
        new Error("Failed to update access policy group", { cause: error })
      );
    }
  }

  static async deleteGroup(
    userId: string,
    id: number
  ): Promise<Result<boolean, Error>> {
    try {
      await prisma.accessPolicyGroup.delete({ where: { id, userId } });
      return ok(true);
    } catch (error) {
      return err(
        new Error("Failed to delete access policy group", { cause: error })
      );
    }
  }

  static async setEntityAccessPolicy(
    userId: string,
    entityId: number,
    viewAccessPolicyId: number,
    editAccessPolicyId: number
  ): Promise<Result<boolean, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId, userId },
      });
      if (!entity) {
        return err(new Error("Entity not found or not owned by user"));
      }
      await prisma.entityAccessPolicy.upsert({
        where: { entityId },
        create: {
          entityId,
          viewAccessPolicyId: viewAccessPolicyId || null,
          editAccessPolicyId: editAccessPolicyId || null,
        },
        update: {
          viewAccessPolicyId: viewAccessPolicyId || null,
          editAccessPolicyId: editAccessPolicyId || null,
        },
      });
      return ok(true);
    } catch (error) {
      return err(
        new Error("Failed to set entity access policy", { cause: error })
      );
    }
  }

  static async countUsingEntities(
    accessPolicyId: number
  ): Promise<Result<number, Error>> {
    try {
      const count = await prisma.entityAccessPolicy.count({
        where: {
          OR: [
            { viewAccessPolicyId: accessPolicyId },
            { editAccessPolicyId: accessPolicyId },
          ],
        },
      });
      return ok(count);
    } catch (error) {
      return err(
        new Error("Failed to count entities using access policy", {
          cause: error,
        })
      );
    }
  }

  static async getParties(
    userId: string,
    query?: string
  ): Promise<Result<Access.AccessPolicyParty[], Error>> {
    try {
      const [users, groups] = await Promise.all([
        prisma.user.findMany({
          where: query
            ? { username: { startsWith: query, mode: "insensitive" } }
            : {},
        }),
        prisma.accessPolicyGroup.findMany({
          where: {
            userId,
            ...(query
              ? { name: { startsWith: query, mode: "insensitive" } }
              : {}),
          },
          include: { users: { include: { user: true } } },
        }),
      ]);

      const parties: Access.AccessPolicyParty[] = [
        ...users.map((u) => ({
          type: Access.AccessPartyType.USER as const,
          id: u.id,
          name: u.username,
          userId: u.id,
        })),
        ...groups.map((g) => ({
          type: Access.AccessPartyType.GROUP as const,
          id: String(g.id),
          name: g.name,
          groupId: String(g.id),
          users: g.users.map((ug) => AccessPolicy.mapGroupUser(ug)),
        })),
      ];

      return ok(parties);
    } catch (error) {
      return err(
        new Error("Failed to get access policy parties", { cause: error })
      );
    }
  }

  static async countUsingListConfigs(
    accessPolicyId: number
  ): Promise<Result<number, Error>> {
    try {
      const count = await prisma.listConfigAccessPolicy.count({
        where: {
          OR: [
            { viewAccessPolicyId: accessPolicyId },
            { editAccessPolicyId: accessPolicyId },
          ],
        },
      });
      return ok(count);
    } catch (error) {
      return err(
        new Error("Failed to count list configs using access policy", {
          cause: error,
        })
      );
    }
  }

  static async setListConfigAccessPolicy(
    userId: string,
    listConfigId: string,
    viewAccessPolicyId: number,
    editAccessPolicyId: number
  ): Promise<Result<boolean, Error>> {
    try {
      const listConfig = await prisma.listConfig.findUnique({
        where: { id: listConfigId, userId },
      });
      if (!listConfig) {
        return err(new Error("List config not found or not owned by user"));
      }
      await prisma.listConfigAccessPolicy.upsert({
        where: { listConfigId },
        create: {
          listConfigId,
          viewAccessPolicyId: viewAccessPolicyId || null,
          editAccessPolicyId: editAccessPolicyId || null,
        },
        update: {
          viewAccessPolicyId: viewAccessPolicyId || null,
          editAccessPolicyId: editAccessPolicyId || null,
        },
      });
      return ok(true);
    } catch (error) {
      return err(
        new Error("Failed to set list config access policy", { cause: error })
      );
    }
  }
}
