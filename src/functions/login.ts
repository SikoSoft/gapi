import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getIp, jsonReply } from "..";
import { IdentityManager } from "../lib/IdentityManager";
import { Setting } from "../lib/Setting";

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
    context.error(userRes.error);

    return {
      status: 403,
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
      context.error(passwordIsValidRes.error);

      return {
        status: 403,
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
      context.error(numFailedAttemptsRes.error);

      return {
        status: 403,
      };
    }

    if (numFailedAttemptsRes.value >= 3) {
      await IdentityManager.saveLoginAttempt(user.id, ip);
      return {
        status: 401,
      };
    }

    const settingsRes = await Setting.getForUser(user.id);
    if (settingsRes.isErr()) {
      context.error(settingsRes.error);
      return { status: 500 };
    }

    if (settingsRes.value.enable2FA) {
      const pendingTokenRes = await IdentityManager.createPendingMfaSession(user.id);
      if (pendingTokenRes.isErr()) {
        context.error(pendingTokenRes.error);
        return { status: 500 };
      }
      return jsonReply({ pendingMfaToken: pendingTokenRes.value }, 202);
    }

    const authToken = await IdentityManager.createSession(user.id);
    return jsonReply({
      authToken,
      userId: user.id,
      username: user.username,
      roles: user.roles,
    });
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
