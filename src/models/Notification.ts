export interface NotificationAction {
  action: string;
  title: string;
  url: string;
}

export interface NotificationMessage {
  userId: string;
  title: string;
  body: string;
  actions: NotificationAction[];
}
