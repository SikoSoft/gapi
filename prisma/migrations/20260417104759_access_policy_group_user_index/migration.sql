-- AddForeignKey
ALTER TABLE "AccessPolicyGroupUser" ADD CONSTRAINT "AccessPolicyGroupUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
