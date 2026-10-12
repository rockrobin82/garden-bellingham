import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertOrderTickets } from "@/lib/tickets/insert-order-tickets";
import type { Database } from "@/types/database";

/**
 * Creates any missing tickets for a paid day order.
 * Uses the same locked insert as entry-slot orders. A failure is thrown so
 * payment finalization stops before the sheet sync and the confirmation email.
 */
export async function generateTicketsForOrder(
  orderId: string,
  supabase?: SupabaseClient<Database>,
): Promise<void> {
  await insertOrderTickets(supabase ?? getSupabaseAdminClient(), orderId);
}
