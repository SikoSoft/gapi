import { err, ok, Result } from "neverthrow";
import { prisma } from "..";
import { Comment as CommentRow, CommentReactionType } from "@prisma/client";
import {
  CommentIdentity,
  CommentReactionCounts,
  CommentRecord,
  ReactionIdentity,
} from "../models/Comment";
import { AccessError } from "../errors/AccessError";
import { ValidationError } from "../errors/ValidationError";

export class Comment {
  static async create(
    entityId: number,
    body: string,
    identity: CommentIdentity
  ): Promise<Result<CommentRecord, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId },
        select: { allowComments: true },
      });

      if (!entity) {
        return err(new ValidationError("Entity not found"));
      }

      if (!entity.allowComments) {
        return err(new AccessError("Comments are not allowed on this entity"));
      }

      if (!identity.userId && !identity.guestName) {
        return err(
          new ValidationError("guestName is required for guest comments")
        );
      }

      const created = await prisma.comment.create({
        data: {
          entityId,
          userId: identity.userId ?? null,
          guestName: identity.userId ? null : identity.guestName,
          body,
          published: false,
        },
      });

      return ok(Comment.mapDataToSpec(created, { like: 0, dislike: 0 }));
    } catch (error) {
      return err(new Error("Failed to create comment", { cause: error }));
    }
  }

  static async getById(id: number): Promise<Result<CommentRecord, Error>> {
    try {
      const comment = await prisma.comment.findUnique({ where: { id } });
      if (!comment) {
        return err(new ValidationError("Comment not found"));
      }

      const counts = await Comment.getCounts([id]);
      return ok(
        Comment.mapDataToSpec(comment, counts.get(id) ?? { like: 0, dislike: 0 })
      );
    } catch (error) {
      return err(new Error("Failed to get comment", { cause: error }));
    }
  }

  static async getListForEntity(
    entityId: number,
    requestingUserId?: string
  ): Promise<Result<CommentRecord[], Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId },
        select: { userId: true },
      });

      if (!entity) {
        return err(new ValidationError("Entity not found"));
      }

      const includeUnpublished =
        !!requestingUserId && entity.userId === requestingUserId;

      const comments = await prisma.comment.findMany({
        where: {
          entityId,
          ...(includeUnpublished ? {} : { published: true }),
        },
        orderBy: { createdAt: "asc" },
      });

      const counts = await Comment.getCounts(comments.map((c) => c.id));
      return ok(
        comments.map((comment) =>
          Comment.mapDataToSpec(
            comment,
            counts.get(comment.id) ?? { like: 0, dislike: 0 }
          )
        )
      );
    } catch (error) {
      return err(new Error("Failed to get comments", { cause: error }));
    }
  }

  static async setPublished(
    userId: string,
    id: number,
    published: boolean
  ): Promise<Result<CommentRecord, Error>> {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id },
        include: { entity: { select: { userId: true } } },
      });

      if (!comment) {
        return err(new ValidationError("Comment not found"));
      }

      if (comment.entity.userId !== userId) {
        return err(new AccessError("Not authorized to moderate this comment"));
      }

      const updated = await prisma.comment.update({
        where: { id },
        data: { published },
      });

      const counts = await Comment.getCounts([id]);
      return ok(
        Comment.mapDataToSpec(updated, counts.get(id) ?? { like: 0, dislike: 0 })
      );
    } catch (error) {
      return err(new Error("Failed to update comment", { cause: error }));
    }
  }

  static async delete(
    userId: string | undefined,
    id: number
  ): Promise<Result<boolean, Error>> {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id },
        include: { entity: { select: { userId: true } } },
      });

      if (!comment) {
        return err(new ValidationError("Comment not found"));
      }

      const isEntityOwner = !!userId && comment.entity.userId === userId;
      const isAuthor = !!userId && comment.userId === userId;

      if (!isEntityOwner && !isAuthor) {
        return err(new AccessError("Not authorized to delete this comment"));
      }

      await prisma.comment.delete({ where: { id } });
      return ok(true);
    } catch (error) {
      return err(new Error("Failed to delete comment", { cause: error }));
    }
  }

  static async react(
    commentId: number,
    identity: ReactionIdentity,
    type: CommentReactionType
  ): Promise<Result<CommentReactionCounts, Error>> {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true },
      });

      if (!comment) {
        return err(new ValidationError("Comment not found"));
      }

      if (identity.userId) {
        await prisma.commentReaction.upsert({
          where: {
            commentId_userId: { commentId, userId: identity.userId },
          },
          create: { commentId, userId: identity.userId, type },
          update: { type },
        });
      } else {
        const ip = identity.ip ?? "";
        await prisma.commentReaction.upsert({
          where: { commentId_ip: { commentId, ip } },
          create: { commentId, ip, type },
          update: { type },
        });
      }

      const counts = await Comment.getCounts([commentId]);
      return ok(counts.get(commentId) ?? { like: 0, dislike: 0 });
    } catch (error) {
      return err(new Error("Failed to react to comment", { cause: error }));
    }
  }

  static async removeReaction(
    commentId: number,
    identity: ReactionIdentity
  ): Promise<Result<CommentReactionCounts, Error>> {
    try {
      if (identity.userId) {
        await prisma.commentReaction.deleteMany({
          where: { commentId, userId: identity.userId },
        });
      } else {
        await prisma.commentReaction.deleteMany({
          where: { commentId, ip: identity.ip ?? "" },
        });
      }

      const counts = await Comment.getCounts([commentId]);
      return ok(counts.get(commentId) ?? { like: 0, dislike: 0 });
    } catch (error) {
      return err(new Error("Failed to remove reaction", { cause: error }));
    }
  }

  static async getCounts(
    commentIds: number[]
  ): Promise<Map<number, CommentReactionCounts>> {
    const counts = new Map<number, CommentReactionCounts>();
    if (commentIds.length === 0) {
      return counts;
    }

    const grouped = await prisma.commentReaction.groupBy({
      by: ["commentId", "type"],
      where: { commentId: { in: commentIds } },
      _count: { _all: true },
    });

    for (const row of grouped) {
      const entry = counts.get(row.commentId) ?? { like: 0, dislike: 0 };
      entry[row.type] = row._count._all;
      counts.set(row.commentId, entry);
    }

    return counts;
  }

  static mapDataToSpec(
    data: CommentRow,
    counts: CommentReactionCounts
  ): CommentRecord {
    return {
      id: data.id,
      entityId: data.entityId,
      userId: data.userId,
      guestName: data.guestName,
      body: data.body,
      published: data.published,
      likeCount: counts.like,
      dislikeCount: counts.dislike,
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
    };
  }
}
