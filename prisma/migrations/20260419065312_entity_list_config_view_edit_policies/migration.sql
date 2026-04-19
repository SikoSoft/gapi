/*
  Warnings:

  - You are about to drop the column `accessPolicyId` on the `ListConfigAccessPolicy` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ListConfigAccessPolicy" DROP CONSTRAINT "ListConfigAccessPolicy_accessPolicyId_fkey";

-- AlterTable
ALTER TABLE "ListConfigAccessPolicy" DROP COLUMN "accessPolicyId",
ADD COLUMN     "editAccessPolicyId" INTEGER,
ADD COLUMN     "viewAccessPolicyId" INTEGER;

-- AddForeignKey
ALTER TABLE "ListConfigAccessPolicy" ADD CONSTRAINT "ListConfigAccessPolicy_viewAccessPolicyId_fkey" FOREIGN KEY ("viewAccessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListConfigAccessPolicy" ADD CONSTRAINT "ListConfigAccessPolicy_editAccessPolicyId_fkey" FOREIGN KEY ("editAccessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
