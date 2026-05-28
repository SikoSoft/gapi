-- CreateTable
CREATE TABLE "FactCache" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "contextKey" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactCache_expiresAt_idx" ON "FactCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FactCache_userId_contextKey_key" ON "FactCache"("userId", "contextKey");
