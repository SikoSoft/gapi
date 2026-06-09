import { app, InvocationContext, Timer } from "@azure/functions";
import { AnalysisClassificationScheduler } from "../lib/AnalysisClassificationScheduler";

export async function analysisClassificationSchedulerHandler(
  _timer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("[analysisClassificationScheduler] timer triggered");

  await AnalysisClassificationScheduler.run();

  context.log("[analysisClassificationScheduler] completed");
}

app.timer("analysisClassificationScheduler", {
  // Runs daily at 04:00 UTC. By this time the previous calendar day has ended for
  // all timezones up to UTC+4; users further east receive their result a few hours
  // into their new day, which is acceptable given the daily granularity.
  schedule: "0 0 4 * * *",
  handler: analysisClassificationSchedulerHandler,
});
