import { z } from "zod";
import { Prisma } from "@prisma/client";
import { CommentReactionType } from "api-spec/models/Comment";

export { CommentReactionType };

export const commentInclude = {
  reactions: true,
} satisfies Prisma.CommentFindUniqueArgs["include"];

const prismaComment = Prisma.validator<Prisma.CommentFindUniqueArgs>()({
  where: { id: 0 },
  include: commentInclude,
});

export type PrismaComment = Prisma.CommentGetPayload<typeof prismaComment>;

export interface CommentCounts {
  like: number;
  dislike: number;
}

export interface CommentSpec {
  id: number;
  entityId: number;
  userId: string | null;
  guestName: string | null;
  body: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  counts: CommentCounts;
}

export const CommentCreateBodySchema = z.object({
  entityId: z.number(),
  body: z.string().min(1).max(4000),
  guestName: z.string().min(1).max(128).optional(),
});
export type CommentCreateBody = z.infer<typeof CommentCreateBodySchema>;

export const CommentUpdateBodySchema = z.object({
  published: z.boolean(),
});
export type CommentUpdateBody = z.infer<typeof CommentUpdateBodySchema>;

export const CommentReactionBodySchema = z.object({
  type: z.nativeEnum(CommentReactionType),
});
export type CommentReactionBody = z.infer<typeof CommentReactionBodySchema>;
