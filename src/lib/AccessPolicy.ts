import { Result, err, ok } from "neverthrow";
import { prisma } from "..";

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
  static async create(
    name: string,
    description: string
  ): Promise<Result<AccessPolicyRecord, Error>> {
    try {
      const policy = await prisma.accessPolicy.create({
        data: { name, description },
      });
      return ok(policy);
    } catch (error) {
      return err(new Error("Failed to create access policy", { cause: error }));
    }
  }

  static async update(
    id: number,
    name: string,
    description: string
  ): Promise<Result<AccessPolicyRecord, Error>> {
    try {
      const policy = await prisma.accessPolicy.update({
        where: { id },
        data: { name, description },
      });
      return ok(policy);
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

  static async createGroup(
    userId: string,
    name: string
  ): Promise<Result<AccessPolicyGroupRecord, Error>> {
    try {
      const group = await prisma.accessPolicyGroup.create({
        data: { userId, name },
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
    name: string
  ): Promise<Result<AccessPolicyGroupRecord, Error>> {
    try {
      const group = await prisma.accessPolicyGroup.update({
        where: { id, userId },
        data: { name },
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

  static async countUsingEntities(
    accessPolicyId: number
  ): Promise<Result<number, Error>> {
    try {
      const count = await prisma.entityAccessPolicy.count({
        where: { accessPolicyId },
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

  static async countUsingListConfigs(
    accessPolicyId: number
  ): Promise<Result<number, Error>> {
    try {
      const count = await prisma.listConfigAccessPolicy.count({
        where: { accessPolicyId },
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
}
