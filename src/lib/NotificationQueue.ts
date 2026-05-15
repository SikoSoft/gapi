import { QueueClient } from "@azure/storage-queue";
import { Result, err, ok } from "neverthrow";
import { NotificationQueueMessage } from "../models/NotificationQueue";

const QUEUE_NAME = "notification-queue";
const NOTIFICATION_DELAY_SECONDS = 3600;

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

      console.log("[NotificationQueue] enqueue start", {
        storageAccount: accountName,
        queueName: QUEUE_NAME,
        visibilityTimeoutSeconds: NOTIFICATION_DELAY_SECONDS,
        message,
      });

      const client = NotificationQueue.getClient();

      console.log("[NotificationQueue] queue URL:", client.url);

      const createResult = await client.createIfNotExists();
      if (createResult.created) {
        console.log("[NotificationQueue] queue did not exist — created it now");
      } else {
        console.log("[NotificationQueue] queue already exists, reusing");
      }

      const encoded = Buffer.from(JSON.stringify(message)).toString("base64");
      const sendResult = await client.sendMessage(encoded, {
        visibilityTimeout: NOTIFICATION_DELAY_SECONDS,
      });

      console.log("[NotificationQueue] message enqueued successfully", {
        messageId: sendResult.messageId,
        insertionTime: sendResult.insertionTime,
        expiresOn: sendResult.expiresOn,
        visibleAt: new Date(
          Date.now() + NOTIFICATION_DELAY_SECONDS * 1000
        ).toISOString(),
        requestId: sendResult.requestId,
      });

      return ok(undefined);
    } catch (error) {
      console.error("[NotificationQueue] enqueue FAILED", {
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
