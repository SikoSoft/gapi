import { err, ok, Result } from "neverthrow";
import { prisma } from "..";
import {
  SmhiWeatherData,
  SmhiTimeSeries,
  AllLocationsWeather,
  LocationWeather,
} from "../models/Weather";

const FORECAST_HOURS = [0, 6, 12, 18];
const FORECAST_WINDOW_DAYS = 7;
const SIX_HOUR_MS = 6 * 60 * 60 * 1000;

export class Weather {
  static async getWeatherForLocation(
    latitude: number,
    longitude: number
  ): Promise<Result<SmhiWeatherData, Error>> {
    const baseUrl = process.env.SMHI_API_SERVER_URL;
    if (!baseUrl) {
      return err(new Error("SMHI_API_SERVER_URL is not configured"));
    }

    const url = `${baseUrl}/api/category/snow1g/version/1/geotype/point/lon/${longitude}/lat/${latitude}/data.json`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return err(
          new Error(`SMHI API returned status ${response.status} for ${url}`)
        );
      }
      const data = (await response.json()) as SmhiWeatherData;
      return ok(data);
    } catch (error) {
      return err(
        new Error(`Failed to fetch weather data: ${error}`, { cause: error })
      );
    }
  }

  static isSixHourInterval(entry: SmhiTimeSeries): boolean {
    const intervalMs =
      new Date(entry.time).getTime() -
      new Date(entry.intervalParametersStartTime).getTime();
    return intervalMs === SIX_HOUR_MS;
  }

  static async saveWeatherForecast(
    locationId: number,
    forecastTime: Date,
    temperature: number,
    precipitation: number,
    windDirection: number,
    windSpeed: number,
    windGust: number,
    humidity: number
  ): Promise<Result<null, Error>> {
    try {
      await prisma.weatherForecast.create({
        data: {
          locationId,
          forecastTime,
          temperature,
          precipitation,
          windDirection,
          windSpeed,
          windGust,
          humidity,
        },
      });
      return ok(null);
    } catch (error) {
      return err(new Error("Failed to save weather forecast", { cause: error }));
    }
  }

  static async saveAllForecasts(): Promise<Result<null, Error>> {
    try {
      const locationsResult = await Weather.getWeatherForAllLocations();
      if (locationsResult.isErr()) {
        return err(locationsResult.error);
      }

      const now = new Date();
      const cutoff = new Date(
        now.getTime() + FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );

      for (const location of locationsResult.value.locations) {
        if (!location.weather) {
          continue;
        }

        for (const entry of location.weather.timeSeries) {
          const forecastTime = new Date(entry.time);

          if (forecastTime > cutoff) {
            continue;
          }

          const hour = forecastTime.getUTCHours();
          if (!FORECAST_HOURS.includes(hour)) {
            continue;
          }

          const sixHour = Weather.isSixHourInterval(entry);
          const rawPrecipitation =
            entry.data.precipitation_amount_mean_deterministic;

          const saveResult = await Weather.saveWeatherForecast(
            location.id,
            forecastTime,
            entry.data.air_temperature,
            sixHour ? rawPrecipitation / 6 : rawPrecipitation,
            entry.data.wind_from_direction,
            entry.data.wind_speed,
            entry.data.wind_speed_of_gust,
            entry.data.relative_humidity
          );

          if (saveResult.isErr()) {
            return err(saveResult.error);
          }
        }
      }

      return ok(null);
    } catch (error) {
      return err(new Error("Failed to save all forecasts", { cause: error }));
    }
  }

  static async getWeatherForAllLocations(): Promise<
    Result<AllLocationsWeather, Error>
  > {
    try {
      const locations = await prisma.mapLocation.findMany();

      const results = await Promise.all(
        locations.map(async (location): Promise<LocationWeather> => {
          const weatherResult = await Weather.getWeatherForLocation(
            location.latitude,
            location.longitude
          );

          if (weatherResult.isErr()) {
            return {
              id: location.id,
              name: location.name,
              latitude: location.latitude,
              longitude: location.longitude,
              weather: null,
              error: weatherResult.error.message,
            };
          }

          return {
            id: location.id,
            name: location.name,
            latitude: location.latitude,
            longitude: location.longitude,
            weather: weatherResult.value,
          };
        })
      );

      return ok({ locations: results });
    } catch (error) {
      return err(
        new Error("Failed to retrieve map locations", { cause: error })
      );
    }
  }
}
