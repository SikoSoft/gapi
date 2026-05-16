export interface NotificationQueueMessage {
  userId: string;
  entityConfigId: number;
  suggestionEntityId: number;
  textValues: string[];
  createdAt: string;
}
