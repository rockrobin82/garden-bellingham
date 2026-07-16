import "server-only";

import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderRow, PaymentStatus, TicketRow } from "@/types/database";

export type OrderSummary = Pick<
  OrderRow,
  | "id"
  | "booking_date"
  | "customer_email"
  | "ticket_qty"
  | "normal_qty"
  | "reduced_qty"
  | "payment_status"
>;

export type OrderTicketSummary = Pick<
  TicketRow,
  "ticket_code" | "status" | "used_at"
>;

export type OrderWithTickets = {
  order: OrderSummary;
  tickets: OrderTicketSummary[];
};

const ORDER_SELECT =
  "id, booking_date, customer_email, ticket_qty, normal_qty, reduced_qty, payment_status" as const;

const TICKET_SELECT = "ticket_code, status, used_at" as const;

export async function getOrderWithTickets(
  orderId: string,
): Promise<OrderWithTickets | null> {
  const supabase = getSupabaseAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    return null;
  }

  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select(TICKET_SELECT)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (ticketsError) {
    throw new Error(ticketsError.message);
  }

  return {
    order,
    tickets: tickets ?? [],
  };
}

export function getOrderPagePath(orderId: string): string {
  return `/orders/${orderId}`;
}

export function getOrderPageUrl(orderId: string): string {
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${appUrl}${getOrderPagePath(orderId)}`;
}

export function formatPaymentStatus(status: PaymentStatus): string {
  switch (status) {
    case "pending":
      return "Oczekuje";
    case "paid":
      return "Opłacone";
    case "failed":
      return "Nieudane";
    case "cancelled":
      return "Anulowane";
    default:
      return status;
  }
}

export function getTicketQrImagePath(ticketCode: string): string {
  return `/api/tickets/${encodeURIComponent(ticketCode)}/qr`;
}
