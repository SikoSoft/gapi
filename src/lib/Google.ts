import { google } from "googleapis";
import { Result, ok, err } from "neverthrow";
import { GoogleEvent } from "../models/Identity";

export class Google {
  static readonly SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ];

  static getClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  static async getCalendarEvents(
    refreshToken: string
  ): Promise<Result<GoogleEvent[], Error>> {
    const googleClient = Google.getClient();

    googleClient.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: "v3", auth: googleClient });

    try {
      const events = await calendar.events.list({
        calendarId: "primary",
        timeMin: new Date().toISOString(),
        maxResults: 10,
      });
      return ok(events.data.items || []);
    } catch (error) {
      return err(new Error("Failed to fetch events"));
    }
  }
}
