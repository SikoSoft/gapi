-- CreateTable
CREATE TABLE "UserTotpSecret" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTotpSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingMfaSession" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "token" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingMfaSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaAttempt" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfaAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTotpSecret_userId_key" ON "UserTotpSecret"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingMfaSession_token_key" ON "PendingMfaSession"("token");

-- AddForeignKey
ALTER TABLE "UserTotpSecret" ADD CONSTRAINT "UserTotpSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingMfaSession" ADD CONSTRAINT "PendingMfaSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaAttempt" ADD CONSTRAINT "MfaAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
