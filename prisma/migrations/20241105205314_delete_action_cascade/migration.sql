-- DropForeignKey
ALTER TABLE "ActionTag" DROP CONSTRAINT "ActionTag_actionId_fkey";

-- DropForeignKey
ALTER TABLE "ActionTag" DROP CONSTRAINT "ActionTag_label_fkey";

-- AddForeignKey
ALTER TABLE "ActionTag" ADD CONSTRAINT "ActionTag_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTag" ADD CONSTRAINT "ActionTag_label_fkey" FOREIGN KEY ("label") REFERENCES "Tag"("label") ON DELETE CASCADE ON UPDATE CASCADE;
