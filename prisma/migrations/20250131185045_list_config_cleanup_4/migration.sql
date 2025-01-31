/*
  Warnings:

  - The primary key for the `ListFilterText` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `listFilterId` on the `ListFilterText` table. All the data in the column will be lost.
  - Added the required column `listConfigId` to the `ListFilterText` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ListFilterText" DROP CONSTRAINT "ListFilterText_listFilterId_fkey";

-- AlterTable
ALTER TABLE "ListFilterText" DROP CONSTRAINT "ListFilterText_pkey",
DROP COLUMN "listFilterId",
ADD COLUMN     "listConfigId" UUID NOT NULL,
ADD CONSTRAINT "ListFilterText_pkey" PRIMARY KEY ("listConfigId");

-- AddForeignKey
ALTER TABLE "ListFilterText" ADD CONSTRAINT "ListFilterText_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;
