import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

const CRITICAL_ENV_VARS = [
  "AZURE_STORAGE_CONNECTION_STRING",
  "AZURE_STORAGE_URL",
  "AzureWebJobsStorage",
  "ENCRYPTION_KEY",
  "SYSTEM_API_KEY",
  "VAPID_SUBJECT",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "ASSIST_API_BASE_URL",
  "TOTP_ISSUER",
  "GAPI_BASE_URL",
  "SMHI_API_SERVER_URL",
];

const OPTIONAL_ENV_VARS = ["ENABLE_NUKE", "ALLOW_CREATE_ADMIN"];

export async function diagnostics(
  _request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const envStatus = Object.fromEntries(
    [...CRITICAL_ENV_VARS, ...OPTIONAL_ENV_VARS].map(key => [
      key,
      process.env[key] ? "set" : "MISSING",
    ])
  );

  const missing = CRITICAL_ENV_VARS.filter(key => !process.env[key]);

  console.log("[gapi:diagnostics] called");

  return {
    status: missing.length > 0 ? 500 : 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      {
        ok: missing.length === 0,
        node: process.version,
        platform: process.platform,
        uptime: Math.round(process.uptime()),
        env: envStatus,
        ...(missing.length > 0 ? { missing } : {}),
      },
      null,
      2
    ),
  };
}

app.http("diagnostics", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: diagnostics,
  route: "diagnostics",
});
