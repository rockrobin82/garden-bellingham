import "server-only";

import { z } from "zod";

const DEFAULT_API_BASE_URL = "https://secure.przelewy24.pl";

const p24EnvSchema = z.object({
  P24_MERCHANT_ID: z.coerce.number().int().positive(),
  P24_POS_ID: z.coerce.number().int().positive().optional(),
  P24_API_KEY: z.string().min(1),
  P24_CRC_KEY: z.string().min(1),
  P24_API_BASE_URL: z.string().url().default(DEFAULT_API_BASE_URL),
});

export type P24Config = {
  merchantId: number;
  posId: number;
  apiKey: string;
  crcKey: string;
  apiBaseUrl: string;
  apiUrl: string;
  trnRequestBaseUrl: string;
};

let cachedConfig: P24Config | null = null;

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeApiUrl(apiBaseUrl: string): string {
  const base = stripTrailingSlashes(apiBaseUrl);

  if (base.endsWith("/api/v1")) {
    return base;
  }

  return `${base}/api/v1`;
}

function getTrnRequestBaseUrl(apiBaseUrl: string): string {
  return stripTrailingSlashes(apiBaseUrl).replace(/\/api\/v1$/, "");
}

/**
 * Loads and validates Przelewy24 credentials from environment variables.
 */
export function getP24Config(source: NodeJS.ProcessEnv = process.env): P24Config {
  if (source === process.env && cachedConfig) {
    return cachedConfig;
  }

  const parsed = p24EnvSchema.safeParse({
    P24_MERCHANT_ID: source.P24_MERCHANT_ID,
    P24_POS_ID: source.P24_POS_ID,
    P24_API_KEY: source.P24_API_KEY,
    P24_CRC_KEY: source.P24_CRC_KEY,
    P24_API_BASE_URL: source.P24_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid Przelewy24 configuration: ${details}`);
  }

  const merchantId = parsed.data.P24_MERCHANT_ID;
  const posId = parsed.data.P24_POS_ID ?? merchantId;
  const apiBaseUrl = stripTrailingSlashes(parsed.data.P24_API_BASE_URL);

  const config: P24Config = {
    merchantId,
    posId,
    apiKey: parsed.data.P24_API_KEY,
    crcKey: parsed.data.P24_CRC_KEY,
    apiBaseUrl,
    apiUrl: normalizeApiUrl(apiBaseUrl),
    trnRequestBaseUrl: getTrnRequestBaseUrl(apiBaseUrl),
  };

  if (source === process.env) {
    cachedConfig = config;
  }

  return config;
}

/** Clears cached config (useful in tests). */
export function resetP24ConfigCache(): void {
  cachedConfig = null;
}
