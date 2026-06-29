import { app, InvocationContext } from "@azure/functions";
import { prisma } from "..";
import { Logger } from "../lib/Logger";
import { Notification } from "../lib/Notification";
import { StreakAlertQueueMessage } from "../models/StreakAlertQueue";

async function streakAlertHandler(
  message: unknown,
  context: InvocationContext
): Promise<void> {
  const queueMessage = message as StreakAlertQueueMessage;

  if (!queueMessage.userId || !queueMessage.streakAlertId) {
    context.error("[streakAlert] invalid queue message", { queueMessage });
    return;
  }

  context.log("[streakAlert] processing", {
    userId: queueMessage.userId,
    streakAlertId: queueMessage.streakAlertId,
    streakId: queueMessage.streakId,
  });

  const sendRes = await Notification.send({
    userId: queueMessage.userId,
    title: "Streak at risk",
    body: "You have an active streak that will be lost if you don't act before midnight.",
    actions: [],
  });

  if (sendRes.isErr()) {
    context.error("[streakAlert] Notification.send failed:", sendRes.error);
    return;
  }

  try {
    await prisma.streakAlert.update({
      where: { id: queueMessage.streakAlertId },
      data: { sentAt: new Date() },
    });
    context.log("[streakAlert] completed successfully", { streakAlertId: queueMessage.streakAlertId });
  } catch (e) {
    Logger.error("[streakAlert] failed to update sentAt", e);
  }
}

app.storageQueue("streakAlert", {
  queueName: "streak-alert-queue",
  connection: "AzureWebJobsStorage",
  handler: streakAlertHandler,
});
