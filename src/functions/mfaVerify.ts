import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { jsonReply } from "..";
import { IdentityManager } from "../lib/IdentityManager";
import { MfaVerifyBody } from "../models/Identity";

export async function mfaVerify(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const body = (await request.json()) as MfaVerifyBody;

  if (!body.pendingMfaToken || !body.code) {
    return { status: 400 };
  }

  const pendingRes = await IdentityManager.getPendingMfaUserId(
    body.pendingMfaToken
  );
  if (pendingRes.isErr()) {
    context.error(pendingRes.error);
    return { status: 500 };
  }

  const userId = pendingRes.value;
  if (!userId) {
    return { status: 401 };
  }

  const attemptsRes = await IdentityManager.getMfaAttempts(userId, 60);
  if (attemptsRes.isErr()) {
    context.error(attemptsRes.error);
    return { status: 500 };
  }

  if (attemptsRes.value >= 3) {
    return { status: 401 };
  }

  const verifyRes = await IdentityManager.verifyTotpCode(userId, body.code);
  if (verifyRes.isErr()) {
    context.error(verifyRes.error);
    return { status: 500 };
  }

  if (!verifyRes.value) {
    await IdentityManager.saveMfaAttempt(userId);
    return { status: 401 };
  }

  await IdentityManager.deletePendingMfaSession(body.pendingMfaToken);

  const authToken = await IdentityManager.createSession(userId);

  const userRes = await IdentityManager.getUser(userId);
  if (userRes.isErr()) {
    context.error(userRes.error);
    return { status: 500 };
  }

  const user = userRes.value;

  return jsonReply({
    authToken,
    userId: user.id,
    username: user.username,
    roles: user.roles,
  });
}

app.http("mfaVerify", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: mfaVerify,
});
