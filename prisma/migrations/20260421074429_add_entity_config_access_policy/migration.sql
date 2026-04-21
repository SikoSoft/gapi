-- CreateTable
CREATE TABLE "EntityConfigAccessPolicy" (
    "entityConfigId" INTEGER NOT NULL,
    "viewAccessPolicyId" INTEGER,
    "editAccessPolicyId" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityConfigAccessPolicy_entityConfigId_key" ON "EntityConfigAccessPolicy"("entityConfigId");

-- AddForeignKey
ALTER TABLE "EntityConfigAccessPolicy" ADD CONSTRAINT "EntityConfigAccessPolicy_entityConfigId_fkey" FOREIGN KEY ("entityConfigId") REFERENCES "EntityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityConfigAccessPolicy" ADD CONSTRAINT "EntityConfigAccessPolicy_viewAccessPolicyId_fkey" FOREIGN KEY ("viewAccessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityConfigAccessPolicy" ADD CONSTRAINT "EntityConfigAccessPolicy_editAccessPolicyId_fkey" FOREIGN KEY ("editAccessPolicyId") REFERENCES "AccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
