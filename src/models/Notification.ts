export interface NotificationAction {
  action: string;
  label: string;
  url: string;
}

export interface NotificationMessage {
  userId: string;
  topic: string;
  message: string;
  actions: NotificationAction[];
}
