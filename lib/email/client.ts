import "server-only";

import { Resend } from "resend";

import { getEnv } from "@/lib/config/env";

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (resendClient) {
    return resendClient;
  }

  const env = getEnv();

  if (!env.RESEND_API_KEY) {
    throw new Error(
      "Resend is not configured. Set RESEND_API_KEY and MAIL_FROM.",
    );
  }

  resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

export function getMailFromAddress(): string {
  const env = getEnv();

  if (!env.MAIL_FROM) {
    throw new Error(
      "Resend is not configured. Set RESEND_API_KEY and MAIL_FROM.",
    );
  }

  return env.MAIL_FROM;
}
