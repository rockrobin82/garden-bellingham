import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_PRIVATE_KEY: z.string().min(1),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().min(1),

  P24_MERCHANT_ID: z.string().optional(),
  P24_POS_ID: z.string().optional(),
  P24_API_KEY: z.string().optional(),
  P24_CRC_KEY: z.string().optional(),
  P24_API_BASE_URL: z.string().url().optional(),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
  INVOICE_NOTIFICATION_EMAIL: z.string().email().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  ADMIN_PASSWORD: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n");
}

function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: source.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: source.GOOGLE_PRIVATE_KEY
      ? normalizePrivateKey(source.GOOGLE_PRIVATE_KEY)
      : undefined,
    GOOGLE_SHEETS_SPREADSHEET_ID: source.GOOGLE_SHEETS_SPREADSHEET_ID,
    P24_MERCHANT_ID: source.P24_MERCHANT_ID,
    P24_POS_ID: source.P24_POS_ID,
    P24_API_KEY: source.P24_API_KEY,
    P24_CRC_KEY: source.P24_CRC_KEY,
    P24_API_BASE_URL: source.P24_API_BASE_URL,
    RESEND_API_KEY: source.RESEND_API_KEY,
    MAIL_FROM: source.MAIL_FROM,
    INVOICE_NOTIFICATION_EMAIL: source.INVOICE_NOTIFICATION_EMAIL,
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_PASSWORD: source.ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${details}`);
  }

  return parsed.data;
}

/**
 * Returns validated environment variables.
 * Validation runs once per process (lazy singleton).
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}

/**
 * Clears cached env (useful in tests).
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
