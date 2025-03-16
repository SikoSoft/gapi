import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { IdentityManager } from "../lib/IdentityManager";
import { forbiddenReply, introspect, jsonReply } from "..";

declare interface RequestBody {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}

export async function user(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  return jsonReply({ introspection });
}

app.http("introspect", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: user,
  route: "introspect",
});
