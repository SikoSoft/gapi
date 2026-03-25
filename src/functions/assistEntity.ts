import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect } from "..";

export async function file(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const upstreamBaseUrl = process.env.ASSIST_API_BASE_URL;
  if (!upstreamBaseUrl) {
    return {
      status: 500,
      body: "Missing ASSIST_API_BASE_URL environment variable",
    };
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return {
      status: 400,
      body: "Invalid content-type",
    };
  }

  const upstreamUrl = new URL("/assist/entity", upstreamBaseUrl);

  const forwardedHeaders = new Headers();
  const preserveHeaders = [
    "authorization",
    "content-type",
    "content-length",
    "accept",
    "user-agent",
    "x-request-id",
    "x-correlation-id",
  ];

  for (const name of preserveHeaders) {
    const value = request.headers.get(name);
    if (value) {
      forwardedHeaders.set(name, value);
    }
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body: request.body,
    duplex: "half",
  } as RequestInit);

  return {
    status: upstreamResponse.status,
    headers: Object.fromEntries(upstreamResponse.headers.entries()),
    body: await upstreamResponse.text(),
  };
}

app.http("assistEntity", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: file,
  route: "assist/entity",
});
