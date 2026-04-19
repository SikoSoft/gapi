-- AlterTable
ALTER TABLE "EntityAccessPolicy" ALTER COLUMN "editAccessPolicyId" DROP NOT NULL,
ALTER COLUMN "viewAccessPolicyId" DROP NOT NULL;
