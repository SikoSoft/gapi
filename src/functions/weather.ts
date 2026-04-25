import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { Weather } from "../lib/Weather";

export async function weather(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const result = await Weather.getWeatherForAllLocations();

  if (result.isErr()) {
    context.error(result.error);
    return { status: 500 };
  }

  return jsonReply(result.value);
}

app.http("weather", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: weather,
  route: "weather",
});
