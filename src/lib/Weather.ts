import { err, ok, Result } from "neverthrow";
import { prisma } from "..";
import {
  SmhiWeatherData,
  AllLocationsWeather,
  LocationWeather,
} from "../models/Weather";

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
