import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/config/env";
import { getGoogleSheetsClient } from "@/lib/sheets/client";
import { readSheetRange } from "@/lib/sheets/helpers";
import { mapRowToRecord } from "@/lib/sheets/map-row";
import {
  DATES_COLUMNS,
  DATES_SHEET_FORMAT,
  SHEET_TABS,
  detectDatesSheetFormat,
} from "@/lib/sheets/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

const LOG_PREFIX = "[reconcileDaySoldCount]";

type AdminClient = SupabaseClient<Database>;

export type DaySoldCountDependencies = {
  supabase?: AdminClient;
  readDateSheet?: () => Promise<string[][]>;
  writeSoldCount?: (sheetRowNumber: number, soldCount: number) => Promise<void>;
};

type DaySheetCell = {
  sheetRowNumber: number;
  soldCount: number;
};

type SoldCountPlan = {
  action: "dispatch" | "write" | "confirm" | "blocked";
  targetQty: number;
  operationId: string | null;
  detail: string | null;
};

export class DaySoldCountSyncError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Day sold count cannot be reconciled (${reason})`);
    this.name = "DaySoldCountSyncError";
    this.reason = reason;
  }
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

function safeErrorDetail(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  if (/postgres:\/\/|eyJ|secret|api[_-]?key/i.test(error.message)) {
    return "hidden";
  }

  return error.message;
}

export function findDaySheetCell(
  rows: string[][],
  bookingDate: string,
): DaySheetCell {
  const header = rows[0] ?? [];

  if (detectDatesSheetFormat(header) !== DATES_SHEET_FORMAT.day) {
    throw new DaySoldCountSyncError("unexpected_header");
  }

  const matches: DaySheetCell[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];

    if (!row.some((cell) => String(cell).trim() !== "")) {
      continue;
    }

    const record = mapRowToRecord(DATES_COLUMNS, row);

    if (record.date !== bookingDate) {
      continue;
    }

    const soldCount = record.sold_count.trim();

    if (!/^(0|[1-9]\d*)$/.test(soldCount)) {
      throw new DaySoldCountSyncError("invalid_sheet_value");
    }

    matches.push({
      sheetRowNumber: index + 1,
      soldCount: Number(soldCount),
    });
  }

  if (matches.length === 0) {
    throw new DaySoldCountSyncError("missing_row");
  }

  if (matches.length > 1) {
    throw new DaySoldCountSyncError("duplicate_row");
  }

  return matches[0];
}

async function defaultReadDateSheet(): Promise<string[][]> {
  return readSheetRange(SHEET_TABS.dates, "A:Z");
}

async function defaultWriteSoldCount(
  sheetRowNumber: number,
  soldCount: number,
): Promise<void> {
  const soldCountColumnIndex = DATES_COLUMNS.indexOf("sold_count");
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

function readObject(data: unknown): Record<string, unknown> {
  const payload = typeof data === "string" ? JSON.parse(data) : data;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new DaySoldCountSyncError("invalid_plan");
  }

  return payload as Record<string, unknown>;
}

function throwIfAmbiguous(error: { message: string }): void {
  const marker = "DAY_SOLD_COUNT_AMBIGUOUS:";

  if (!error.message.includes(marker)) {
    return;
  }

  const reason = error.message.slice(error.message.indexOf(marker) + marker.length);
  throw new DaySoldCountSyncError(reason.split(/\s/)[0] || "unknown");
}

async function planDaySoldCountSync(
  supabase: AdminClient,
  bookingDate: string,
  sheetQty: number,
): Promise<SoldCountPlan> {
  const { data, error } = await supabase.rpc("plan_day_sold_count_sync", {
    p_booking_date: bookingDate,
    p_sheet_qty: sheetQty,
  });

  if (error) {
    throwIfAmbiguous(error);
    console.error(`${LOG_PREFIX} Plan failed.`, safeErrorDetail(error));
    throw new DaySoldCountSyncError("sync_failed");
  }

  const payload = readObject(data);
  const action = payload.action;
  const detail = typeof payload.detail === "string" ? payload.detail : null;

  if (
    action !== "dispatch" &&
    action !== "write" &&
    action !== "confirm" &&
    action !== "blocked"
  ) {
    throw new DaySoldCountSyncError("invalid_plan");
  }

  if (action === "blocked") {
    return {
      action,
      targetQty: 0,
      operationId: null,
      detail: detail ?? "manual_review",
    };
  }

  const targetQty = payload.targetQty;
  const operationId =
    typeof payload.operationId === "string" ? payload.operationId : null;

  if (
    typeof targetQty !== "number" ||
    !Number.isInteger(targetQty) ||
    targetQty < 0 ||
    (action === "dispatch" && operationId == null)
  ) {
    throw new DaySoldCountSyncError("invalid_plan");
  }

  return { action, targetQty, operationId, detail };
}

async function markDaySoldCountSubmitted(
  supabase: AdminClient,
  bookingDate: string,
  operationId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_day_sold_count_submitted", {
    p_booking_date: bookingDate,
    p_operation_id: operationId,
  });

  if (error) {
    console.error(`${LOG_PREFIX} Submit mark failed.`, safeErrorDetail(error));
    throw new DaySoldCountSyncError("sync_failed");
  }

  const payload = readObject(data);

  return payload.marked === true;
}

async function completeDaySoldCountSync(
  supabase: AdminClient,
  bookingDate: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("complete_day_sold_count_sync", {
    p_booking_date: bookingDate,
  });

  if (error) {
    throwIfAmbiguous(error);
    console.error(`${LOG_PREFIX} Complete failed.`, safeErrorDetail(error));
    throw new DaySoldCountSyncError("sync_failed");
  }

  const payload = readObject(data);

  if (typeof payload.completed !== "boolean") {
    throw new DaySoldCountSyncError("invalid_plan");
  }

  return payload.completed;
}

/**
 * Writes the absolute day sold_count implied by paid day orders.
 * A repeated call writes the same number. It does not add or subtract a delta.
 * Ambiguous orders, an unexpected header, or more than one row for the date
 * fail before the cell changes.
 */
export async function reconcileDaySoldCount(
  bookingDate: string,
  dependencies: DaySoldCountDependencies = {},
): Promise<number> {
  const readDateSheet = dependencies.readDateSheet ?? defaultReadDateSheet;
  const writeSoldCount = dependencies.writeSoldCount ?? defaultWriteSoldCount;
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const cell = findDaySheetCell(await readDateSheet(), bookingDate);
    const plan = await planDaySoldCountSync(supabase, bookingDate, cell.soldCount);

    if (plan.action === "blocked") {
      console.error(`${LOG_PREFIX} Day sheet sync needs review.`, plan.detail);
      throw new DaySoldCountSyncError(plan.detail ?? "manual_review");
    }

    if (plan.action === "dispatch") {
      const marked = await markDaySoldCountSubmitted(
        supabase,
        bookingDate,
        plan.operationId ?? "",
      );

      if (!marked) {
        continue;
      }
    }

    if (
      (plan.action === "dispatch" || plan.action === "write") &&
      plan.targetQty !== cell.soldCount
    ) {
      try {
        await writeSoldCount(cell.sheetRowNumber, plan.targetQty);
      } catch (error) {
        console.error(`${LOG_PREFIX} Sheet write failed.`, safeErrorDetail(error));
        throw new DaySoldCountSyncError("sheet_write_failed");
      }
    }

    const completed = await completeDaySoldCountSync(supabase, bookingDate);

    if (!completed) {
      continue;
    }

    const confirmed = findDaySheetCell(await readDateSheet(), bookingDate);

    if (confirmed.soldCount === plan.targetQty) {
      return plan.targetQty;
    }
  }

  throw new DaySoldCountSyncError("did_not_settle");
}
