-- AlterTable
ALTER TABLE "EntityBooleanProperty" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EntityImageProperty" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EntityIntProperty" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EntityLongTextProperty" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EntityShortTextProperty" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;
