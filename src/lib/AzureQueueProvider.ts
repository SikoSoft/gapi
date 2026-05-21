import { QueueClient } from "@azure/storage-queue";
import {
  QueueCreateResult,
  QueueProvider,
  QueueSendMessageOptions,
  QueueSendResult,
} from "../models/Queue";

export class AzureQueueProvider implements QueueProvider {
  private client: QueueClient;

  constructor(connectionString: string, queueName: string) {
    this.client = new QueueClient(connectionString, queueName);
  }

  get url(): string {
    return this.client.url;
  }

  async createIfNotExists(): Promise<QueueCreateResult> {
    const result = await this.client.createIfNotExists();
    return { succeeded: result.succeeded ?? false };
  }

  async sendMessage(
    message: string,
    options?: QueueSendMessageOptions
  ): Promise<QueueSendResult> {
    const result = await this.client.sendMessage(message, options);
    return {
      messageId: result.messageId,
      expiresOn: result.expiresOn,
      nextVisibleOn: result.nextVisibleOn,
      requestId: result.requestId,
    };
  }
}
