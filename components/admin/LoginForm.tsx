"use client";

import { useActionState } from "react";

import {
  loginAdmin,
  type AdminLoginState,
} from "@/app/admin/login/actions";

const initialState: AdminLoginState = {
  error: null,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAdmin, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="admin-password"
          className="mb-2 block text-sm font-medium text-[#1f4d35]"
        >
          Hasło
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-[#1f4d35] outline-none transition placeholder:text-[#999] focus:border-[#1f4d35]"
          placeholder="••••••••"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="garden-btn w-full px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Logowanie…" : "Zaloguj"}
      </button>
    </form>
  );
}
