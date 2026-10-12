import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateTicketCode } from "@/lib/tickets/generate-ticket-code";
import type { Database } from "@/types/database";

/**
 * Creates any missing tickets for a paid order.
 * insert_order_tickets holds the order row lock across the count and the insert.
 * An error leaves the order unfinished: the caller must not treat it as confirmed.
 * Tickets that already exist, including ones used at check-in, keep their QR codes.
 */
export async function insertOrderTickets(
  supabase: SupabaseClient<Database>,
  orderId: string,
  generateCode: () => string = generateTicketCode,
): Promise<void> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("ticket_qty, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order || order.payment_status !== "paid") {
    return;
  }

  const ticketCodes = Array.from({ length: order.ticket_qty }, () => generateCode());
  const { data, error } = await supabase.rpc("insert_order_tickets", {
    p_order_id: orderId,
    p_ticket_codes: ticketCodes,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data !== "number" || data < order.ticket_qty) {
    throw new Error(`Ticket set for order ${orderId} is incomplete`);
  }
}
