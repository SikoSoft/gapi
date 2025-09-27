-- DropForeignKey
ALTER TABLE "EntityConfig" DROP CONSTRAINT "EntityConfig_revisionOf_fkey";

-- AlterTable
ALTER TABLE "EntityConfig" ALTER COLUMN "revisionOf" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "EntityConfig" ADD CONSTRAINT "EntityConfig_revisionOf_fkey" FOREIGN KEY ("revisionOf") REFERENCES "EntityConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
