export class Google {
  static getClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }
  static readonly SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ];
}
