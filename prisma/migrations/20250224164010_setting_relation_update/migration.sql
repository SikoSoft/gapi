/*
  Warnings:

  - The primary key for the `BooleanSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `listConfigId` on the `BooleanSetting` table. All the data in the column will be lost.
  - The primary key for the `NumberSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `listConfigId` on the `NumberSetting` table. All the data in the column will be lost.
  - The primary key for the `TextSetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `listConfigId` on the `TextSetting` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id]` on the table `Setting` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `settingId` to the `BooleanSetting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `settingId` to the `NumberSetting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id` to the `Setting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `settingId` to the `TextSetting` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BooleanSetting" DROP CONSTRAINT "BooleanSetting_listConfigId_fkey";

-- DropForeignKey
ALTER TABLE "NumberSetting" DROP CONSTRAINT "NumberSetting_listConfigId_fkey";

-- DropForeignKey
ALTER TABLE "TextSetting" DROP CONSTRAINT "TextSetting_listConfigId_fkey";

-- AlterTable
ALTER TABLE "BooleanSetting" DROP CONSTRAINT "BooleanSetting_pkey",
DROP COLUMN "listConfigId",
ADD COLUMN     "settingId" UUID NOT NULL,
ADD CONSTRAINT "BooleanSetting_pkey" PRIMARY KEY ("settingId");

-- AlterTable
ALTER TABLE "NumberSetting" DROP CONSTRAINT "NumberSetting_pkey",
DROP COLUMN "listConfigId",
ADD COLUMN     "settingId" UUID NOT NULL,
ADD CONSTRAINT "NumberSetting_pkey" PRIMARY KEY ("settingId");

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "TextSetting" DROP CONSTRAINT "TextSetting_pkey",
DROP COLUMN "listConfigId",
ADD COLUMN     "settingId" UUID NOT NULL,
ADD CONSTRAINT "TextSetting_pkey" PRIMARY KEY ("settingId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_id_key" ON "Setting"("id");

-- AddForeignKey
ALTER TABLE "BooleanSetting" ADD CONSTRAINT "BooleanSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSetting" ADD CONSTRAINT "NumberSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextSetting" ADD CONSTRAINT "TextSetting_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
