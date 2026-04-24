-- CreateTable
CREATE TABLE "ListFilterBooleanProperty" (
    "id" SERIAL NOT NULL,
    "listConfigId" UUID NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "ListFilterBooleanProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterDateProperty" (
    "id" SERIAL NOT NULL,
    "listConfigId" UUID NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "ListFilterDateProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterImageProperty" (
    "id" SERIAL NOT NULL,
    "listConfigId" UUID NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "ListFilterImageProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterIntProperty" (
    "id" SERIAL NOT NULL,
    "listConfigId" UUID NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "ListFilterIntProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterLongTextProperty" (
    "id" SERIAL NOT NULL,
    "listConfigId" UUID NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "ListFilterLongTextProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListFilterShortTextProperty" (
    "id" SERIAL NOT NULL,
    "listConfigId" UUID NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "ListFilterShortTextProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterBooleanProperty_propertyValueId_key" ON "ListFilterBooleanProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterDateProperty_propertyValueId_key" ON "ListFilterDateProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterImageProperty_propertyValueId_key" ON "ListFilterImageProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterIntProperty_propertyValueId_key" ON "ListFilterIntProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterLongTextProperty_propertyValueId_key" ON "ListFilterLongTextProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "ListFilterShortTextProperty_propertyValueId_key" ON "ListFilterShortTextProperty"("propertyValueId");

-- AddForeignKey
ALTER TABLE "ListFilterBooleanProperty" ADD CONSTRAINT "ListFilterBooleanProperty_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterBooleanProperty" ADD CONSTRAINT "ListFilterBooleanProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterBooleanProperty" ADD CONSTRAINT "ListFilterBooleanProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "BooleanPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterDateProperty" ADD CONSTRAINT "ListFilterDateProperty_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterDateProperty" ADD CONSTRAINT "ListFilterDateProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterDateProperty" ADD CONSTRAINT "ListFilterDateProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "DatePropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterImageProperty" ADD CONSTRAINT "ListFilterImageProperty_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterImageProperty" ADD CONSTRAINT "ListFilterImageProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterImageProperty" ADD CONSTRAINT "ListFilterImageProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "ImagePropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterIntProperty" ADD CONSTRAINT "ListFilterIntProperty_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterIntProperty" ADD CONSTRAINT "ListFilterIntProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterIntProperty" ADD CONSTRAINT "ListFilterIntProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "IntPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterLongTextProperty" ADD CONSTRAINT "ListFilterLongTextProperty_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterLongTextProperty" ADD CONSTRAINT "ListFilterLongTextProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterLongTextProperty" ADD CONSTRAINT "ListFilterLongTextProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "LongTextPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterShortTextProperty" ADD CONSTRAINT "ListFilterShortTextProperty_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterShortTextProperty" ADD CONSTRAINT "ListFilterShortTextProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterShortTextProperty" ADD CONSTRAINT "ListFilterShortTextProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "ShortTextPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
