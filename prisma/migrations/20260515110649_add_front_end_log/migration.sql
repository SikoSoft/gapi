-- CreateTable
CREATE TABLE "front_end_log" (
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

    CONSTRAINT "front_end_log_pkey" PRIMARY KEY ("id")
);
