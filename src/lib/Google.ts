import { calendar_v3, google } from "googleapis";

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
  ): Promise<calendar_v3.Schema$Event[]> {
    const googleClient = Google.getClient();

    googleClient.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: "v3", auth: googleClient });

    try {
      const events = await calendar.events.list({
        calendarId: "primary",
        timeMin: new Date().toISOString(),
        maxResults: 10,
      });
      return events.data.items || [];
    } catch (err) {
      console.error("Failed to fetch events", err);
      throw new Error("Failed to fetch events");
    }
  }
}
