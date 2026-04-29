import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { IdentityManager } from "../lib/IdentityManager";
import { jsonReply } from "..";

export async function setupAdmin(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  if (process.env.ALLOW_CREATE_ADMIN !== "1") {
    return { status: 403 };
  }

  switch (request.method) {
    case "POST": {
      const result = await IdentityManager.setupAdmin();

      if (result.isErr()) {
        context.error(result.error);
        return { status: 500, jsonBody: { error: result.error.message } };
      }

      return jsonReply({ id: result.value });
    }
    default:
      return jsonReply({ error: "Method not allowed" }, 405);
  }
}

app.http("setupAdmin", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: setupAdmin,
  route: "setupAdmin",
});
