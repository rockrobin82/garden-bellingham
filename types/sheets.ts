import type { PaymentStatus } from "@/types/booking";

/**
 * Row from the `dates` sheet tab.
 * Column names match the spreadsheet header row.
 */
export type DateRow = {
  date: string;
  active: boolean;
  ticket_limit: number;
  sold_count: number;
  price_normal: number;
  price_reduced: number;
  note: string;
  max_tickets_per_order: number;
};

/**
 * Row from the `orders` sheet tab.
 * Column names match the spreadsheet header row.
 */
export type OrderRow = {
  order_id: string;
  created_at: string;
  visit_date: string;
  email: string;
  normal_qty: number;
  reduced_qty: number;
  total_amount: number;
  payment_status: PaymentStatus;
  p24_session_id: string;
  ticket_ids: string;
};
