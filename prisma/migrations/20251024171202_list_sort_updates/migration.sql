-- AlterTable
ALTER TABLE "ListSort" ADD COLUMN     "dataType" VARCHAR(64),
ADD COLUMN     "propertyId" INTEGER DEFAULT 0,
ALTER COLUMN "property" DROP NOT NULL;
