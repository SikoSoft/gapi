import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect } from "..";
import { FileStorage } from "../lib/FileStorage";
import multipart from "parse-multipart";

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

  const rawPath = request.params?.path ?? "";
  const destPath = FileStorage.sanitizePath(rawPath);

  if (!request.body) {
    return {
      status: 400,
      body: "Missing request body",
    };
  }

  const timeZone = request.query.get("timeZone") || 0;

  const [uploadBody, forwardedBody] = request.body.tee();

  const chunks: Uint8Array[] = [];
  const reader = uploadBody.getReader();
  let result = await reader.read();
  while (!result.done) {
    chunks.push(result.value);
    result = await reader.read();
  }
  const buffer = Buffer.concat(chunks);

  if (request.headers.has("content-type")) {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return {
        status: 400,
        body: "Invalid content-type",
      };
    }
  }

  let url = "";

  if (request.query.get("saveImage") === "1") {
    const boundary = multipart.getBoundary(request.headers.get("content-type"));
    const parts = multipart.Parse(buffer, boundary);
    const filename = parts[0].filename || "upload";
    const blobName = destPath
      ? `${destPath}/${filename}`
      : FileStorage.getBlobName(filename);

    await FileStorage.uploadImage(blobName, parts[0].data, parts[0].type);
    url = `${process.env.AZURE_STORAGE_URL}/images/${blobName}`;
  }
  const upstreamUrl = new URL("/assist/entity", upstreamBaseUrl);
  if (url) {
    upstreamUrl.searchParams.set("url", url);
  }
  upstreamUrl.searchParams.set("timeZone", timeZone.toString());

  console.log("url", url);

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body: forwardedBody,
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
