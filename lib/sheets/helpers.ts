import "server-only";

import { getEnv } from "@/lib/config/env";
import { getGoogleSheetsClient } from "@/lib/sheets/client";
import type { SheetTab } from "@/lib/sheets/schema";
import { SHEET_COLUMNS } from "@/lib/sheets/schema";
import { parsePaymentStatus } from "@/lib/validation/payment";
import type { DateRow, OrderRow } from "@/types/sheets";

type SheetRowValues = (string | number | boolean)[];

function toA1Range(tab: SheetTab, range: string): string {
  return `${tab}!${range}`;
}

/**
 * Reads raw cell values from a sheet range.
 */
export async function readSheetRange(
  tab: SheetTab,
  range = "A:Z",
): Promise<string[][]> {
  const env = getEnv();
  const sheets = getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: toA1Range(tab, range),
  });

  return (response.data.values ?? []) as string[][];
}

/**
 * Appends one row to the bottom of a sheet tab.
 */
export async function appendSheetRow(
  tab: SheetTab,
  values: SheetRowValues,
): Promise<void> {
  const env = getEnv();
  const sheets = getGoogleSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: toA1Range(tab, "A:Z"),
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [values.map(String)],
    },
  });
}

/**
 * Maps a header row + data row into a keyed object using column order.
 */
export function mapRowToRecord<T extends string>(
  headers: readonly T[],
  row: string[],
): Record<T, string> {
  const record = {} as Record<T, string>;

  headers.forEach((header, index) => {
    record[header] = row[index] ?? "";
  });

  return record;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseNumber(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for "${fieldName}": "${value}"`);
  }
  return parsed;
}

/**
 * Parses raw sheet rows (including header) into typed DateRow objects.
 */
export function parseDateRows(rows: string[][]): DateRow[] {
  if (rows.length < 2) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = SHEET_COLUMNS.dates;

  if (headerRow.join(",") !== headers.join(",")) {
    throw new Error(
      `Unexpected "dates" header. Expected: ${headers.join(", ")}`,
    );
  }

  console.log("HEADERS:", headers);
  console.log("ROWS:", dataRows);
  
  return dataRows
    .filter((row) => row.some((cell) => String(cell).trim() !== ""))
    .map((row) => {
      const record = mapRowToRecord(headers, row);
      console.log("RECORD:", record);
      
      return {
        date: record.date,
        active: parseBoolean(record.active),
        ticket_limit: parseNumber(record.ticket_limit, "ticket_limit"),
        sold_count: parseNumber(record.sold_count, "sold_count"),
        price_normal: parseNumber(record.price_normal, "price_normal"),
        price_reduced: parseNumber(record.price_reduced, "price_reduced"),
        note: record.note,
        max_tickets_per_order: parseNumber(
          record.max_tickets_per_order,
          "max_tickets_per_order",
        ),
      };
    });
}

/**
 * Parses raw sheet rows (including header) into typed OrderRow objects.
 */
export function parseOrderRows(rows: string[][]): OrderRow[] {
  if (rows.length < 2) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = SHEET_COLUMNS.orders;

  if (headerRow.join(",") !== headers.join(",")) {
    throw new Error(
      `Unexpected "orders" header. Expected: ${headers.join(", ")}`,
    );
  }

  return dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const record = mapRowToRecord(headers, row);

      return {
        order_id: record.order_id,
        created_at: record.created_at,
        visit_date: record.visit_date,
        email: record.email,
        normal_qty: parseNumber(record.normal_qty, "normal_qty"),
        reduced_qty: parseNumber(record.reduced_qty, "reduced_qty"),
        total_amount: parseNumber(record.total_amount, "total_amount"),
        payment_status: parsePaymentStatus(record.payment_status),
        p24_session_id: record.p24_session_id,
        ticket_ids: record.ticket_ids,
      };
    });
}
