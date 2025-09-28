-- CreateTable
CREATE TABLE "DatePropertyValue" (
    "id" SERIAL NOT NULL,
    "value" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatePropertyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyConfigDateDefaultValue" (
    "propertyValueId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "EntityDateProperty" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EntityDateProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigDateDefaultValue_propertyValueId_key" ON "PropertyConfigDateDefaultValue"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigDateDefaultValue_propertyConfigId_key" ON "PropertyConfigDateDefaultValue"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityDateProperty_propertyValueId_key" ON "EntityDateProperty"("propertyValueId");

-- AddForeignKey
ALTER TABLE "PropertyConfigDateDefaultValue" ADD CONSTRAINT "PropertyConfigDateDefaultValue_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigDateDefaultValue" ADD CONSTRAINT "PropertyConfigDateDefaultValue_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "DatePropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityDateProperty" ADD CONSTRAINT "EntityDateProperty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityDateProperty" ADD CONSTRAINT "EntityDateProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "DatePropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityDateProperty" ADD CONSTRAINT "EntityDateProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
