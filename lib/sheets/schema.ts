/**
 * Google Sheets tab names and column definitions for the MVP.
 * Header row in each tab must match these column names exactly.
 */

export const SHEET_TABS = {
  dates: "dates",
  orders: "orders",
} as const;

export type SheetTab = (typeof SHEET_TABS)[keyof typeof SHEET_TABS];

export const DATES_COLUMNS = [
  "date",
  "active",
  "ticket_limit",
  "sold_count",
  "price_normal",
  "price_reduced",
  "note",
  "max_tickets_per_order",
] as const;

export const ORDERS_COLUMNS = [
  "order_id",
  "created_at",
  "visit_date",
  "email",
  "normal_qty",
  "reduced_qty",
  "total_amount",
  "payment_status",
  "p24_session_id",
  "ticket_ids",
] as const;

export type DatesColumn = (typeof DATES_COLUMNS)[number];
export type OrdersColumn = (typeof ORDERS_COLUMNS)[number];

export const SHEET_COLUMNS = {
  [SHEET_TABS.dates]: DATES_COLUMNS,
  [SHEET_TABS.orders]: ORDERS_COLUMNS,
} as const;
