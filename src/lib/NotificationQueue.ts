import { QueueClient } from "@azure/storage-queue";
import { Result, err, ok } from "neverthrow";
import { NotificationQueueMessage } from "../models/NotificationQueue";

const QUEUE_NAME = "notification-queue";
const NOTIFICATION_DELAY_SECONDS = 3600;

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
      const client = NotificationQueue.getClient();
      await client.createIfNotExists();
      const encoded = Buffer.from(JSON.stringify(message)).toString("base64");
      await client.sendMessage(encoded, {
        visibilityTimeout: NOTIFICATION_DELAY_SECONDS,
      });
      return ok(undefined);
    } catch (error) {
      return err(
        new Error("Failed to enqueue notification", { cause: error })
      );
    }
  }
}
