import { google } from "googleapis";
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { forbiddenReply, introspect, jsonReply } from "..";
import { GoogleEvent, GoogleState } from "../models/Identity";
import { Google } from "../lib/Google";
import { IdentityManager } from "../lib/IdentityManager";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

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

  if (!introspection.user.googleLink) {
    return jsonReply(
      {
        linked: false,
      },
      200
    );
  }

  const decryptedToken = IdentityManager.decryptToken(
    introspection.user.googleAccount.refreshToken
  );

  switch (request.method) {
    case "GET":
      const eventsRes = await Google.getCalendarEvents(decryptedToken);

      if (eventsRes.isErr()) {
        return jsonReply(
          {
            linked: true,
            events: [],
            error: eventsRes.error.message,
          },
          500
        );
      }

      const events = eventsRes.value;

      return jsonReply({ events });
    default:
      return {
        status: 405,
        body: "Method Not Allowed",
      };
  }
}

app.http("googleCalendarEvent", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: googleLink,
  route: "google/event",
});
