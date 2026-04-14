-- CreateTable
CREATE TABLE "AccessPolicy" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityAccessPolicy" (
    "entityId" INTEGER NOT NULL,
    "accessPolicyId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ListConfigAccessPolicy" (
    "listConfigId" UUID NOT NULL,
    "accessPolicyId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "AccessPolicyRule" (
    "id" SERIAL NOT NULL,
    "accessPolicyId" INTEGER NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "partyId" VARCHAR(128) NOT NULL,

    CONSTRAINT "AccessPolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPolicyGroup" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessPolicyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPolicyGroupMember" (
    "groupId" INTEGER NOT NULL,
    "userId" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityAccessPolicy_entityId_key" ON "EntityAccessPolicy"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ListConfigAccessPolicy_listConfigId_key" ON "ListConfigAccessPolicy"("listConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyGroupMember_groupId_userId_key" ON "AccessPolicyGroupMember"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "EntityAccessPolicy" ADD CONSTRAINT "EntityAccessPolicy_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAccessPolicy" ADD CONSTRAINT "EntityAccessPolicy_accessPolicyId_fkey" FOREIGN KEY ("accessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListConfigAccessPolicy" ADD CONSTRAINT "ListConfigAccessPolicy_listConfigId_fkey" FOREIGN KEY ("listConfigId") REFERENCES "ListConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListConfigAccessPolicy" ADD CONSTRAINT "ListConfigAccessPolicy_accessPolicyId_fkey" FOREIGN KEY ("accessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyRule" ADD CONSTRAINT "AccessPolicyRule_accessPolicyId_fkey" FOREIGN KEY ("accessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyGroupMember" ADD CONSTRAINT "AccessPolicyGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccessPolicyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
