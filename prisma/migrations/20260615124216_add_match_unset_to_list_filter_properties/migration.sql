-- AlterTable
ALTER TABLE "ListFilterBooleanProperty" ADD COLUMN     "matchUnset" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ListFilterDateProperty" ADD COLUMN     "matchUnset" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ListFilterImageProperty" ADD COLUMN     "matchUnset" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ListFilterIntProperty" ADD COLUMN     "matchUnset" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ListFilterLongTextProperty" ADD COLUMN     "matchUnset" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ListFilterShortTextProperty" ADD COLUMN     "matchUnset" BOOLEAN NOT NULL DEFAULT false;
