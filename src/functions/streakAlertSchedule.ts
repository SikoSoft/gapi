import { app, InvocationContext, Timer } from "@azure/functions";
import { StreakAlertScheduler } from "../lib/StreakAlertScheduler";

export async function streakAlertScheduleHandler(
  _timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("[streakAlertSchedule] timer triggered");
  await StreakAlertScheduler.run();
  context.log("[streakAlertSchedule] completed");
}

app.timer("streakAlertSchedule", {
  // Runs daily at 00:05 UTC — after midnight so the previous day's data is settled
  // for all UTC+ users, and well ahead of the first possible notifyAt for any timezone.
  schedule: "0 5 0 * * *",
  handler: streakAlertScheduleHandler,
});
