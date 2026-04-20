-- Add new FK columns
ALTER TABLE "AccessPolicyParty" ADD COLUMN "userId" UUID;
ALTER TABLE "AccessPolicyParty" ADD COLUMN "groupId" INTEGER;

-- Migrate existing data
UPDATE "AccessPolicyParty" SET "userId" = "partyId"::uuid WHERE "type" = 'user';
UPDATE "AccessPolicyParty" SET "groupId" = "partyId"::integer WHERE "type" = 'group';

-- Drop old column
ALTER TABLE "AccessPolicyParty" DROP COLUMN "partyId";

-- Add FK constraints
ALTER TABLE "AccessPolicyParty" ADD CONSTRAINT "AccessPolicyParty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessPolicyParty" ADD CONSTRAINT "AccessPolicyParty_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AccessPolicyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
