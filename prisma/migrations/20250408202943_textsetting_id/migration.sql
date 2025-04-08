/*
  Warnings:

  - The primary key for the `TextSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "TextSetting" DROP CONSTRAINT "TextSetting_pkey",
ADD CONSTRAINT "TextSetting_pkey" PRIMARY KEY ("settingId", "name");
