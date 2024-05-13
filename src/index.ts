import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export const jsonReply = (
  object: Object = {},
  status: number = 200
): HttpResponseInit => {
  return {
    status,
    headers: {
      "content-type": "application/json",
    },
    ...(Object.keys(object).length ? { body: JSON.stringify(object) } : {}),
  };
};

export const userIdFromRequest = (request: HttpRequest): string => {
  return "f00300fd-dd74-4e17-8624-b67295cfa053";
};
