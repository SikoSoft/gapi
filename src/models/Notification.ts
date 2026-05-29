import { z } from "zod";

export const NotificationActionSchema = z.object({
  action: z.string(),
  title: z.string(),
  url: z.string(),
});
export type NotificationAction = z.infer<typeof NotificationActionSchema>;

export const NotificationMessageSchema = z.object({
  userId: z.string(),
  title: z.string(),
  body: z.string(),
  actions: z.array(NotificationActionSchema),
});
export type NotificationMessage = z.infer<typeof NotificationMessageSchema>;
