import { type NextRequest, NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  isAdminLoginPath,
  isAdminPath,
  verifyAdminSessionCookie,
} from "@/lib/admin/auth";
import { updateSession } from "@/lib/supabase/proxy";

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  return to;
}

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!isAdminPath(pathname)) {
    return sessionResponse;
  }

  const isAuthed = await verifyAdminSessionCookie(
    request.cookies.get(ADMIN_COOKIE_NAME)?.value,
  );
  const isLogin = isAdminLoginPath(pathname);

  if (!isLogin && !isAuthed) {
    const loginUrl = new URL("/admin/login", request.url);
    return copyCookies(sessionResponse, NextResponse.redirect(loginUrl));
  }

  if (isLogin && isAuthed) {
    const adminUrl = new URL("/admin", request.url);
    return copyCookies(sessionResponse, NextResponse.redirect(adminUrl));
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
