-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_entityId_fkey";

-- CreateTable
CREATE TABLE "EntityBooleanProperty" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "EntityBooleanProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityImageProperty" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "EntityImageProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityIntProperty" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "EntityIntProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityLongTextProperty" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "EntityLongTextProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityShortTextProperty" (
    "id" SERIAL NOT NULL,
    "entityId" INTEGER NOT NULL,
    "propertyValueId" INTEGER NOT NULL,

    CONSTRAINT "EntityShortTextProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityBooleanProperty_propertyValueId_key" ON "EntityBooleanProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityImageProperty_propertyValueId_key" ON "EntityImageProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityIntProperty_propertyValueId_key" ON "EntityIntProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityLongTextProperty_propertyValueId_key" ON "EntityLongTextProperty"("propertyValueId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityShortTextProperty_propertyValueId_key" ON "EntityShortTextProperty"("propertyValueId");

-- AddForeignKey
ALTER TABLE "EntityBooleanProperty" ADD CONSTRAINT "EntityBooleanProperty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityBooleanProperty" ADD CONSTRAINT "EntityBooleanProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "BooleanPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityImageProperty" ADD CONSTRAINT "EntityImageProperty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityImageProperty" ADD CONSTRAINT "EntityImageProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "ImagePropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityIntProperty" ADD CONSTRAINT "EntityIntProperty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityIntProperty" ADD CONSTRAINT "EntityIntProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "IntPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLongTextProperty" ADD CONSTRAINT "EntityLongTextProperty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLongTextProperty" ADD CONSTRAINT "EntityLongTextProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "LongTextPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityShortTextProperty" ADD CONSTRAINT "EntityShortTextProperty_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityShortTextProperty" ADD CONSTRAINT "EntityShortTextProperty_propertyValueId_fkey" FOREIGN KEY ("propertyValueId") REFERENCES "ShortTextPropertyValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
