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
}

const blobService = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
