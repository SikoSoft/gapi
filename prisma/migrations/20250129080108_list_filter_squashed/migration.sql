/*
  Warnings:

  - The primary key for the `ListFilter` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[listId]` on the table `ListFilter` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ListFilter" DROP CONSTRAINT "ListFilter_pkey";

-- CreateTable
CREATE TABLE "ListFilterTime" (
    "id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,

    CONSTRAINT "ListFilterTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterText" (
    "id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "subStr" VARCHAR(255) NOT NULL,

    CONSTRAINT "ListFilterText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterTagging" (
    "listFilterId" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL
);

-- CreateTable
CREATE TABLE "ListFilterTaggingTag" (
    "tag" VARCHAR(255) NOT NULL,
    "taggingId" UUID NOT NULL,

    CONSTRAINT "ListFilterTaggingTag_pkey" PRIMARY KEY ("taggingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterTagging_listFilterId_key" ON "ListFilterTagging"("listFilterId");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterTaggingTag_taggingId_tag_key" ON "ListFilterTaggingTag"("taggingId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilter_listId_key" ON "ListFilter"("listId");

-- AddForeignKey
ALTER TABLE "ListFilterTime" ADD CONSTRAINT "ListFilterTime_id_fkey" FOREIGN KEY ("id") REFERENCES "ListFilter"("listId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterText" ADD CONSTRAINT "ListFilterText_id_fkey" FOREIGN KEY ("id") REFERENCES "ListFilter"("listId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterTagging" ADD CONSTRAINT "ListFilterTagging_listFilterId_fkey" FOREIGN KEY ("listFilterId") REFERENCES "ListFilter"("listId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterTaggingTag" ADD CONSTRAINT "ListFilterTaggingTag_taggingId_fkey" FOREIGN KEY ("taggingId") REFERENCES "ListFilterTagging"("listFilterId") ON DELETE RESTRICT ON UPDATE CASCADE;
