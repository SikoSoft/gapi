import { Result, err, ok } from "neverthrow";
import { StreakAlertQueueMessage } from "../models/StreakAlertQueue";
import { AzureQueueProvider } from "./AzureQueueProvider";
import { Logger } from "./Logger";

const QUEUE_NAME = "streak-alert-queue";

export class StreakAlertQueue {
  private static getProvider(): AzureQueueProvider {
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      throw new Error("Missing AzureWebJobsStorage environment variable");
    }
    return new AzureQueueProvider(connectionString, QUEUE_NAME);
  }

  static async ensureExists(): Promise<Result<void, Error>> {
    try {
      const provider = StreakAlertQueue.getProvider();
      const result = await provider.createIfNotExists();
      if (result.succeeded) {
        Logger.log("[StreakAlertQueue] queue created");
      }
      return ok(undefined);
    } catch (error) {
      Logger.error("[StreakAlertQueue] failed to ensure queue exists", {
        error: error instanceof Error ? error.message : String(error),
      });
      return err(new Error("Failed to ensure streak alert queue exists", { cause: error }));
    }
  }

  static async enqueue(
    message: StreakAlertQueueMessage,
    notifyAt: Date
  ): Promise<Result<void, Error>> {
    try {
      const visibilityTimeoutSeconds = Math.max(
        0,
        Math.floor((notifyAt.getTime() - Date.now()) / 1000)
      );

      Logger.log("[StreakAlertQueue] enqueue start", {
        message,
        visibilityTimeoutSeconds,
        notifyAt: notifyAt.toISOString(),
      });

      const provider = StreakAlertQueue.getProvider();

      const createResult = await provider.createIfNotExists();
      if (createResult.succeeded) {
        Logger.log("[StreakAlertQueue] queue did not exist — created it now");
      }

      const encoded = Buffer.from(JSON.stringify(message)).toString("base64");
      const sendResult = await provider.sendMessage(encoded, {
        visibilityTimeout: visibilityTimeoutSeconds,
      });

      Logger.log("[StreakAlertQueue] message enqueued successfully", {
        messageId: sendResult.messageId,
        notifyAt: notifyAt.toISOString(),
      });

      return ok(undefined);
    } catch (error) {
      Logger.error("[StreakAlertQueue] enqueue FAILED", {
        error: error instanceof Error ? error.message : String(error),
      });
      return err(new Error("Failed to enqueue streak alert", { cause: error }));
    }
  }
}
