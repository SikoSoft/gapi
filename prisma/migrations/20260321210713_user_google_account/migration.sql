-- CreateTable
CREATE TABLE "UserGoogleAccount" (
    "userId" UUID NOT NULL,
    "googleId" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGoogleAccount_userId_googleId_key" ON "UserGoogleAccount"("userId", "googleId");

-- AddForeignKey
ALTER TABLE "UserGoogleAccount" ADD CONSTRAINT "UserGoogleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
