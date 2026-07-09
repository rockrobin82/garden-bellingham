import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/config/env";
import type { Database } from "@/types/database";

let supabaseAdminClient: SupabaseClient<Database> | null = null;

/**
 * Supabase client with the service role key for trusted server-side operations.
 * Bypasses RLS — use only in API routes and background jobs, never in the browser.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const env = getEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  supabaseAdminClient = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return supabaseAdminClient;
}
