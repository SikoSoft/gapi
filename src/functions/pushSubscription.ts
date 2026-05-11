import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect } from "..";
import { PushSubscription } from "../lib/PushSubscription";
import { PushSubscriptionPayload } from "../models/PushSubscription";

export async function pushSubscription(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const userId = introspection.user.id;

  switch (request.method) {
    case "POST": {
      const body = (await request.json()) as PushSubscriptionPayload;

      if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
        return {
          status: 400,
          body: JSON.stringify({ message: "Invalid subscription payload" }),
        };
      }

      const result = await PushSubscription.save(userId, body);

      if (result.isErr()) {
        context.error(result.error);
        return { status: 500 };
      }

      return { status: 204 };
    }

    case "DELETE": {
      const body = (await request.json()) as { endpoint: string };

      if (!body.endpoint) {
        return {
          status: 400,
          body: JSON.stringify({ message: "endpoint is required" }),
        };
      }

      const result = await PushSubscription.remove(userId, body.endpoint);

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

app.http("pushSubscription", {
  methods: ["POST", "DELETE"],
  authLevel: "anonymous",
  handler: pushSubscription,
  route: "pushSubscription",
});
