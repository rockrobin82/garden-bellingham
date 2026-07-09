import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/config/env";
import type { Database } from "@/types/database";

let supabaseAdminClient: SupabaseClient<Database> | null = null;

/**
 * Returns a server-side Supabase client using the service role key.
 * All database access from API routes should go through this client.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const env = getEnv();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  supabaseAdminClient = createClient<Database>(
    env.SUPABASE_URL,
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
