import { google } from "googleapis";
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { GoogleState } from "../models/Identity";
import { Google } from "../lib/Google";

const oauth2Client = Google.getClient();

export async function googleLink(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  console.log(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const introspection = await introspect(request);
  if (!introspection.isLoggedIn) {
    return forbiddenReply();
  }
  const userId = introspection.user.id;

  const stateData: GoogleState = {
    userId,
    returnUrl: request.query.get("returnUrl") || "/",
  };

  const state = Buffer.from(JSON.stringify(stateData)).toString("base64");

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: Google.SCOPES,
    state,
  });

  return jsonReply({ url });
}

app.http("googleLink", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: googleLink,
  route: "google/link",
});
