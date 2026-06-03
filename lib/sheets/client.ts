import "server-only";

import { google, type sheets_v4 } from "googleapis";

import { getEnv } from "@/lib/config/env";

let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Returns an authenticated Google Sheets API client (singleton per process).
 */
export function getGoogleSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) {
    return sheetsClient;
  }

  const env = getEnv();

  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}
