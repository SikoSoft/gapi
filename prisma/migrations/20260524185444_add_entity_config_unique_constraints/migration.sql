-- CreateTable
CREATE TABLE "EntityConfigUniqueConstraint" (
    "id" SERIAL NOT NULL,
    "entityConfigId" INTEGER NOT NULL,

    CONSTRAINT "EntityConfigUniqueConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityConfigUniqueConstraintProperty" (
    "constraintId" INTEGER NOT NULL,
    "propertyConfigId" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityConfigUniqueConstraintProperty_constraintId_propertyC_key" ON "EntityConfigUniqueConstraintProperty"("constraintId", "propertyConfigId");

-- AddForeignKey
ALTER TABLE "EntityConfigUniqueConstraint" ADD CONSTRAINT "EntityConfigUniqueConstraint_entityConfigId_fkey" FOREIGN KEY ("entityConfigId") REFERENCES "EntityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityConfigUniqueConstraintProperty" ADD CONSTRAINT "EntityConfigUniqueConstraintProperty_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "EntityConfigUniqueConstraint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityConfigUniqueConstraintProperty" ADD CONSTRAINT "EntityConfigUniqueConstraintProperty_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
