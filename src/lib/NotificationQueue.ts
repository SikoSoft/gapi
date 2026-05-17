import { QueueClient } from "@azure/storage-queue";
import { Result, err, ok } from "neverthrow";
import { NotificationQueueMessage } from "../models/NotificationQueue";
import { Logger } from "./Logger";

const QUEUE_NAME = "notification-queue";
const NOTIFICATION_DELAY_MS = 60 * 60 * 1000;

function extractAccountName(connectionString: string): string {
  const match = /AccountName=([^;]+)/.exec(connectionString);
  return match ? match[1] : "(unknown)";
}

export class NotificationQueue {
  private static getClient(): QueueClient {
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      throw new Error("Missing AzureWebJobsStorage environment variable");
    }
    return new QueueClient(connectionString, QUEUE_NAME);
  }

  static async enqueue(
    message: NotificationQueueMessage
  ): Promise<Result<void, Error>> {
    try {
      const connectionString = process.env.AzureWebJobsStorage ?? "";
      const accountName = extractAccountName(connectionString);

      const notifyAt = new Date(
        new Date(message.createdAt).getTime() + NOTIFICATION_DELAY_MS
      );
      const visibilityTimeoutSeconds = Math.max(
        0,
        Math.floor((notifyAt.getTime() - Date.now()) / 1000)
      );

      Logger.log("[NotificationQueue] enqueue start", {
        storageAccount: accountName,
        queueName: QUEUE_NAME,
        visibilityTimeoutSeconds,
        notifyAt: notifyAt.toISOString(),
        message,
      });

      const client = NotificationQueue.getClient();

      Logger.log("[NotificationQueue] queue URL:", client.url);

      const createResult = await client.createIfNotExists();
      if (createResult.succeeded) {
        Logger.log("[NotificationQueue] queue did not exist — created it now");
      } else {
        Logger.log("[NotificationQueue] queue already exists, reusing");
      }

      const encoded = Buffer.from(JSON.stringify(message)).toString("base64");
      const sendResult = await client.sendMessage(encoded, {
        visibilityTimeout: visibilityTimeoutSeconds,
      });

      Logger.log("[NotificationQueue] message enqueued successfully", {
        messageId: sendResult.messageId,
        expiresOn: sendResult.expiresOn,
        nextVisibleOn: sendResult.nextVisibleOn,
        visibleAt: notifyAt.toISOString(),
        requestId: sendResult.requestId,
      });

      return ok(undefined);
    } catch (error) {
      Logger.error("[NotificationQueue] enqueue FAILED", {
        error: error instanceof Error ? error.message : String(error),
        cause:
          error instanceof Error && error.cause instanceof Error
            ? error.cause.message
            : undefined,
      });
      return err(new Error("Failed to enqueue notification", { cause: error }));
    }
  }
}
