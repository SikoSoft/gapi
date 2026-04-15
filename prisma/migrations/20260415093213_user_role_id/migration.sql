-- AlterTable
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "role");

-- DropIndex
DROP INDEX "UserRole_userId_role_key";
