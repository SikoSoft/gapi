/*
  Warnings:

  - You are about to drop the column `actionId` on the `Property` table. All the data in the column will be lost.
  - Added the required column `entityId` to the `Property` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_actionId_fkey";

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "actionId",
ADD COLUMN     "entityId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Entity" (
    "id" SERIAL NOT NULL,
    "desc" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityTag" (
    "entityId" INTEGER NOT NULL DEFAULT 0,
    "label" VARCHAR(128) NOT NULL,

    CONSTRAINT "EntityTag_pkey" PRIMARY KEY ("entityId","label")
);

-- CreateTable
CREATE TABLE "StringProperty" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "string" VARCHAR(255) NOT NULL,

    CONSTRAINT "StringProperty_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EntityTag" ADD CONSTRAINT "EntityTag_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityTag" ADD CONSTRAINT "EntityTag_label_fkey" FOREIGN KEY ("label") REFERENCES "Tag"("label") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StringProperty" ADD CONSTRAINT "StringProperty_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
