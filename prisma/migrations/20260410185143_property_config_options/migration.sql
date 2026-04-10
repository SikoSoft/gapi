-- AlterTable
ALTER TABLE "PropertyConfig" ADD COLUMN     "optionsOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OptionsShortTextOption" (
    "id" SERIAL NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "value" VARCHAR(255) NOT NULL,

    CONSTRAINT "OptionsShortTextOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionsIntOption" (
    "id" SERIAL NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "OptionsIntOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_optionstextoption_propertyconfigid" ON "OptionsShortTextOption"("propertyConfigId");

-- CreateIndex
CREATE INDEX "idx_optionsintoption_propertyconfigid" ON "OptionsIntOption"("propertyConfigId");

-- AddForeignKey
ALTER TABLE "OptionsShortTextOption" ADD CONSTRAINT "OptionsShortTextOption_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionsIntOption" ADD CONSTRAINT "OptionsIntOption_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
