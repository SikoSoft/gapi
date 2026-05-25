/*
  Warnings:

  - You are about to drop the column `suggestion` on the `Entity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "suggestion";

-- AlterTable
ALTER TABLE "ListFilter" ADD COLUMN     "identified" BOOLEAN DEFAULT false,
ADD COLUMN     "suggested" BOOLEAN DEFAULT false;
