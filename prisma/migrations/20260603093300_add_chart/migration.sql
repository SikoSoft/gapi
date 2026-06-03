-- CreateTable
CREATE TABLE "Chart" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "config" JSONB NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_chart_userid" ON "Chart"("userId");

-- CreateIndex (expression index for scanning version inside config)
CREATE INDEX "idx_chart_version" ON "Chart" (((config->>'version')::int));
