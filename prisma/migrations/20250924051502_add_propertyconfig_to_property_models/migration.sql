/*
  Warnings:

  - Added the required column `propertyConfigId` to the `EntityBooleanProperty` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyConfigId` to the `EntityImageProperty` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyConfigId` to the `EntityIntProperty` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyConfigId` to the `EntityLongTextProperty` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyConfigId` to the `EntityShortTextProperty` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EntityBooleanProperty" ADD COLUMN     "propertyConfigId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "EntityImageProperty" ADD COLUMN     "propertyConfigId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "EntityIntProperty" ADD COLUMN     "propertyConfigId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "EntityLongTextProperty" ADD COLUMN     "propertyConfigId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "EntityShortTextProperty" ADD COLUMN     "propertyConfigId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "EntityBooleanProperty" ADD CONSTRAINT "EntityBooleanProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityImageProperty" ADD CONSTRAINT "EntityImageProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityIntProperty" ADD CONSTRAINT "EntityIntProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLongTextProperty" ADD CONSTRAINT "EntityLongTextProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityShortTextProperty" ADD CONSTRAINT "EntityShortTextProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
