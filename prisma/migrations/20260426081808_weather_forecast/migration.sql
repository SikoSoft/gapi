-- CreateTable
CREATE TABLE "WeatherForecast" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "snapshotTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forecastTime" TIMESTAMP(3) NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "precipitation" DOUBLE PRECISION NOT NULL,
    "windDirection" DOUBLE PRECISION NOT NULL,
    "windSpeed" DOUBLE PRECISION NOT NULL,
    "windGust" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WeatherForecast_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeatherForecast" ADD CONSTRAINT "WeatherForecast_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "MapLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
