/*
  Warnings:

  - You are about to drop the `ToggleSetting` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ToggleSetting" DROP CONSTRAINT "ToggleSetting_listConfigId_fkey";

-- DropTable
DROP TABLE "ToggleSetting";

-- CreateTable
CREATE TABLE "BooleanSetting" (
    "listConfigId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "value" BOOLEAN NOT NULL,

    CONSTRAINT "BooleanSetting_pkey" PRIMARY KEY ("listConfigId")
);

-- AddForeignKey
ALTER TABLE "BooleanSetting" ADD CONSTRAINT "BooleanSetting_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "Setting"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;
