/*
  Warnings:

  - You are about to drop the `EntityPropertyOrder` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EntityPropertyOrder" DROP CONSTRAINT "EntityPropertyOrder_entityConfigId_fkey";

-- DropForeignKey
ALTER TABLE "EntityPropertyOrder" DROP CONSTRAINT "EntityPropertyOrder_propertyConfigId_fkey";

-- DropTable
DROP TABLE "EntityPropertyOrder";

-- CreateTable
CREATE TABLE "EntityPropertyConfigOrder" (
    "entityConfigId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityPropertyConfigOrder_propertyConfigId_key" ON "EntityPropertyConfigOrder"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityPropertyConfigOrder_entityConfigId_propertyConfigId_key" ON "EntityPropertyConfigOrder"("entityConfigId", "propertyConfigId");

-- AddForeignKey
ALTER TABLE "EntityPropertyConfigOrder" ADD CONSTRAINT "EntityPropertyConfigOrder_entityConfigId_fkey" FOREIGN KEY ("entityConfigId") REFERENCES "EntityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityPropertyConfigOrder" ADD CONSTRAINT "EntityPropertyConfigOrder_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
