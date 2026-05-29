import { z } from "zod";

export const LeaderboardCreateBodySchema = z.object({
  score: z.number(),
  duration: z.number(),
  name: z.string(),
});
export type LeaderboardCreateBody = z.infer<typeof LeaderboardCreateBodySchema>;

export const LeaderboardRecordSchema = z.object({
  name: z.string(),
  rank: z.number(),
  score: z.number(),
});
export type LeaderboardRecord = z.infer<typeof LeaderboardRecordSchema>;
