/*
  Warnings:

  - Added the required column `entityConfigId` to the `Entity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "entityConfigId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_entityConfigId_fkey" FOREIGN KEY ("entityConfigId") REFERENCES "EntityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
