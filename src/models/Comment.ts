import { z } from "zod";

export const commentCreateSchema = z.object({
  entityId: z.number(),
  body: z.string().min(1).max(5000),
  guestName: z.string().min(1).max(128).optional(),
});
export type CommentCreateBody = z.infer<typeof commentCreateSchema>;

export const commentUpdateSchema = z.object({
  published: z.boolean(),
});
export type CommentUpdateBody = z.infer<typeof commentUpdateSchema>;

export const commentReactionSchema = z.object({
  type: z.enum(["like", "dislike"]),
});
export type CommentReactionBody = z.infer<typeof commentReactionSchema>;

export interface CommentReactionCounts {
  like: number;
  dislike: number;
}

export interface CommentRecord {
  id: number;
  entityId: number;
  userId: string | null;
  guestName: string | null;
  body: string;
  published: boolean;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentIdentity {
  userId?: string;
  guestName?: string;
}

export interface ReactionIdentity {
  userId?: string;
  ip?: string;
}
