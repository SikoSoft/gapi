import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply, prisma } from "..";
import multipart from "parse-multipart";
import { FileStorage } from "../lib/FileStorage";

export function pad(x: number, padding: number = 2): string {
  return x.toString().padStart(padding, "0");
}

export function shortDate(time: Date = new Date()): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

const getBlobName = (fileName) => {
  return `${shortDate()}/${fileName}`;
};

export type RequestBody = {};

export async function file(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;
  //const body = (await request.json()) as RequestBody;

  const chunks: Uint8Array[] = [];
  const reader = request.body.getReader();
  let result = await reader.read();
  while (!result.done) {
    chunks.push(result.value);
    result = await reader.read();
  }
  const buffer = Buffer.concat(chunks);

  if (request.headers.has("content-type")) {
    console.log("has content-type", request.headers.get("content-type"));
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return {
        status: 400,
        body: "Invalid content-type",
      };
    }
  } else {
    console.log("#####################no content-type");
  }

  console.log("HEADERS", JSON.stringify(request.headers, null, 2));

  const boundary = multipart.getBoundary(request.headers.get("content-type"));
  const parts = multipart.Parse(buffer, boundary);
  const blobName = getBlobName(parts[0].filename);

  const url = await FileStorage.uploadImage(
    blobName,
    parts[0].data,
    parts[0].type
  );

  return jsonReply({
    url: `${process.env.AZURE_STORAGE_URL}/images/${blobName}`,
  });
}

app.http("file", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: file,
});
