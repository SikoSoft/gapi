import { StreakAlertConfig as StreakAlertConfigSpec } from "api-spec/models/Fact";
import { ok, err, Result } from "neverthrow";
import { prisma } from "..";
import { PrismaStreakAlertConfig } from "../models/StreakAlert";

export class StreakAlertConfig {
  static mapToSpec(row: PrismaStreakAlertConfig): StreakAlertConfigSpec {
    return {
      id: row.id,
      streakId: row.streakId,
      userId: row.userId,
      noticeTime: row.noticeTime,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static async list(userId: string): Promise<Result<StreakAlertConfigSpec[], Error>> {
    try {
      const rows = await prisma.streakAlertConfig.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      return ok(rows.map(StreakAlertConfig.mapToSpec));
    } catch (e) {
      return err(new Error("Failed to list streak alert configs", { cause: e }));
    }
  }

  static async create(userId: string, streakId: number, noticeTime: number): Promise<Result<StreakAlertConfigSpec, Error>> {
    try {
      const row = await prisma.streakAlertConfig.create({
        data: { userId, streakId, noticeTime },
      });
      return ok(StreakAlertConfig.mapToSpec(row));
    } catch (e) {
      return err(new Error("Failed to create streak alert config", { cause: e }));
    }
  }

  static async update(id: number, userId: string, noticeTime: number): Promise<Result<StreakAlertConfigSpec, Error>> {
    try {
      const row = await prisma.streakAlertConfig.findFirst({ where: { id, userId } });
      if (!row) {
        return err(new Error("Streak alert config not found"));
      }
      const updated = await prisma.streakAlertConfig.update({
        where: { id },
        data: { noticeTime },
      });
      return ok(StreakAlertConfig.mapToSpec(updated));
    } catch (e) {
      return err(new Error("Failed to update streak alert config", { cause: e }));
    }
  }

  static async remove(id: number, userId: string): Promise<Result<void, Error>> {
    try {
      const row = await prisma.streakAlertConfig.findFirst({ where: { id, userId } });
      if (!row) {
        return err(new Error("Streak alert config not found"));
      }
      await prisma.streakAlertConfig.delete({ where: { id } });
      return ok(undefined);
    } catch (e) {
      return err(new Error("Failed to delete streak alert config", { cause: e }));
    }
  }
}
