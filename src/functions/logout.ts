import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { IdentityManager } from "../lib/IdentityManager";

export async function logout(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authToken = request.headers.get("authorization")!;

  const result = await IdentityManager.revokeAuthToken(authToken);
  if (result) {
    return {
      status: 202,
    };
  }

  return {
    status: 400,
  };
}

app.http("logout", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: logout,
});
