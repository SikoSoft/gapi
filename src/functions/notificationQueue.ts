import { app, InvocationContext } from "@azure/functions";
import { Entity } from "../lib/Entity";
import { Notification } from "../lib/Notification";
import { NotificationQueueMessage } from "../models/NotificationQueue";

async function notificationQueueHandler(
  message: unknown,
  context: InvocationContext
): Promise<void> {
  const queueMessage = message as NotificationQueueMessage;

  if (
    !queueMessage.userId ||
    !queueMessage.entityConfigId ||
    !queueMessage.suggestionEntityId
  ) {
    context.error("Invalid notification queue message");
    return;
  }

  const alreadyLoggedRes = await Entity.hasMatchingEntityLoggedInPastHour(
    queueMessage.userId,
    queueMessage.entityConfigId,
    queueMessage.textValues
  );

  if (alreadyLoggedRes.isErr()) {
    context.error(alreadyLoggedRes.error);
    return;
  }

  if (alreadyLoggedRes.value) {
    return;
  }

  const addUrl = `${process.env.ORBIT_FE_BASE_URL}/entity/add?suggestion=${queueMessage.suggestionEntityId}`;

  const sendRes = await Notification.send({
    userId: queueMessage.userId,
    title: "Forget this?",
    body: queueMessage.textValues.join("\n"),
    actions: [{ action: "add", title: "Add", url: addUrl }],
  });

  if (sendRes.isErr()) {
    context.error(sendRes.error);
  }
}

app.storageQueue("notificationQueue", {
  queueName: "notification-queue",
  connection: "AzureWebJobsStorage",
  handler: notificationQueueHandler,
});
