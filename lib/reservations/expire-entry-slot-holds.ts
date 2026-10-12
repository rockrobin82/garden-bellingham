import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

const LOG_PREFIX = "[expireEntrySlotHolds]";

type AdminClient = SupabaseClient<Database>;

export type ExpireEntrySlotHoldsDependencies = {
  supabase?: AdminClient;
  slotId?: string | null;
};

/**
 * Frees held seats whose expires_at has passed.
 * expires_at alone does not change counters; this RPC does.
 * Passing no slot id expires every overdue hold. A slot id limits the run.
 */
export async function runExpireEntrySlotHolds(
  dependencies: ExpireEntrySlotHoldsDependencies = {},
): Promise<number> {
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("expire_entry_slot_holds", {
    p_slot_id: dependencies.slotId ?? null,
  });

  if (error) {
    console.error(`${LOG_PREFIX} expire_entry_slot_holds failed.`, error);
    throw new Error("Entry slot expiry failed");
  }

  return typeof data === "number" ? data : 0;
}
