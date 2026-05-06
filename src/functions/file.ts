import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
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

  const formDataResponse = new Response(buffer, {
    headers: { "content-type": request.headers.get("content-type") || "" },
  });
  const formData = await formDataResponse.formData();
  const firstEntry = [...formData.entries()][0]?.[1];
  const filename =
    (firstEntry instanceof File ? firstEntry.name : "") || "upload";
  const blobName = destPath
    ? `${destPath}/${filename}`
    : FileStorage.getBlobName(filename);
  const fileData =
    firstEntry instanceof File
      ? Buffer.from(await firstEntry.arrayBuffer())
      : Buffer.alloc(0);
  const fileType = firstEntry instanceof File ? firstEntry.type : "";

  await FileStorage.uploadImage(blobName, fileData, fileType);

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
