-- CreateTable
CREATE TABLE "MapLocation" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MapLocation_pkey" PRIMARY KEY ("id")
);
