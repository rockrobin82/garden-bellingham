import "server-only";

import {
  escapeIlikePattern,
  type AdminOrderFilters,
} from "@/lib/admin/order-filters";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderRow, TicketRow } from "@/types/database";

export type AdminOrderListItem = Pick<
  OrderRow,
  | "id"
  | "booking_date"
  | "customer_email"
  | "ticket_qty"
  | "normal_qty"
  | "reduced_qty"
  | "total_amount_minor"
  | "payment_status"
  | "created_at"
>;

export type AdminOrderDetails = Pick<
  OrderRow,
  | "id"
  | "booking_date"
  | "customer_email"
  | "ticket_qty"
  | "normal_qty"
  | "reduced_qty"
  | "total_amount_minor"
  | "payment_status"
  | "p24_session_id"
  | "created_at"
  | "paid_at"
  | "email_sent_at"
  | "sheet_synced_at"
  | "refunded_at"
  | "refund_id"
  | "refund_amount_minor"
  | "refund_reason"
>;

export type AdminTicketItem = Pick<
  TicketRow,
  "ticket_code" | "status" | "used_at"
>;

export type AdminOrderWithTickets = {
  order: AdminOrderDetails;
  tickets: AdminTicketItem[];
};

const LIST_SELECT =
  "id, booking_date, customer_email, ticket_qty, normal_qty, reduced_qty, total_amount_minor, payment_status, created_at" as const;

const DETAILS_SELECT =
  "id, booking_date, customer_email, ticket_qty, normal_qty, reduced_qty, total_amount_minor, payment_status, p24_session_id, created_at, paid_at, email_sent_at, sheet_synced_at, refunded_at, refund_id, refund_amount_minor, refund_reason" as const;

const TICKET_SELECT = "ticket_code, status, used_at" as const;

export async function listAdminOrders(
  filters: AdminOrderFilters = {},
): Promise<AdminOrderListItem[]> {
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("orders")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });

  if (filters.search) {
    query = query.ilike(
      "customer_email",
      `%${escapeIlikePattern(filters.search)}%`,
    );
  }

  if (filters.status) {
    query = query.eq("payment_status", filters.status);
  }

  if (filters.from) {
    query = query.gte("booking_date", filters.from);
  }

  if (filters.to) {
    query = query.lte("booking_date", filters.to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getAdminOrderWithTickets(
  orderId: string,
): Promise<AdminOrderWithTickets | null> {
  const supabase = getSupabaseAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(DETAILS_SELECT)
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
