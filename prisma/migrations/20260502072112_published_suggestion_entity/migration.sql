-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestion" BOOLEAN NOT NULL DEFAULT false;
