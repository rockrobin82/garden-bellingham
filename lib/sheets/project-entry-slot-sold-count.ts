import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/config/env";
import { getGoogleSheetsClient } from "@/lib/sheets/client";
import { readSheetRange } from "@/lib/sheets/helpers";
import { parseEntrySlotRows } from "@/lib/sheets/parse-entry-slots";
import {
  DATES_SHEET_FORMAT,
  ENTRY_SLOT_COLUMNS,
  SHEET_TABS,
  detectDatesSheetFormat,
} from "@/lib/sheets/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

const LOG_PREFIX = "[projectEntrySlotSoldCount]";

type AdminClient = SupabaseClient<Database>;

export type EntrySlotSheetDependencies = {
  supabase?: AdminClient;
  readDateSheet?: () => Promise<string[][]>;
  writeSoldCount?: (sheetRowNumber: number, soldCount: number) => Promise<void>;
};

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

async function defaultReadDateSheet(): Promise<string[][]> {
  return readSheetRange(SHEET_TABS.dates, "A:Z");
}

async function defaultWriteSoldCount(
  sheetRowNumber: number,
  soldCount: number,
): Promise<void> {
  const soldCountColumnIndex = ENTRY_SLOT_COLUMNS.indexOf("sold_count");
  const soldCountColumn = columnIndexToLetter(soldCountColumnIndex);
  const env = getEnv();
  const sheets = getGoogleSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: `${SHEET_TABS.dates}!${soldCountColumn}${sheetRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[soldCount]],
    },
  });
}

function findSlotRowNumber(rows: string[][], slotId: string): number {
  const slotIdIndex = ENTRY_SLOT_COLUMNS.indexOf("slot_id");

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];

    if ((row[slotIdIndex] ?? "").trim() === slotId) {
      return index + 1;
    }
  }

  throw new Error("Entry slot row was not found in the sheet");
}

async function writeInventorySoldCount(
  slotId: string,
  soldQty: number,
  dependencies: EntrySlotSheetDependencies,
): Promise<void> {
  const readDateSheet = dependencies.readDateSheet ?? defaultReadDateSheet;
  const writeSoldCount = dependencies.writeSoldCount ?? defaultWriteSoldCount;
  const rows = await readDateSheet();
  const header = rows[0] ?? [];

  if (detectDatesSheetFormat(header) !== DATES_SHEET_FORMAT.entrySlot) {
    throw new Error("Entry slot sheet format is not active");
  }

  const slots = parseEntrySlotRows(rows);
  const slot = slots.find((candidate) => candidate.slot_id === slotId);

  if (!slot) {
    throw new Error("Entry slot row was not found in the sheet");
  }

  if (slot.sold_count === soldQty) {
    return;
  }

  const sheetRowNumber = findSlotRowNumber(rows, slotId);
  await writeSoldCount(sheetRowNumber, soldQty);
}

async function readSoldQty(
  supabase: AdminClient,
  slotId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("entry_slot_inventory")
    .select("sold_qty")
    .eq("slot_id", slotId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Inventory read failed.`, error);
    throw new Error("Entry slot inventory could not be read");
  }

  if (!data) {
    throw new Error("Entry slot inventory was not found");
  }

  return data.sold_qty;
}

async function markOrderSheetSynced(
  supabase: AdminClient,
  orderId: string,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ sheet_synced_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("sheet_synced_at", null);

  if (error) {
    console.error(`${LOG_PREFIX} sheet_synced_at update failed.`, error);
    throw new Error("Entry slot sheet sync could not be recorded");
  }
}

/**
 * Writes PostgreSQL sold_qty onto the matching slot row.
 * The sheet receives the absolute counter, so a repeated sync does not add sales.
 */
export async function projectEntrySlotSoldCount(
  orderId: string,
  dependencies: EntrySlotSheetDependencies = {},
): Promise<void> {
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, entry_slot_id, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Order read failed.`, error);
    throw new Error("Entry slot order could not be read");
  }

  if (!order?.entry_slot_id) {
    throw new Error("Order has no entry slot");
  }

  if (order.payment_status !== "paid" && order.payment_status !== "refunded") {
    return;
  }

  const soldQty = await readSoldQty(supabase, order.entry_slot_id);

  try {
    await writeInventorySoldCount(order.entry_slot_id, soldQty, dependencies);
  } catch (sheetError) {
    console.error(`${LOG_PREFIX} Sheet projection failed.`, sheetError);
    throw new Error("Entry slot sheet could not be updated");
  }

  await markOrderSheetSynced(supabase, orderId);
}

/**
 * Rewrites one slot's sold_count from PostgreSQL sold_qty.
 * Use this when a sheet cell has drifted from the reservation ledger.
 */
export async function repairEntrySlotSoldCount(
  slotId: string,
  dependencies: EntrySlotSheetDependencies = {},
): Promise<void> {
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();
  const soldQty = await readSoldQty(supabase, slotId);

  try {
    await writeInventorySoldCount(slotId, soldQty, dependencies);
  } catch (sheetError) {
    console.error(`${LOG_PREFIX} Sheet repair failed.`, sheetError);
    throw new Error("Entry slot sheet could not be updated");
  }
}
