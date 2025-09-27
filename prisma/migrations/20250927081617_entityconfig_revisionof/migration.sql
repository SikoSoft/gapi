/*
  Warnings:

  - Added the required column `revisionOf` to the `EntityConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EntityConfig" ADD COLUMN     "revisionOf" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "EntityConfig" ADD CONSTRAINT "EntityConfig_revisionOf_fkey" FOREIGN KEY ("revisionOf") REFERENCES "EntityConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
