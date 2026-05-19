import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { IdentityManager } from "../lib/IdentityManager";

export async function mfaSetup(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const { secret, uri } = IdentityManager.generateTotpSecret(
    introspection.user.username
  );
  return jsonReply({ secret, uri });
}

app.http("mfaSetup", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: mfaSetup,
});
