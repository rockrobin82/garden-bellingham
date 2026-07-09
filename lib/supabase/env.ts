export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

/**
 * Returns public Supabase credentials when configured.
 * Used by browser, server, and middleware clients.
 */
export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}
