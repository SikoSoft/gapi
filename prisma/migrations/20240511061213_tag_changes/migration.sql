/*
  Warnings:

  - The primary key for the `ActionTag` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `tagId` on the `ActionTag` table. All the data in the column will be lost.
  - The primary key for the `Tag` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Tag` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[label]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `label` to the `ActionTag` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ActionTag" DROP CONSTRAINT "ActionTag_tagId_fkey";

-- AlterTable
ALTER TABLE "ActionTag" DROP CONSTRAINT "ActionTag_pkey",
DROP COLUMN "tagId",
ADD COLUMN     "label" VARCHAR(128) NOT NULL,
ADD CONSTRAINT "ActionTag_pkey" PRIMARY KEY ("actionId", "label");

-- AlterTable
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_pkey",
DROP COLUMN "id";

-- CreateIndex
CREATE UNIQUE INDEX "Tag_label_key" ON "Tag"("label");

-- AddForeignKey
ALTER TABLE "ActionTag" ADD CONSTRAINT "ActionTag_label_fkey" FOREIGN KEY ("label") REFERENCES "Tag"("label") ON DELETE RESTRICT ON UPDATE CASCADE;
