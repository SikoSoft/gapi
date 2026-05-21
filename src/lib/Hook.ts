import { HookContext, HookHandler, HookType } from "../models/Hook";
import { QueueProvider } from "../models/Queue";
import { AzureQueueProvider } from "./AzureQueueProvider";
import { Logger } from "./Logger";

const QUEUE_NAME = "hook-queue";

const handlers = new Map<HookType, HookHandler[]>();

function getProvider(): QueueProvider | null {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    return null;
  }
  return new AzureQueueProvider(connectionString, QUEUE_NAME);
}

export class Hook {
  static async ensureQueue(): Promise<void> {
    const provider = getProvider();
    if (!provider) {
      Logger.error("[Hook] Missing AzureWebJobsStorage — cannot ensure queue");
      return;
    }
    try {
      await provider.createIfNotExists();
    } catch (error) {
      Logger.error("[Hook] Failed to ensure hook queue exists", { error });
    }
  }

  static register(type: HookType, handler: HookHandler): void {
    if (!handlers.has(type)) {
      handlers.set(type, []);
    }
    handlers.get(type)!.push(handler);
  }

  // Serializes the context and enqueues it for async processing.
  //
  // NOTE: PRE_ hooks (preCreate, preUpdate, preDelete) are dispatched asynchronously
  // and therefore cannot gate or modify the operation that triggered them. A future
  // enhancement would invoke PRE_ handlers synchronously before the operation proceeds,
  // enabling true interception and payload mutation.
  static async trigger(context: HookContext): Promise<void> {
    try {
      const provider = getProvider();
      if (!provider) {
        Logger.error("[Hook] Missing AzureWebJobsStorage — hook not enqueued", {
          type: context.type,
        });
        return;
      }
      const encoded = Buffer.from(JSON.stringify(context)).toString("base64");
      await provider.sendMessage(encoded);
    } catch (error) {
      Logger.error("[Hook] Failed to enqueue hook context", {
        type: context.type,
        error,
      });
    }
  }

  static async run(context: HookContext): Promise<void> {
    const typeHandlers = handlers.get(context.type) ?? [];
    await Promise.all(typeHandlers.map(handler => handler(context)));
  }
}
