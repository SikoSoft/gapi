-- CreateTable
CREATE TABLE "ListFilterType" (
    "entityConfigId" INTEGER NOT NULL,
    "listConfigId" UUID NOT NULL,

    CONSTRAINT "ListFilterType_pkey" PRIMARY KEY ("entityConfigId")
);

-- AddForeignKey
ALTER TABLE "ListFilterType" ADD CONSTRAINT "ListFilterType_entityConfigId_fkey" FOREIGN KEY ("entityConfigId") REFERENCES "EntityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterType" ADD CONSTRAINT "ListFilterType_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;
