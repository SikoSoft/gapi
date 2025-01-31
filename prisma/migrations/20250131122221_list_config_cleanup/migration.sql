/*
  Warnings:

  - The primary key for the `ListFilter` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `listId` on the `ListFilter` table. All the data in the column will be lost.
  - The primary key for the `ListSort` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `listId` on the `ListSort` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[listConfigId]` on the table `ListFilter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[listConfigId]` on the table `ListSort` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `listConfigId` to the `ListFilter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `listConfigId` to the `ListSort` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ListFilter" DROP CONSTRAINT "ListFilter_listId_fkey";

-- DropForeignKey
ALTER TABLE "ListSort" DROP CONSTRAINT "ListSort_listId_fkey";

-- AlterTable
ALTER TABLE "ListFilter" DROP CONSTRAINT "ListFilter_pkey",
DROP COLUMN "listId",
ADD COLUMN     "listConfigId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "ListSort" DROP CONSTRAINT "ListSort_pkey",
DROP COLUMN "listId",
ADD COLUMN     "listConfigId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "ListFilterTime" (
    "listConfigId" UUID NOT NULL,
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
CREATE TABLE "ListFilterTag" (
    "listConfigId" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "tag" VARCHAR(255) NOT NULL,
    "taggingId" UUID NOT NULL,

    CONSTRAINT "ListFilterTag_pkey" PRIMARY KEY ("taggingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterTime_listConfigId_key" ON "ListFilterTime"("listConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterTag_listConfigId_tag_type_key" ON "ListFilterTag"("listConfigId", "tag", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilter_listConfigId_key" ON "ListFilter"("listConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "ListSort_listConfigId_key" ON "ListSort"("listConfigId");

-- AddForeignKey
ALTER TABLE "ListSort" ADD CONSTRAINT "ListSort_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterTime" ADD CONSTRAINT "ListFilterTime_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterText" ADD CONSTRAINT "ListFilterText_id_fkey" FOREIGN KEY ("id") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterTag" ADD CONSTRAINT "ListFilterTag_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilter" ADD CONSTRAINT "ListFilter_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
