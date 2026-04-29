/*
  Warnings:

  - The primary key for the `Setting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `NumberSetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TextSetting` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[listConfigId]` on the table `Setting` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "NumberSetting" DROP CONSTRAINT "NumberSetting_settingId_fkey";

-- DropForeignKey
ALTER TABLE "TextSetting" DROP CONSTRAINT "TextSetting_settingId_fkey";

-- DropForeignKey
ALTER TABLE "BooleanSetting" DROP CONSTRAINT "BooleanSetting_settingId_fkey";

-- DropIndex
DROP INDEX "Setting_id_key";

-- AlterTable
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey",
ADD COLUMN     "userId" UUID,
ALTER COLUMN "listConfigId" DROP NOT NULL,
ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "NumberSetting";

-- DropTable
DROP TABLE "TextSetting";

-- CreateTable
CREATE TABLE "IntSetting" (
    "settingId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ShortTextSetting" (
    "settingId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" VARCHAR(255) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "IntSetting_settingId_name_key" ON "IntSetting"("settingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ShortTextSetting_settingId_name_key" ON "ShortTextSetting"("settingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_listConfigId_key" ON "Setting"("listConfigId");

-- AddForeignKey
ALTER TABLE "IntSetting" ADD CONSTRAINT "IntSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortTextSetting" ADD CONSTRAINT "ShortTextSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BooleanSetting" ADD CONSTRAINT "BooleanSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
