import type { EntrySlotRow } from "@/types/sheets";

/**
 * Target availability contract for one entry window.
 * Not returned by the production `/api/availability` route.
 */
export type AvailabilityEntrySlot = {
  slotId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  active: boolean;
  ticketLimit: number;
  soldCount: number;
  remaining: number;
  priceNormal: number;
  priceReduced: number;
  note: string;
  maxTicketsPerOrder: number;
};

export type AvailabilityEntrySlotsResponse = {
  slots: AvailabilityEntrySlot[];
};

export function remainingEntryTickets(
  ticketLimit: number,
  soldCount: number,
): number {
  return Math.max(0, ticketLimit - soldCount);
}

/**
 * Maps parsed sheet rows to the entry-slot availability contract.
 * Rows are not grouped by date.
 */
export function toAvailabilityEntrySlots(
  rows: readonly EntrySlotRow[],
): AvailabilityEntrySlot[] {
  return rows.map((row) => ({
    slotId: row.slot_id,
    date: row.date,
    timeStart: row.time_start,
    timeEnd: row.time_end,
    active: row.active,
    ticketLimit: row.ticket_limit,
    soldCount: row.sold_count,
    remaining: remainingEntryTickets(row.ticket_limit, row.sold_count),
    priceNormal: row.price_normal,
    priceReduced: row.price_reduced,
    note: row.note.trim(),
    maxTicketsPerOrder: row.max_tickets_per_order,
  }));
}
