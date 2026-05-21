-- CreateTable
CREATE TABLE "MedalConfig" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "series" VARCHAR(255) NOT NULL,
    "recurrence" INTEGER NOT NULL DEFAULT 0,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "icon" VARCHAR(255) NOT NULL,
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medal" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "medalConfigId" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Medal" ADD CONSTRAINT "Medal_medalConfigId_fkey" FOREIGN KEY ("medalConfigId") REFERENCES "MedalConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
