import { google } from "googleapis";
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { IdentityManager } from "../lib/IdentityManager";
import { GoogleState } from "../models/Identity";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function googleCallback(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const code = request.query.get("code");
  if (!code) {
    return {
      status: 400,
      body: "Missing required query parameter: code",
    };
  }

  const state = request.query.get("state");
  if (!state) {
    return {
      status: 400,
      body: "Missing required query parameter: state",
    };
  }

  const decodedState = JSON.parse(
    Buffer.from(state as string, "base64").toString()
  ) as GoogleState;

  const userId = decodedState.userId;

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (tokens.refresh_token) {
      const encrypted = IdentityManager.encryptToken(tokens.refresh_token);

      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      const googleId = payload?.sub;
      const email = payload?.email;

      await IdentityManager.saveGoogleAccount(
        userId,
        googleId,
        email,
        encrypted
      );
    }

    const returnUrl = decodedState.returnUrl || "/";

    return {
      status: 302,
      headers: {
        Location: returnUrl,
        "Cache-Control": "no-store",
      },
    };
  } catch (error) {
    return {
      status: 500,
      body: "Authentication failed.",
    };
  }
}

app.http("googleCallback", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: googleCallback,
  route: "google/callback",
});
