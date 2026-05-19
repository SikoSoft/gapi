import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { IdentityManager } from "../lib/IdentityManager";
import { MfaVerifySetupBody } from "../models/Identity";

export async function mfaVerifySetup(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }

  const body = (await request.json()) as MfaVerifySetupBody;

  if (!body.secret || !body.code) {
    return { status: 400 };
  }

  if (!IdentityManager.verifyTotpCodeForSecret(body.secret, body.code)) {
    return { status: 401 };
  }

  const saveRes = await IdentityManager.saveTotpSecret(
    introspection.user.id,
    body.secret
  );
  if (saveRes.isErr()) {
    context.error(saveRes.error);
    return { status: 500 };
  }

  return jsonReply({});
}

app.http("mfaVerifySetup", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: mfaVerifySetup,
});
