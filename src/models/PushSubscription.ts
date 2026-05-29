import { z } from "zod";

export const PushSubscriptionPayloadSchema = z.object({
  endpoint: z.string(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});
export type PushSubscriptionPayload = z.infer<typeof PushSubscriptionPayloadSchema>;
