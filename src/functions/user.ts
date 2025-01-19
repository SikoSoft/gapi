import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { IdentityManager } from "../lib/IdentityManager";
import { jsonReply } from "..";

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

  const body = (await request.json()) as RequestBody;

  const id = await IdentityManager.createUser(
    body.username,
    body.firstName,
    body.lastName,
    body.password
  );

  return jsonReply({ id });
}

app.http("user", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: user,
});
