/*
  Warnings:

  - You are about to drop the `front_end_log` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "front_end_log";

-- CreateTable
CREATE TABLE "FrontEndLog" (
    "id" UUID NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "source" TEXT,
    "lineno" INTEGER,
    "colno" INTEGER,
    "url" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrontEndLog_pkey" PRIMARY KEY ("id")
);
