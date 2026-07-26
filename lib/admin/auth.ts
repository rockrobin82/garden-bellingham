export const ADMIN_COOKIE_NAME = "gb_admin_session";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const COOKIE_PAYLOAD = "admin";

function getAdminPassword(): string | undefined {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password && password.length > 0 ? password : undefined;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signValue(secret: string, value: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return toBase64Url(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export async function createAdminSessionCookie(): Promise<string | null> {
  const password = getAdminPassword();
  if (!password) {
    return null;
  }

  const issuedAt = Date.now().toString();
  const value = `${COOKIE_PAYLOAD}.${issuedAt}`;
  const signature = await signValue(password, value);
  return `${value}.${signature}`;
}

export async function verifyAdminSessionCookie(
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue) {
    return false;
  }

  const password = getAdminPassword();
  if (!password) {
    return false;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [payload, issuedAt, signature] = parts;
  if (payload !== COOKIE_PAYLOAD || !issuedAt || !signature) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    return false;
  }

  const ageSeconds = (Date.now() - issuedAtMs) / 1000;
  if (ageSeconds < 0 || ageSeconds > COOKIE_MAX_AGE_SECONDS) {
    return false;
  }

  const expectedSignature = await signValue(
    password,
    `${payload}.${issuedAt}`,
  );

  return timingSafeEqual(signature, expectedSignature);
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const expected = getAdminPassword();
  if (!expected) {
    return false;
  }

  // Compare digests so length differences do not short-circuit the check.
  const [providedDigest, expectedDigest] = await Promise.all([
    signValue(expected, `password:${password}`),
    signValue(expected, `password:${expected}`),
  ]);

  return timingSafeEqual(providedDigest, expectedDigest);
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdminLoginPath(pathname: string): boolean {
  return pathname === "/admin/login";
}
