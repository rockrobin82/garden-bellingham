import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TicketRow } from "@/types/database";

export type TicketWithVisitDate = TicketRow & {
  visitDate: string;
};

export async function getTicketWithVisitDate(
  ticketCode: string,
): Promise<TicketWithVisitDate | null> {
  const supabase = getSupabaseAdminClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("id, order_id, ticket_code, qr_payload, status, created_at, used_at")
    .eq("ticket_code", ticketCode)
    .maybeSingle();

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  if (!ticket) {
    return null;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("booking_date")
    .eq("id", ticket.order_id)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error(`Order not found for ticket: ${ticketCode}`);
  }

  return {
    ...ticket,
    visitDate: order.booking_date,
  };
}
