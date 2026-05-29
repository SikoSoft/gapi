import { z } from "zod";

export const frontEndLogSchema = z.object({
  type: z.enum(["error", "unhandledrejection"]),
  message: z.string(),
  url: z.string(),
  userAgent: z.string(),
  timestamp: z.number(),
  stack: z.string().optional(),
  source: z.string().optional(),
  lineno: z.number().optional(),
  colno: z.number().optional(),
});

export type FrontEndLogPayload = z.infer<typeof frontEndLogSchema>;
