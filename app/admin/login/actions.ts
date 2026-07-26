"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE_NAME,
  createAdminSessionCookie,
  getAdminCookieOptions,
  verifyAdminPassword,
} from "@/lib/admin/auth";

export type AdminLoginState = {
  error: string | null;
};

export async function loginAdmin(
  _prevState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { error: "Podaj hasło." };
  }

  const isValid = await verifyAdminPassword(password);

  console.log({
    entered: password,
    env: process.env.ADMIN_PASSWORD,
    isValid,
  });
  
  if (!isValid) {
    return { error: "Nieprawidłowe hasło." };
  }

  const sessionValue = await createAdminSessionCookie();
  if (!sessionValue) {
    return {
      error: "Panel admina nie jest skonfigurowany (ADMIN_PASSWORD).",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, sessionValue, getAdminCookieOptions());

  redirect("/admin");
}
