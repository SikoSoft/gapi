-- CreateTable
CREATE TABLE "BooleanPropertyValue" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "value" BOOLEAN NOT NULL,

    CONSTRAINT "BooleanPropertyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagePropertyValue" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT NOT NULL,

    CONSTRAINT "ImagePropertyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntPropertyValue" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "IntPropertyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LongTextPropertyValue" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "LongTextPropertyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortTextPropertyValue" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ShortTextPropertyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyConfigBooleanDefaultValue" (
    "propertyValueId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "PropertyConfigImageDefaultValue" (
    "propertyValueId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "PropertyConfigIntDefaultValue" (
    "propertyValueId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "PropertyConfigLongTextDefaultValue" (
    "propertyValueId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "PropertyConfigShortTextDefaultValue" (
    "propertyValueId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigBooleanDefaultValue_propertyValueId_key" ON "PropertyConfigBooleanDefaultValue"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigBooleanDefaultValue_propertyConfigId_key" ON "PropertyConfigBooleanDefaultValue"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigImageDefaultValue_propertyValueId_key" ON "PropertyConfigImageDefaultValue"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigImageDefaultValue_propertyConfigId_key" ON "PropertyConfigImageDefaultValue"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigIntDefaultValue_propertyValueId_key" ON "PropertyConfigIntDefaultValue"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigIntDefaultValue_propertyConfigId_key" ON "PropertyConfigIntDefaultValue"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigLongTextDefaultValue_propertyValueId_key" ON "PropertyConfigLongTextDefaultValue"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigLongTextDefaultValue_propertyConfigId_key" ON "PropertyConfigLongTextDefaultValue"("propertyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigShortTextDefaultValue_propertyValueId_key" ON "PropertyConfigShortTextDefaultValue"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyConfigShortTextDefaultValue_propertyConfigId_key" ON "PropertyConfigShortTextDefaultValue"("propertyConfigId");

-- AddForeignKey
ALTER TABLE "BooleanPropertyValue" ADD CONSTRAINT "BooleanPropertyValue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagePropertyValue" ADD CONSTRAINT "ImagePropertyValue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntPropertyValue" ADD CONSTRAINT "IntPropertyValue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LongTextPropertyValue" ADD CONSTRAINT "LongTextPropertyValue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortTextPropertyValue" ADD CONSTRAINT "ShortTextPropertyValue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigBooleanDefaultValue" ADD CONSTRAINT "PropertyConfigBooleanDefaultValue_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigBooleanDefaultValue" ADD CONSTRAINT "PropertyConfigBooleanDefaultValue_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "BooleanPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigImageDefaultValue" ADD CONSTRAINT "PropertyConfigImageDefaultValue_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigImageDefaultValue" ADD CONSTRAINT "PropertyConfigImageDefaultValue_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "ImagePropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigIntDefaultValue" ADD CONSTRAINT "PropertyConfigIntDefaultValue_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigIntDefaultValue" ADD CONSTRAINT "PropertyConfigIntDefaultValue_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "IntPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigLongTextDefaultValue" ADD CONSTRAINT "PropertyConfigLongTextDefaultValue_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigLongTextDefaultValue" ADD CONSTRAINT "PropertyConfigLongTextDefaultValue_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "LongTextPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigShortTextDefaultValue" ADD CONSTRAINT "PropertyConfigShortTextDefaultValue_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyConfigShortTextDefaultValue" ADD CONSTRAINT "PropertyConfigShortTextDefaultValue_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "ShortTextPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
