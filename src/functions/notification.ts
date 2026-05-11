import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect } from "..";
import { Notification } from "../lib/Notification";
import { NotificationMessage } from "../models/Notification";

export async function notification(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isSystem) {
    return forbiddenReply();
  }

  switch (request.method) {
    case "POST": {
      const body = (await request.json()) as NotificationMessage;

      if (!body.userId || !body.title || !body.body) {
        return {
          status: 400,
          body: JSON.stringify({ message: "userId, title, and body are required" }),
        };
      }

      const result = await Notification.send(body);

      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }

      return { status: 204 };
    }

    default:
      return { status: 405 };
  }
}

app.http("notification", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: notification,
  route: "notification",
});
