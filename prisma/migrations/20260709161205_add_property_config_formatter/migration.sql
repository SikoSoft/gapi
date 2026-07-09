-- CreateTable
CREATE TABLE "PropertyConfigFormatter" (
    "id" SERIAL NOT NULL,
    "propertyConfigId" INTEGER NOT NULL,
    "formatterId" VARCHAR(128) NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "PropertyConfigFormatter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PropertyConfigFormatter" ADD CONSTRAINT "PropertyConfigFormatter_propertyConfigId_fkey" FOREIGN KEY ("propertyConfigId") REFERENCES "PropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
