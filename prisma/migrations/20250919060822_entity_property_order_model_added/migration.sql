/*
  Warnings:

  - A unique constraint covering the columns `[entityConfigId,id]` on the table `PropertyConfig` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "EntityPropertyOrder" (
    "entityConfigId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityPropertyOrder_propertyConfigId_key" ON "EntityPropertyOrder"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityPropertyOrder_entityConfigId_propertyConfigId_key" ON "EntityPropertyOrder"("entityConfigId", "propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfig_entityConfigId_id_key" ON "PropertyConfig"("entityConfigId", "id");

-- AddForeignKey
ALTER TABLE "EntityPropertyOrder" ADD CONSTRAINT "EntityPropertyOrder_entityConfigId_fkey" FOREIGN KEY ("entityConfigId") REFERENCES "EntityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityPropertyOrder" ADD CONSTRAINT "EntityPropertyOrder_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
