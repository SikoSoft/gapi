/*
  Warnings:

  - You are about to drop the column `accessPolicyId` on the `EntityAccessPolicy` table. All the data in the column will be lost.
  - Added the required column `editAccessPolicyId` to the `EntityAccessPolicy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `viewAccessPolicyId` to the `EntityAccessPolicy` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "EntityAccessPolicy" DROP CONSTRAINT "EntityAccessPolicy_accessPolicyId_fkey";

-- AlterTable
ALTER TABLE "EntityAccessPolicy" DROP COLUMN "accessPolicyId",
ADD COLUMN     "editAccessPolicyId" INTEGER NOT NULL,
ADD COLUMN     "viewAccessPolicyId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "EntityAccessPolicy" ADD CONSTRAINT "EntityAccessPolicy_viewAccessPolicyId_fkey" FOREIGN KEY ("viewAccessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAccessPolicy" ADD CONSTRAINT "EntityAccessPolicy_editAccessPolicyId_fkey" FOREIGN KEY ("editAccessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
