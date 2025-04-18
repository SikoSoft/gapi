import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getIp, jsonReply } from "..";
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

  const userRes = await IdentityManager.getUserByUserName(body.username);
  if (userRes.isErr()) {
    return {
      status: 500,
    };
  }

  const ip = getIp(request);

  const user = userRes.value;

  if (user) {
    const passwordIsValidRes = await IdentityManager.verifyPassword(
      user.id,
      body.password
    );

    if (passwordIsValidRes.isErr()) {
      return {
        status: 500,
      };
    }

    if (!passwordIsValidRes.value) {
      await IdentityManager.saveLoginAttempt(user.id, ip);

      return {
        status: 401,
      };
    }

    const numFailedAttemptsRes = await IdentityManager.getLoginAttempts(
      user.id,
      ip,
      60
    );
    if (numFailedAttemptsRes.isErr()) {
      return {
        status: 500,
      };
    }

    if (numFailedAttemptsRes.value >= 3) {
      await IdentityManager.saveLoginAttempt(user.id, ip);
      return {
        status: 401,
      };
    }

    const authToken = await IdentityManager.createSession(user.id);
    return jsonReply({ authToken, userId: user.id, username: user.username });
  }

  await IdentityManager.saveLoginAttempt("", ip);
  return {
    status: 401,
  };
}

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: login,
});
