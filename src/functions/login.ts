import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, jsonReply } from "..";
import { IdentityManager } from "../lib/IdentityManager";

declare interface RequestBody {
  username: string;
  password: string;
}

export async function login(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const body = (await request.json()) as RequestBody;

  const user = await IdentityManager.getUserByUserName(body.username);

  if (user) {
    console.log({ user });
    const passwordIsValid = await IdentityManager.verifyPassword(
      user.id,
      body.password
    );
    console.log({ passwordIsValid });
    if (passwordIsValid) {
      const authToken = await IdentityManager.createSession(user.id);
      return jsonReply({ authToken });
    }
  }

  return forbiddenReply();
}

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: login,
});
