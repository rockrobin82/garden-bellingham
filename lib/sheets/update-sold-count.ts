import "server-only";

import { getEnv } from "@/lib/config/env";
import { getGoogleSheetsClient } from "@/lib/sheets/client";
import {
  mapRowToRecord,
  readSheetRange,
} from "@/lib/sheets/helpers";
import { SHEET_COLUMNS, SHEET_TABS } from "@/lib/sheets/schema";
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
 * Increments sold_count in the dates sheet for a paid order.
 * Idempotent via orders.sheet_synced_at.
 */
export async function updateSoldCountForOrder(orderId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, booking_date, ticket_qty, payment_status, sheet_synced_at",
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

  if (order.sheet_synced_at) {
    return;
  }

  const rawRows = await readSheetRange(SHEET_TABS.dates, "A:Z");
  const dateRow = findDateSheetRow(rawRows, order.booking_date);

  if (!dateRow) {
    throw new Error(
      `Booking date not found in Google Sheets: ${order.booking_date}`,
    );
  }

  const newSoldCount = dateRow.soldCount + order.ticket_qty;
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

  const { error: syncError } = await supabase
    .from("orders")
    .update({ sheet_synced_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("sheet_synced_at", null);

  if (syncError) {
    throw new Error(syncError.message);
  }
}
