/*
  Warnings:

  - You are about to drop the column `renderType` on the `PropertyConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PropertyConfig" DROP COLUMN "renderType",
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;
