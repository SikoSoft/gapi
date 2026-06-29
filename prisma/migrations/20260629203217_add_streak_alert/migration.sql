-- CreateTable
CREATE TABLE "StreakAlertConfig" (
    "id" SERIAL NOT NULL,
    "streakId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "noticeTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreakAlertConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreakAlert" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "alertConfigId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreakAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreakAlertConfig_userId_idx" ON "StreakAlertConfig"("userId");

-- CreateIndex
CREATE INDEX "StreakAlertConfig_streakId_idx" ON "StreakAlertConfig"("streakId");

-- CreateIndex
CREATE INDEX "StreakAlert_userId_idx" ON "StreakAlert"("userId");

-- CreateIndex
CREATE INDEX "StreakAlert_alertConfigId_idx" ON "StreakAlert"("alertConfigId");

-- AddForeignKey
ALTER TABLE "StreakAlertConfig" ADD CONSTRAINT "StreakAlertConfig_streakId_fkey" FOREIGN KEY ("streakId") REFERENCES "StreakConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreakAlert" ADD CONSTRAINT "StreakAlert_alertConfigId_fkey" FOREIGN KEY ("alertConfigId") REFERENCES "StreakAlertConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
