-- AlterTable
ALTER TABLE "EntityConfig" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiIdentifyPrompt" VARCHAR(255);
