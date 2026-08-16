-- CreateTable
CREATE TABLE "FloatPropertyValue" (
    "id" SERIAL NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FloatPropertyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyConfigFloatDefaultValue" (
    "propertyValueId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "EntityFloatProperty" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EntityFloatProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionsFloatOption" (
    "id" SERIAL NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OptionsFloatOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterFloatProperty" (
    "id" SERIAL NOT NULL,
    "listConfigId" UUID NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,
    "matchUnset" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ListFilterFloatProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigFloatDefaultValue_propertyValueId_key" ON "PropertyConfigFloatDefaultValue"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigFloatDefaultValue_propertyConfigId_key" ON "PropertyConfigFloatDefaultValue"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityFloatProperty_propertyValueId_key" ON "EntityFloatProperty"("propertyValueId");

-- CreateIndex
CREATE INDEX "idx_entityfloatprop_entityid_order" ON "EntityFloatProperty"("entityId", "order");

-- CreateIndex
CREATE INDEX "idx_optionsfloatoption_propertyconfigid" ON "OptionsFloatOption"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionsFloatOption_propertyConfigId_value_key" ON "OptionsFloatOption"("propertyConfigId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterFloatProperty_propertyValueId_key" ON "ListFilterFloatProperty"("propertyValueId");

-- AddForeignKey
ALTER TABLE "PropertyConfigFloatDefaultValue" ADD CONSTRAINT "PropertyConfigFloatDefaultValue_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigFloatDefaultValue" ADD CONSTRAINT "PropertyConfigFloatDefaultValue_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "FloatPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityFloatProperty" ADD CONSTRAINT "EntityFloatProperty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityFloatProperty" ADD CONSTRAINT "EntityFloatProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "FloatPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityFloatProperty" ADD CONSTRAINT "EntityFloatProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionsFloatOption" ADD CONSTRAINT "OptionsFloatOption_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterFloatProperty" ADD CONSTRAINT "ListFilterFloatProperty_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterFloatProperty" ADD CONSTRAINT "ListFilterFloatProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterFloatProperty" ADD CONSTRAINT "ListFilterFloatProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "FloatPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
