/*
  Warnings:

  - You are about to drop the `AccessPolicyGroupMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AccessPolicyRule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AccessPolicyGroupMember" DROP CONSTRAINT "AccessPolicyGroupMember_groupId_fkey";

-- DropForeignKey
ALTER TABLE "AccessPolicyRule" DROP CONSTRAINT "AccessPolicyRule_accessPolicyId_fkey";

-- DropTable
DROP TABLE "AccessPolicyGroupMember";

-- DropTable
DROP TABLE "AccessPolicyRule";

-- CreateTable
CREATE TABLE "AccessPolicyParty" (
    "id" SERIAL NOT NULL,
    "accessPolicyId" INTEGER NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "partyId" VARCHAR(128) NOT NULL,

    CONSTRAINT "AccessPolicyParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPolicyGroupUser" (
    "groupId" INTEGER NOT NULL,
    "userId" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyGroupUser_groupId_userId_key" ON "AccessPolicyGroupUser"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "AccessPolicyParty" ADD CONSTRAINT "AccessPolicyParty_accessPolicyId_fkey" FOREIGN KEY ("accessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyGroupUser" ADD CONSTRAINT "AccessPolicyGroupUser_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccessPolicyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
