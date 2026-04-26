import { app, InvocationContext, Timer } from "@azure/functions";
import { Weather } from "../lib/Weather";

export async function weatherForecast(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("Weather forecast timer triggered");

  const result = await Weather.saveAllForecasts();

  if (result.isErr()) {
    context.error("Failed to save weather forecasts:", result.error);
    return;
  }

  context.log("Weather forecasts saved successfully");
}

app.timer("weatherForecast", {
  schedule: "0 0 0,6,12,18 * * *",
  handler: weatherForecast,
});
