/*
  Warnings:

  - You are about to drop the column `type` on the `PropertyConfig` table. All the data in the column will be lost.
  - Added the required column `dataType` to the `PropertyConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `renderType` to the `PropertyConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PropertyConfig" DROP COLUMN "type",
ADD COLUMN     "dataType" VARCHAR(128) NOT NULL,
ADD COLUMN     "renderType" VARCHAR(128) NOT NULL;
