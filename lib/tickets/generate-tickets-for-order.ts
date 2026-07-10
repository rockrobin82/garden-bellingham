import "server-only";

import { generateTicketCode } from "@/lib/tickets/generate-ticket-code";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TicketInsert } from "@/types/database";

/**
 * Creates one ticket row per purchased ticket for a paid order.
 * Idempotent: if any tickets already exist for the order, does nothing.
 */
export async function generateTicketsForOrder(orderId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { count: existingTicketCount, error: countError } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  if (countError) {
    throw new Error(countError.message);
  }

  if (existingTicketCount && existingTicketCount > 0) {
    return;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, ticket_qty, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order || order.payment_status !== "paid") {
    return;
  }

  const tickets: TicketInsert[] = Array.from(
    { length: order.ticket_qty },
    () => {
      const ticketCode = generateTicketCode();

      return {
        order_id: orderId,
        ticket_code: ticketCode,
        qr_payload: ticketCode,
        status: "valid",
      };
    },
  );

  const { error: insertError } = await supabase.from("tickets").insert(tickets);

  if (insertError) {
    throw new Error(insertError.message);
  }
}
