-- DropForeignKey
ALTER TABLE "ListFilterTag" DROP CONSTRAINT "ListFilterTag_listConfigId_fkey";

-- DropForeignKey
ALTER TABLE "ListSort" DROP CONSTRAINT "ListSort_listConfigId_fkey";

-- AddForeignKey
ALTER TABLE "ListSort" ADD CONSTRAINT "ListSort_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListFilterTag" ADD CONSTRAINT "ListFilterTag_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListFilter"("listConfigId") ON DELETE CASCADE ON UPDATE CASCADE;
