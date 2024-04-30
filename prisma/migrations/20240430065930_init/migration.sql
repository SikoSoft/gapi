-- CreateTable
CREATE TABLE "Action" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "desc" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);
