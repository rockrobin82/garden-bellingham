import "server-only";

import { getTicketWithVisitDate } from "@/lib/tickets/get-ticket-with-visit-date";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ScanTicketNotFoundResult = {
  status: "NOT_FOUND";
};

export type ScanTicketCancelledResult = {
  status: "CANCELLED";
};

export type ScanTicketUsedResult = {
  status: "USED";
  ticketCode: string;
  visitDate: string;
  usedAt: string;
};

export type ScanTicketValidResult = {
  status: "VALID";
  ticketCode: string;
  visitDate: string;
};

export type ScanTicketResult =
  | ScanTicketNotFoundResult
  | ScanTicketCancelledResult
  | ScanTicketUsedResult
  | ScanTicketValidResult;

function toUsedResult(ticket: {
  ticket_code: string;
  visitDate: string;
  used_at: string;
}): ScanTicketUsedResult {
  return {
    status: "USED",
    ticketCode: ticket.ticket_code,
    visitDate: ticket.visitDate,
    usedAt: ticket.used_at,
  };
}

/**
 * Scans and checks in a ticket for staff use.
 * Race-condition safe via conditional update on status and used_at.
 */
export async function scanTicket(ticketCode: string): Promise<ScanTicketResult> {
  const ticket = await getTicketWithVisitDate(ticketCode);

  if (!ticket) {
    return { status: "NOT_FOUND" };
  }

  if (ticket.status === "cancelled") {
    return { status: "CANCELLED" };
  }

  if (ticket.used_at !== null) {
    return toUsedResult({
      ticket_code: ticket.ticket_code,
      visitDate: ticket.visitDate,
      used_at: ticket.used_at,
    });
  }

  const supabase = getSupabaseAdminClient();
  const usedAt = new Date().toISOString();
  const { data: updatedTicket, error: updateError } = await supabase
    .from("tickets")
    .update({
      used_at: usedAt,
      status: "used",
    })
    .eq("ticket_code", ticketCode)
    .eq("status", "valid")
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (updatedTicket) {
    return {
      status: "VALID",
      ticketCode: ticket.ticket_code,
      visitDate: ticket.visitDate,
    };
  }

  const reloadedTicket = await getTicketWithVisitDate(ticketCode);

  if (!reloadedTicket) {
    return { status: "NOT_FOUND" };
  }

  if (reloadedTicket.used_at !== null) {
    return toUsedResult({
      ticket_code: reloadedTicket.ticket_code,
      visitDate: reloadedTicket.visitDate,
      used_at: reloadedTicket.used_at,
    });
  }

  throw new Error(`Unexpected ticket scan state for code: ${ticketCode}`);
}
