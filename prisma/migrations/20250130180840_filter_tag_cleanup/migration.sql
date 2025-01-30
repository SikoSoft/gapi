/*
  Warnings:

  - You are about to drop the `ListFilterTagging` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ListFilterTaggingTag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ListFilterTagging" DROP CONSTRAINT "ListFilterTagging_listFilterId_fkey";

-- DropForeignKey
ALTER TABLE "ListFilterTaggingTag" DROP CONSTRAINT "ListFilterTaggingTag_taggingId_fkey";

-- DropTable
DROP TABLE "ListFilterTagging";

-- DropTable
DROP TABLE "ListFilterTaggingTag";

-- CreateTable
CREATE TABLE "ListFilterTag" (
    "filterId" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "tag" VARCHAR(255) NOT NULL,
    "taggingId" UUID NOT NULL,

    CONSTRAINT "ListFilterTag_pkey" PRIMARY KEY ("taggingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterTag_filterId_tag_type_key" ON "ListFilterTag"("filterId", "tag", "type");

-- AddForeignKey
ALTER TABLE "ListFilterTag" ADD CONSTRAINT "ListFilterTag_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "ListFilter"("listId") ON DELETE RESTRICT ON UPDATE CASCADE;
