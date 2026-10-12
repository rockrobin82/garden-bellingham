import "server-only";

import { getEnv } from "@/lib/config/env";
import { getGoogleSheetsClient } from "@/lib/sheets/client";
import {
  mapRowToRecord,
  readSheetRange,
} from "@/lib/sheets/helpers";
import { SHEET_COLUMNS, SHEET_TABS } from "@/lib/sheets/schema";
import { reconcileDaySoldCount } from "@/lib/sheets/reconcile-day-sold-count";
import type { DaySoldCountDependencies } from "@/lib/sheets/reconcile-day-sold-count";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function toA1Range(range: string): string {
  return `${SHEET_TABS.dates}!${range}`;
}

function columnIndexToLetter(index: number): string {
  let columnNumber = index + 1;
  let letters = "";

  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }

  return letters;
}

function parseSoldCount(value: string): number {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid sold_count value: "${value}"`);
  }

  return parsed;
}

function findDateSheetRow(
  rows: string[][],
  bookingDate: string,
): { sheetRowNumber: number; soldCount: number } | null {
  if (rows.length < 2) {
    return null;
  }

  const [headerRow, ...dataRows] = rows;
  const headers = SHEET_COLUMNS.dates;

  if (headerRow.join(",") !== headers.join(",")) {
    throw new Error(
      `Unexpected "dates" header. Expected: ${headers.join(", ")}`,
    );
  }

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];

    if (!row.some((cell) => String(cell).trim() !== "")) {
      continue;
    }

    const record = mapRowToRecord(headers, row);

    if (record.date === bookingDate) {
      return {
        sheetRowNumber: index + 2,
        soldCount: parseSoldCount(record.sold_count),
      };
    }
  }

  return null;
}

/**
 * Records a paid day order in the dates sheet.
 * The sheet receives one absolute sold_count for the date. A retry does not add the same tickets again.
 */
export async function updateSoldCountForOrder(
  orderId: string,
  dependencies: DaySoldCountDependencies = {},
): Promise<void> {
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, booking_date, ticket_qty, payment_status, sheet_synced_at, day_sheet_qty, entry_slot_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  if (order.payment_status !== "paid") {
    return;
  }

  if (order.entry_slot_id) {
    const { projectEntrySlotSoldCount } = await import(
      "@/lib/sheets/project-entry-slot-sold-count"
    );
    await projectEntrySlotSoldCount(orderId);
    return;
  }

  if (order.sheet_synced_at) {
    if (order.day_sheet_qty == null) {
      const { error: markerError } = await supabase
        .from("orders")
        .update({ day_sheet_qty: order.ticket_qty })
        .eq("id", orderId)
        .is("day_sheet_qty", null);

      if (markerError) {
        throw new Error("Day sheet contribution could not be recorded");
      }
    }

    return;
  }

  await reconcileDaySoldCount(order.booking_date, {
    supabase,
    readDateSheet: dependencies.readDateSheet,
    writeSoldCount: dependencies.writeSoldCount,
  });
}

/**
 * Decreases sold_count in the dates sheet after a successful refund.
 * Does not roll back the refund on failure — caller should log and continue.
 */
export async function decreaseSoldCountForOrder(
  orderId: string,
  supabaseClient?: ReturnType<typeof getSupabaseAdminClient>,
): Promise<void> {
  const supabase = supabaseClient ?? getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, booking_date, ticket_qty, entry_slot_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  if (order.entry_slot_id) {
    throw new Error("Refusing to decrease day sold_count for an entry-slot order");
  }

  const rawRows = await readSheetRange(SHEET_TABS.dates, "A:Z");
  const dateRow = findDateSheetRow(rawRows, order.booking_date);

  if (!dateRow) {
    throw new Error(
      `Booking date not found in Google Sheets: ${order.booking_date}`,
    );
  }

  const newSoldCount = Math.max(0, dateRow.soldCount - order.ticket_qty);
  const soldCountColumnIndex = SHEET_COLUMNS.dates.indexOf("sold_count");
  const soldCountColumn = columnIndexToLetter(soldCountColumnIndex);
  const cellRange = toA1Range(`${soldCountColumn}${dateRow.sheetRowNumber}`);

  const env = getEnv();
  const sheets = getGoogleSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: cellRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newSoldCount]],
    },
  });
}
