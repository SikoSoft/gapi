import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { IdentityManager } from "../lib/IdentityManager";

export async function ott(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const introspection = await introspect(request);

  if (!introspection.isLoggedIn || !introspection.user.roles.includes("admin")) {
    return forbiddenReply();
  }

  switch (request.method) {
    case "POST": {
      const res = await IdentityManager.createOtt();

      if (res.isErr()) {
        context.error(res.error);
        return { status: 500 };
      }

      return jsonReply({ token: res.value });
    }
    default:
      return jsonReply({ error: "Method not allowed" }, 405);
  }
}

app.http("ott", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: ott,
  route: "ott",
});
