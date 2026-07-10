import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TicketRow } from "@/types/database";

export async function getTicketByCode(
  ticketCode: string,
): Promise<TicketRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, order_id, ticket_code, qr_payload, status, created_at, used_at")
    .eq("ticket_code", ticketCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
