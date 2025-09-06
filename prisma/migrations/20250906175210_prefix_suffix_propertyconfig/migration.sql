/*
  Warnings:

  - Added the required column `prefix` to the `PropertyConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `suffix` to the `PropertyConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PropertyConfig" ADD COLUMN     "prefix" VARCHAR(128) NOT NULL,
ADD COLUMN     "suffix" VARCHAR(128) NOT NULL;
