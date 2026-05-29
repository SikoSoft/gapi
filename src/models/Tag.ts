import { z } from "zod";

export const TagCreateBodySchema = z.object({
  label: z.string(),
});
export type TagCreateBody = z.infer<typeof TagCreateBodySchema>;
