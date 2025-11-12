/*
  Warnings:

  - The primary key for the `EntityTag` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "EntityTag" DROP CONSTRAINT "EntityTag_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "EntityTag_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "idx_entity_userid_createdat" ON "Entity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_entitybooleanprop_entityid_order" ON "EntityBooleanProperty"("entityId", "order");

-- CreateIndex
CREATE INDEX "idx_entitydateprop_entityid_order" ON "EntityDateProperty"("entityId", "order");

-- CreateIndex
CREATE INDEX "idx_entityimageprop_entityid_order" ON "EntityImageProperty"("entityId", "order");

-- CreateIndex
CREATE INDEX "idx_entityintprop_entityid_order" ON "EntityIntProperty"("entityId", "order");

-- CreateIndex
CREATE INDEX "idx_entitylongtextprop_entityid_order" ON "EntityLongTextProperty"("entityId", "order");

-- CreateIndex
CREATE INDEX "idx_entityshorttextprop_entityid_order" ON "EntityShortTextProperty"("entityId", "order");

-- CreateIndex
CREATE INDEX "idx_entitytag_entityid_label" ON "EntityTag"("entityId", "label");

-- CreateIndex
CREATE INDEX "idx_entitytag_label" ON "EntityTag"("label");
