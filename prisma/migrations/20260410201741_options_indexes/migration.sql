/*
  Warnings:

  - A unique constraint covering the columns `[propertyConfigId,value]` on the table `OptionsIntOption` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[propertyConfigId,value]` on the table `OptionsShortTextOption` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "OptionsIntOption_propertyConfigId_value_key" ON "OptionsIntOption"("propertyConfigId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "OptionsShortTextOption_propertyConfigId_value_key" ON "OptionsShortTextOption"("propertyConfigId", "value");
