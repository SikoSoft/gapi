import { SettingName } from "api-spec/models/Setting";
import { prisma } from "..";
import { Logger } from "./Logger";
import { Setting } from "./Setting";
import { Streak } from "./Streak";
import { StreakAlertQueue } from "./StreakAlertQueue";

export class StreakAlertScheduler {
  static async run(): Promise<void> {
    // Ensure the queue exists before the trigger binding tries to poll it.
    const ensureRes = await StreakAlertQueue.ensureExists();
    if (ensureRes.isErr()) {
      Logger.error("[StreakAlertScheduler] failed to ensure queue exists", ensureRes.error);
    }

    const userRows = await prisma.streakAlertConfig.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });

    Logger.log(`[StreakAlertScheduler] run userIds=${userRows.length}`);

    for (const { userId } of userRows) {
      await StreakAlertScheduler.processUser(userId);
    }
  }

  private static async processUser(userId: string): Promise<void> {
    const settingsRes = await Setting.getForUser(userId);
    const utcOffsetMinutes = settingsRes.isOk()
      ? ((settingsRes.value[SettingName.TIMEZONE] as number) ?? 0)
      : 0;

    const streakListRes = await Streak.list(userId);
    if (streakListRes.isErr()) {
      Logger.error(`[StreakAlertScheduler] failed to list streaks userId=${userId}`, streakListRes.error);
      return;
    }

    const streaks = streakListRes.value;
    if (streaks.length === 0) {
      return;
    }

    const results = await Streak.resolveStreaks(streaks, userId, utcOffsetMinutes);

    for (const result of results) {
      if (result.current < 1) {
        continue;
      }

      const alertConfigs = await prisma.streakAlertConfig.findMany({
        where: { streakId: result.streakId, userId },
      });

      for (const alertConfig of alertConfigs) {
        await StreakAlertScheduler.scheduleAlert(
          userId,
          result.streakId,
          alertConfig.id,
          alertConfig.noticeTime,
          utcOffsetMinutes
        );
      }
    }
  }

  private static async scheduleAlert(
    userId: string,
    streakId: number,
    alertConfigId: number,
    noticeTime: number,
    utcOffsetMinutes: number
  ): Promise<void> {
    const now = new Date();
    const notifyAt = StreakAlertScheduler.computeNotifyAt(now, noticeTime, utcOffsetMinutes);

    if (notifyAt <= now) {
      Logger.log(`[StreakAlertScheduler] notifyAt already passed alertConfigId=${alertConfigId} — skipping`);
      return;
    }

    // Dedup: skip if an alert was already scheduled today (UTC day) for this config
    const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const existing = await prisma.streakAlert.findFirst({
      where: { alertConfigId, createdAt: { gte: startOfTodayUTC } },
    });

    if (existing) {
      Logger.log(`[StreakAlertScheduler] alert already scheduled today alertConfigId=${alertConfigId} — skipping`);
      return;
    }

    try {
      const alert = await prisma.streakAlert.create({
        data: { userId, alertConfigId },
      });

      Logger.log(`[StreakAlertScheduler] created StreakAlert id=${alert.id} alertConfigId=${alertConfigId} notifyAt=${notifyAt.toISOString()}`);

      const enqueueRes = await StreakAlertQueue.enqueue(
        { userId, streakAlertId: alert.id, streakId, createdAt: alert.createdAt.toISOString() },
        notifyAt
      );

      if (enqueueRes.isErr()) {
        Logger.error(`[StreakAlertScheduler] failed to enqueue alert id=${alert.id}`, enqueueRes.error);
      }
    } catch (e) {
      Logger.error(`[StreakAlertScheduler] failed to create StreakAlert alertConfigId=${alertConfigId}`, e);
    }
  }

  // Computes the UTC time at which a notification should fire: user's next local midnight minus noticeTime minutes.
  static computeNotifyAt(now: Date, noticeTime: number, utcOffsetMinutes: number): Date {
    const localMs = now.getTime() + utcOffsetMinutes * 60 * 1000;
    const localDate = new Date(localMs);
    const startOfLocalDayMs = Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate()
    );
    const nextLocalMidnightUTC = new Date(startOfLocalDayMs + 24 * 60 * 60 * 1000 - utcOffsetMinutes * 60 * 1000);
    return new Date(nextLocalMidnightUTC.getTime() - noticeTime * 60 * 1000);
  }
}
