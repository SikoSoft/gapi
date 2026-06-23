-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "allowComments" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EntityConfig" ADD COLUMN     "allowComments" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "userId" UUID,
    "guestName" VARCHAR(128),
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentReaction" (
    "id" SERIAL NOT NULL,
    "commentId" INTEGER NOT NULL,
    "userId" UUID,
    "ip" VARCHAR(64),
    "type" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_comment_entityid_createdat" ON "Comment"("entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommentReaction_commentId_userId_key" ON "CommentReaction"("commentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentReaction_commentId_ip_key" ON "CommentReaction"("commentId", "ip");

-- CreateIndex
CREATE INDEX "idx_commentreaction_commentid" ON "CommentReaction"("commentId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
