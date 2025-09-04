/*
  Warnings:

  - The primary key for the `EntityConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `EntityConfig` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `PropertyConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `PropertyConfig` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `entityConfigId` column on the `PropertyConfig` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "PropertyConfig" DROP CONSTRAINT "PropertyConfig_entityConfigId_fkey";

-- AlterTable
ALTER TABLE "EntityConfig" DROP CONSTRAINT "EntityConfig_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "EntityConfig_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PropertyConfig" DROP CONSTRAINT "PropertyConfig_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "entityConfigId",
ADD COLUMN     "entityConfigId" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "PropertyConfig_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "EntityConfig_id_name_key" ON "EntityConfig"("id", "name");

-- AddForeignKey
ALTER TABLE "PropertyConfig" ADD CONSTRAINT "PropertyConfig_entityConfigId_fkey" FOREIGN KEY ("entityConfigId") REFERENCES "EntityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
