/*
  Warnings:

  - The primary key for the `BooleanSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `NumberSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `TextSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[settingId,name]` on the table `BooleanSetting` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[settingId,name]` on the table `NumberSetting` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[settingId,name]` on the table `TextSetting` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BooleanSetting" DROP CONSTRAINT "BooleanSetting_pkey";

-- AlterTable
ALTER TABLE "NumberSetting" DROP CONSTRAINT "NumberSetting_pkey";

-- AlterTable
ALTER TABLE "TextSetting" DROP CONSTRAINT "TextSetting_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "BooleanSetting_settingId_name_key" ON "BooleanSetting"("settingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "NumberSetting_settingId_name_key" ON "NumberSetting"("settingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TextSetting_settingId_name_key" ON "TextSetting"("settingId", "name");
