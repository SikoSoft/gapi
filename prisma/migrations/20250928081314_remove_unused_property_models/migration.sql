/*
  Warnings:

  - You are about to drop the `DateProperty` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Property` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StringProperty` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DateProperty" DROP CONSTRAINT "DateProperty_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "StringProperty" DROP CONSTRAINT "StringProperty_propertyId_fkey";

-- DropTable
DROP TABLE "DateProperty";

-- DropTable
DROP TABLE "Property";

-- DropTable
DROP TABLE "StringProperty";
