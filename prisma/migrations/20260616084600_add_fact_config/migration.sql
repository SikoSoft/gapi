-- CreateTable
CREATE TABLE "FactConfig" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "context" JSONB NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactConfig_userId_idx" ON "FactConfig"("userId");
