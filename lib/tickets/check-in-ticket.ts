import "server-only";

import {
  TicketAlreadyUsedError,
  TicketCancelledError,
  TicketNotFoundError,
} from "@/lib/tickets/errors";
import { getTicketWithVisitDate } from "@/lib/tickets/get-ticket-with-visit-date";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type TicketCheckInResult = {
  success: true;
};

function isTicketUsed(ticket: {
  status: string;
  used_at: string | null;
}): boolean {
  return ticket.used_at !== null || ticket.status === "used";
}

export async function checkInTicket(
  ticketCode: string,
): Promise<TicketCheckInResult> {
  const ticket = await getTicketWithVisitDate(ticketCode);

  if (!ticket) {
    throw new TicketNotFoundError(ticketCode);
  }

  if (ticket.status === "cancelled") {
    throw new TicketCancelledError(ticketCode);
  }

  if (isTicketUsed(ticket)) {
    return { success: true };
  }

  const supabase = getSupabaseAdminClient();
  const usedAt = new Date().toISOString();
  const { data: updatedTicket, error: updateError } = await supabase
    .from("tickets")
    .update({
      used_at: usedAt,
      status: "used",
    })
    .eq("id", ticket.id)
    .eq("status", "valid")
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (updatedTicket) {
    return { success: true };
  }

  const { data: currentTicket, error: reloadError } = await supabase
    .from("tickets")
    .select("status, used_at")
    .eq("id", ticket.id)
    .maybeSingle();

  if (reloadError) {
    throw new Error(reloadError.message);
  }

  if (!currentTicket) {
    throw new TicketNotFoundError(ticketCode);
  }

  if (currentTicket.status === "cancelled") {
    throw new TicketCancelledError(ticketCode);
  }

  if (isTicketUsed(currentTicket)) {
    return { success: true };
  }

  throw new TicketAlreadyUsedError(ticketCode);
}
