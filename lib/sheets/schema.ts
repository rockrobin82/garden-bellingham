/**
 * Google Sheets tab names and column definitions for the MVP.
 * Header row in each tab must match these column names exactly.
 */

export const SHEET_TABS = {
  dates: "dates",
  entrySlots: "Wejścia",
  orders: "orders",
} as const;

export type SheetTab = (typeof SHEET_TABS)[keyof typeof SHEET_TABS];

/**
 * Live production header of the `dates` tab: one row per calendar day.
 * Checkout, sold_count updates, and `/api/availability` still require this header.
 */
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

/**
 * Header of the `Wejścia` tab: one row per entry window.
 * Day checkout keeps using `DATES_COLUMNS` on the `dates` tab.
 * `slot_id` is an operator-assigned stable id. It is not derived from the row number or the hours.
 */
export const ENTRY_SLOT_COLUMNS = [
  "slot_id",
  "date",
  "time_start",
  "time_end",
  "active",
  "ticket_limit",
  "sold_count",
  "price_normal",
  "price_reduced",
  "note",
  "max_tickets_per_order",
] as const;

export const DATES_SHEET_FORMAT = {
  day: "day",
  entrySlot: "entry-slot",
} as const;

export type DatesSheetFormat =
  (typeof DATES_SHEET_FORMAT)[keyof typeof DATES_SHEET_FORMAT];

export function detectDatesSheetFormat(
  headerRow: readonly string[],
): DatesSheetFormat | null {
  const header = headerRow.join(",");

  if (header === DATES_COLUMNS.join(",")) {
    return DATES_SHEET_FORMAT.day;
  }

  if (header === ENTRY_SLOT_COLUMNS.join(",")) {
    return DATES_SHEET_FORMAT.entrySlot;
  }

  return null;
}

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
export type EntrySlotColumn = (typeof ENTRY_SLOT_COLUMNS)[number];
export type OrdersColumn = (typeof ORDERS_COLUMNS)[number];

export const SHEET_COLUMNS = {
  [SHEET_TABS.dates]: DATES_COLUMNS,
  [SHEET_TABS.entrySlots]: ENTRY_SLOT_COLUMNS,
  [SHEET_TABS.orders]: ORDERS_COLUMNS,
} as const;
