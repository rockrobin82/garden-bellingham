import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Client Components (browser).
 * Uses the public anon key — safe to expose to the client.
 */
export function createClient() {
  const config = getSupabasePublicEnv();

  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient<Database>(config.url, config.anonKey);
}
