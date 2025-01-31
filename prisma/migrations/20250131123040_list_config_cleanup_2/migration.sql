/*
  Warnings:

  - The primary key for the `ListFilterTag` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `taggingId` on the `ListFilterTag` table. All the data in the column will be lost.
  - The primary key for the `ListFilterText` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ListFilterText` table. All the data in the column will be lost.
  - Added the required column `listFilterId` to the `ListFilterText` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ListFilterText" DROP CONSTRAINT "ListFilterText_id_fkey";

-- AlterTable
ALTER TABLE "ListFilterTag" DROP CONSTRAINT "ListFilterTag_pkey",
DROP COLUMN "taggingId";

-- AlterTable
ALTER TABLE "ListFilterText" DROP CONSTRAINT "ListFilterText_pkey",
DROP COLUMN "id",
ADD COLUMN     "listFilterId" UUID NOT NULL,
ADD CONSTRAINT "ListFilterText_pkey" PRIMARY KEY ("listFilterId");

-- AddForeignKey
ALTER TABLE "ListFilterText" ADD CONSTRAINT "ListFilterText_listFilterId_fkey" FOREIGN KEY ("listFilterId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;
