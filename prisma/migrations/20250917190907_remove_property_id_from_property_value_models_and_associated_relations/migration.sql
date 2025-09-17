/*
  Warnings:

  - You are about to drop the column `propertyId` on the `BooleanPropertyValue` table. All the data in the column will be lost.
  - You are about to drop the column `propertyId` on the `ImagePropertyValue` table. All the data in the column will be lost.
  - You are about to drop the column `propertyId` on the `IntPropertyValue` table. All the data in the column will be lost.
  - You are about to drop the column `propertyId` on the `LongTextPropertyValue` table. All the data in the column will be lost.
  - You are about to drop the column `propertyId` on the `ShortTextPropertyValue` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "BooleanPropertyValue" DROP CONSTRAINT "BooleanPropertyValue_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "ImagePropertyValue" DROP CONSTRAINT "ImagePropertyValue_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "IntPropertyValue" DROP CONSTRAINT "IntPropertyValue_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "LongTextPropertyValue" DROP CONSTRAINT "LongTextPropertyValue_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "ShortTextPropertyValue" DROP CONSTRAINT "ShortTextPropertyValue_propertyId_fkey";

-- AlterTable
ALTER TABLE "BooleanPropertyValue" DROP COLUMN "propertyId";

-- AlterTable
ALTER TABLE "ImagePropertyValue" DROP COLUMN "propertyId";

-- AlterTable
ALTER TABLE "IntPropertyValue" DROP COLUMN "propertyId";

-- AlterTable
ALTER TABLE "LongTextPropertyValue" DROP COLUMN "propertyId";

-- AlterTable
ALTER TABLE "ShortTextPropertyValue" DROP COLUMN "propertyId";
