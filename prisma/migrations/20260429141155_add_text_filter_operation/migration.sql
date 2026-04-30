-- AlterTable
ALTER TABLE "ListFilterLongTextProperty" ADD COLUMN     "operation" TEXT NOT NULL DEFAULT 'contains';

-- AlterTable
ALTER TABLE "ListFilterShortTextProperty" ADD COLUMN     "operation" TEXT NOT NULL DEFAULT 'contains';
