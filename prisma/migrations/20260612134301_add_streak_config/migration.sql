-- CreateTable
CREATE TABLE "StreakConfig" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "context" JSONB NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreakConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreakConfig_userId_idx" ON "StreakConfig"("userId");
