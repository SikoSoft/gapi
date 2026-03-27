import { BlobServiceClient, BlockBlobClient } from "@azure/storage-blob";
import intoStream from "into-stream";

export class FileStorage {
  static containerName = "images";

  static getBlobClient(file: string): BlockBlobClient {
    return blobService
      .getContainerClient(FileStorage.containerName)
      .getBlockBlobClient(file);
  }

  static async uploadImage(
    file: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const stream = intoStream(buffer);
    const streamLength = buffer.length;
    return new Promise<void>(async (resolve, reject) => {
      const blobClient = FileStorage.getBlobClient(file);

      const response = await blobClient.uploadStream(stream, streamLength, 5, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
      if (response.errorCode) {
        reject(response.errorCode);
      } else {
        resolve();
      }
    });
  }

  static sanitizePath(raw: string): string {
    if (!raw) {
      return "";
    }

    let decoded = "";

    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }

    const parts = decoded
      .split("/")
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p !== "." && p !== "..");

    const safe = parts.join("/");

    if (safe.length > 255) {
      return safe.slice(0, 255);
    }

    return safe;
  }

  static pad(x: number, padding: number = 2): string {
    return x.toString().padStart(padding, "0");
  }

  static shortDate(time: Date = new Date()): string {
    const date = new Date(time);
    return `${date.getFullYear()}-${FileStorage.pad(
      date.getMonth() + 1
    )}-${FileStorage.pad(date.getDate())}`;
  }

  static getBlobName = (fileName: string): string => {
    return `${FileStorage.shortDate()}/${fileName}`;
  };
}

const blobService = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
