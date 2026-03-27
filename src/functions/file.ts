import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import multipart from "parse-multipart";
import { FileStorage } from "../lib/FileStorage";

export type RequestBody = {};

export async function file(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const rawPath = request.params?.path ?? "";
  const destPath = FileStorage.sanitizePath(rawPath);

  const chunks: Uint8Array[] = [];
  const reader = request.body.getReader();
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

  const boundary = multipart.getBoundary(request.headers.get("content-type"));
  const parts = multipart.Parse(buffer, boundary);
  const filename = parts[0].filename || "upload";
  const blobName = destPath
    ? `${destPath}/${filename}`
    : FileStorage.getBlobName(filename);

  await FileStorage.uploadImage(blobName, parts[0].data, parts[0].type);

  const url = `${process.env.AZURE_STORAGE_URL}/images/${blobName}`;

  return jsonReply({
    url,
  });
}

app.http("file", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: file,
  route: "file/{*path}",
});
