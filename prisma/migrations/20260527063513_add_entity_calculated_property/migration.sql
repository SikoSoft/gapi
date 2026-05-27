-- CreateTable
CREATE TABLE "EntityCalculatedProperty" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EntityCalculatedProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_entitycalculatedprop_entityid_order" ON "EntityCalculatedProperty"("entityId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EntityCalculatedProperty_entityId_propertyConfigId_key" ON "EntityCalculatedProperty"("entityId", "propertyConfigId");

-- AddForeignKey
ALTER TABLE "EntityCalculatedProperty" ADD CONSTRAINT "EntityCalculatedProperty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityCalculatedProperty" ADD CONSTRAINT "EntityCalculatedProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
