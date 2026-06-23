import { Result, err, ok } from "neverthrow";
import { prisma } from "..";
import { CommentReactionType } from "api-spec/models/Comment";
import {
  CommentCounts,
  CommentCreateBody,
  CommentSpec,
} from "../models/Comment";
import { ValidationError } from "../errors/ValidationError";
import { AccessError } from "../errors/AccessError";

interface CommentRecord {
  id: number;
  entityId: number;
  userId: string | null;
  guestName: string | null;
  body: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Comment {
  static async create(
    userId: string | null,
    data: CommentCreateBody
  ): Promise<Result<CommentSpec, Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: data.entityId },
        select: { allowComments: true },
      });

      if (!entity) {
        return err(new ValidationError("Entity not found"));
      }
      if (!entity.allowComments) {
        return err(
          new ValidationError("Comments are not allowed on this entity")
        );
      }
      if (!userId && !data.guestName) {
        return err(
          new ValidationError("guestName is required for guest comments")
        );
      }

      const comment = await prisma.comment.create({
        data: {
          entityId: data.entityId,
          userId,
          guestName: userId ? null : data.guestName,
          body: data.body,
        },
      });

      return ok(Comment.mapDataToSpec(comment));
    } catch (error) {
      return err(new Error("Failed to create comment", { cause: error }));
    }
  }

  static async getForEntity(
    entityId: number,
    viewerUserId: string | null
  ): Promise<Result<CommentSpec[], Error>> {
    try {
      const entity = await prisma.entity.findUnique({
        where: { id: entityId },
        select: { userId: true },
      });
      if (!entity) {
        return err(new ValidationError("Entity not found"));
      }

      const isOwner = viewerUserId !== null && entity.userId === viewerUserId;

      const comments = await prisma.comment.findMany({
        where: {
          entityId,
          ...(isOwner ? {} : { published: true }),
        },
        orderBy: { createdAt: "asc" },
      });

      const counts = await Comment.getCountsForComments(
        comments.map((comment) => comment.id)
      );

      return ok(
        comments.map((comment) =>
          Comment.mapDataToSpec(comment, counts[comment.id])
        )
      );
    } catch (error) {
      return err(new Error("Failed to retrieve comments", { cause: error }));
    }
  }

  static async setPublished(
    userId: string,
    commentId: number,
    published: boolean
  ): Promise<Result<CommentSpec, Error>> {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { entity: { select: { userId: true } } },
      });
      if (!comment) {
        return err(new ValidationError("Comment not found"));
      }
      if (comment.entity.userId !== userId) {
        return err(new AccessError("Not authorized to moderate this comment"));
      }

      const updated = await prisma.comment.update({
        where: { id: commentId },
        data: { published },
      });

      const counts = await Comment.getCountsForComments([commentId]);
      return ok(Comment.mapDataToSpec(updated, counts[commentId]));
    } catch (error) {
      return err(new Error("Failed to update comment", { cause: error }));
    }
  }

  static async delete(
    userId: string,
    commentId: number
  ): Promise<Result<boolean, Error>> {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: { entity: { select: { userId: true } } },
      });
      if (!comment) {
        return err(new ValidationError("Comment not found"));
      }
      if (comment.userId !== userId && comment.entity.userId !== userId) {
        return err(new AccessError("Not authorized to delete this comment"));
      }

      await prisma.comment.delete({ where: { id: commentId } });
      return ok(true);
    } catch (error) {
      return err(new Error("Failed to delete comment", { cause: error }));
    }
  }

  static async react(
    userId: string | null,
    ip: string | null,
    commentId: number,
    type: CommentReactionType
  ): Promise<Result<CommentCounts, Error>> {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true },
      });
      if (!comment) {
        return err(new ValidationError("Comment not found"));
      }

      if (userId) {
        await prisma.commentReaction.upsert({
          where: { commentId_userId: { commentId, userId } },
          update: { type },
          create: { commentId, userId, type },
        });
      } else {
        await prisma.commentReaction.upsert({
          where: { commentId_ip: { commentId, ip } },
          update: { type },
          create: { commentId, ip, type },
        });
      }

      const counts = await Comment.getCountsForComments([commentId]);
      return ok(counts[commentId] ?? { like: 0, dislike: 0 });
    } catch (error) {
      return err(new Error("Failed to react to comment", { cause: error }));
    }
  }

  static async removeReaction(
    userId: string | null,
    ip: string | null,
    commentId: number
  ): Promise<Result<CommentCounts, Error>> {
    try {
      if (userId) {
        await prisma.commentReaction.deleteMany({
          where: { commentId, userId },
        });
      } else {
        await prisma.commentReaction.deleteMany({
          where: { commentId, ip },
        });
      }

      const counts = await Comment.getCountsForComments([commentId]);
      return ok(counts[commentId] ?? { like: 0, dislike: 0 });
    } catch (error) {
      return err(new Error("Failed to remove reaction", { cause: error }));
    }
  }

  static async getCountsForComments(
    commentIds: number[]
  ): Promise<Record<number, CommentCounts>> {
    const counts: Record<number, CommentCounts> = {};
    for (const id of commentIds) {
      counts[id] = { like: 0, dislike: 0 };
    }

    if (commentIds.length === 0) {
      return counts;
    }

    const grouped = await prisma.commentReaction.groupBy({
      by: ["commentId", "type"],
      where: { commentId: { in: commentIds } },
      _count: { _all: true },
    });

    for (const row of grouped) {
      // CommentReaction.type is a plain VARCHAR column holding the string value of
      // api-spec's CommentReactionType — compared by value here, not by enum identifier,
      // since that's all a string column can hold.
      if (row.type === "like") {
        counts[row.commentId].like = row._count._all;
      } else if (row.type === "dislike") {
        counts[row.commentId].dislike = row._count._all;
      }
    }

    return counts;
  }

  static mapDataToSpec(
    data: CommentRecord,
    counts: CommentCounts = { like: 0, dislike: 0 }
  ): CommentSpec {
    return {
      id: data.id,
      entityId: data.entityId,
      userId: data.userId,
      guestName: data.guestName,
      body: data.body,
      published: data.published,
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
      counts,
    };
  }
}
