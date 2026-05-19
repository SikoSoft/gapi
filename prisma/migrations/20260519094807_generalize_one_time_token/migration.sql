-- CreateEnum
CREATE TYPE "OneTimeTokenScope" AS ENUM ('accountCreate', 'suggestionAccept');

-- AlterTable
ALTER TABLE "OneTimeToken" ADD COLUMN     "entityId" INTEGER,
ADD COLUMN     "scope" "OneTimeTokenScope" NOT NULL DEFAULT 'accountCreate';
