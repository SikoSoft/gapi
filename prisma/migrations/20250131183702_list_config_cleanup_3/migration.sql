/*
  Warnings:

  - The primary key for the `ListFilterTime` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ListFilterTime` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ListFilterTime" DROP CONSTRAINT "ListFilterTime_pkey",
DROP COLUMN "id",
ADD COLUMN     "date1" TIMESTAMP(3),
ADD COLUMN     "date2" TIMESTAMP(3);
