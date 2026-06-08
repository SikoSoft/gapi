-- AlterTable
ALTER TABLE "MedalConfig" ADD COLUMN     "streakRequests" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "AnalysisClassificationResult" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "analysisType" VARCHAR(100) NOT NULL,
    "segmentUnit" VARCHAR(20) NOT NULL,
    "segmentKey" VARCHAR(20) NOT NULL,
    "value" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisClassificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisClassificationResult_userId_analysisType_segmentUni_idx" ON "AnalysisClassificationResult"("userId", "analysisType", "segmentUnit");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisClassificationResult_userId_analysisType_segmentUni_key" ON "AnalysisClassificationResult"("userId", "analysisType", "segmentUnit", "segmentKey");
