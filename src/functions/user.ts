import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { IdentityManager } from "../lib/IdentityManager";
import { jsonReply } from "..";
import { UserCreateBody } from "../models/Identity";

export async function user(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  switch (request.method) {
    case "POST":
      const body = (await request.json()) as UserCreateBody;
      const res = await IdentityManager.createUser(
        body.username,
        body.firstName,
        body.lastName,
        body.password
      );

      if (res.isErr()) {
        return {
          status: 400,
        };
      }

      return jsonReply({ id: res.value });
    case "PUT":
      break;
    default:
      return jsonReply({ error: "Method not allowed" }, 405);
  }
}

app.http("user", {
  methods: ["POST", "PUT"],
  authLevel: "anonymous",
  handler: user,
});
