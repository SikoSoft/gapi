import { app, InvocationContext } from "@azure/functions";
import { Entity } from "../lib/Entity";
import { IdentityManager } from "../lib/IdentityManager";
import { Notification } from "../lib/Notification";
import { OneTimeTokenScope } from "../models/Identity";
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
    context.error("Invalid notification queue message", { queueMessage });
    return;
  }

  context.log("[notificationQueue] processing", {
    userId: queueMessage.userId,
    entityConfigId: queueMessage.entityConfigId,
    suggestionEntityId: queueMessage.suggestionEntityId,
    textValues: queueMessage.textValues,
    receivedAt: new Date().toISOString(),
  });

  const entityExistsRes = await Entity.suggestionExists(
    queueMessage.suggestionEntityId
  );

  if (entityExistsRes.isErr()) {
    context.error(
      "[notificationQueue] failed to check suggestion existence",
      entityExistsRes.error
    );
    return;
  }

  if (!entityExistsRes.value) {
    context.log(
      "[notificationQueue] suggestion entity no longer exists — skipping notification",
      {
        suggestionEntityId: queueMessage.suggestionEntityId,
      }
    );
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
    context.log(
      "[notificationQueue] user already logged a matching entity in the past hour — skipping notification"
    );
    return;
  }

  const ottRes = await IdentityManager.createOtt(
    OneTimeTokenScope.suggestionAccept,
    queueMessage.suggestionEntityId
  );

  if (ottRes.isErr()) {
    context.error("[notificationQueue] failed to create OTT", ottRes.error);
    return;
  }

  const baseUrl = (process.env.GAPI_BASE_URL ?? "").replace(/\/?$/, "/");
  const addUrl = new URL("suggestAccept", baseUrl);
  addUrl.searchParams.set("token", ottRes.value);

  context.log("[notificationQueue] sending push notification", {
    suggestionEntityId: queueMessage.suggestionEntityId,
  });

  const sendRes = await Notification.send({
    userId: queueMessage.userId,
    title: "Forget this?",
    body: queueMessage.textValues.join("\n"),
    actions: [{ action: "add", title: "Add", url: addUrl.toString() }],
  });

  if (sendRes.isErr()) {
    context.error(
      "[notificationQueue] Notification.send failed:",
      sendRes.error
    );
  } else {
    context.log("[notificationQueue] Notification.send completed successfully");
  }
}

app.storageQueue("notificationQueue", {
  queueName: "notification-queue",
  connection: "AzureWebJobsStorage",
  handler: notificationQueueHandler,
});
