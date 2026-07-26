import "server-only";

import { cookies } from "next/headers";

import {
  ADMIN_COOKIE_NAME,
  verifyAdminSessionCookie,
} from "@/lib/admin/auth";

export class AdminUnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Unauthorized");
    this.name = "AdminUnauthorizedError";
  }
}

export async function requireAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const isAuthed = await verifyAdminSessionCookie(
    cookieStore.get(ADMIN_COOKIE_NAME)?.value,
  );

  if (!isAuthed) {
    throw new AdminUnauthorizedError();
  }
}
