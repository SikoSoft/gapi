-- CreateTable
CREATE TABLE "FactFormatter" (
    "id" SERIAL NOT NULL,
    "factConfigId" INTEGER NOT NULL,
    "formatterId" VARCHAR(128) NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "FactFormatter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FactFormatter" ADD CONSTRAINT "FactFormatter_factConfigId_fkey" FOREIGN KEY ("factConfigId") REFERENCES "FactConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
