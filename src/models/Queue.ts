export interface QueueSendMessageOptions {
  visibilityTimeout?: number;
}

export interface QueueSendResult {
  messageId: string;
  expiresOn?: Date;
  nextVisibleOn?: Date;
  requestId?: string;
}

export interface QueueCreateResult {
  succeeded: boolean;
}

export interface QueueProvider {
  url: string;
  createIfNotExists(): Promise<QueueCreateResult>;
  sendMessage(
    message: string,
    options?: QueueSendMessageOptions
  ): Promise<QueueSendResult>;
}
