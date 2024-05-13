/*
  Warnings:

  - Added the required column `userId` to the `Action` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "userId" UUID NOT NULL;
