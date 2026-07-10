import "server-only";

import { TicketNotFoundError } from "@/lib/tickets/errors";
import { getTicketWithVisitDate } from "@/lib/tickets/get-ticket-with-visit-date";

export type TicketValidationResult = {
  valid: boolean;
  status: string;
  used: boolean;
  visitDate: string;
  orderId: string;
};

export async function validateTicket(
  ticketCode: string,
): Promise<TicketValidationResult> {
  const ticket = await getTicketWithVisitDate(ticketCode);

  if (!ticket) {
    throw new TicketNotFoundError(ticketCode);
  }

  const used = ticket.used_at !== null;
  const valid = ticket.status === "valid" && !used;

  return {
    valid,
    status: ticket.status,
    used,
    visitDate: ticket.visitDate,
    orderId: ticket.order_id,
  };
}
