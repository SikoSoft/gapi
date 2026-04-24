import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function assistHealth(
  _request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const upstreamBaseUrl = process.env.ASSIST_API_BASE_URL;
  if (!upstreamBaseUrl) {
    return {
      status: 500,
      body: "Missing ASSIST_API_BASE_URL environment variable",
    };
  }

  const upstreamUrl = new URL("/health", upstreamBaseUrl);

  const upstreamResponse = await fetch(upstreamUrl);

  return {
    status: upstreamResponse.status,
    headers: Object.fromEntries(upstreamResponse.headers.entries()),
    body: await upstreamResponse.text(),
  };
}

app.http("assistHealth", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: assistHealth,
  route: "assist/health",
});
