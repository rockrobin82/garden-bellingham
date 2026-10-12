import { mapRowToRecord } from "@/lib/sheets/map-row";
import {
  ENTRY_SLOT_COLUMNS,
  SHEET_TABS,
  detectDatesSheetFormat,
} from "@/lib/sheets/schema";
import type { EntrySlotRow } from "@/types/sheets";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const NON_NEGATIVE_INTEGER = /^\d+$/;
const NON_NEGATIVE_DECIMAL = /^\d+(\.\d+)?$/;
const SLOT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const ENTRY_SLOT_PARSE_ERROR = {
  unexpectedHeader: "unexpected_header",
  emptySlotId: "empty_slot_id",
  invalidSlotId: "invalid_slot_id",
  duplicateSlotId: "duplicate_slot_id",
  invalidDate: "invalid_date",
  invalidTime: "invalid_time",
  invalidTimeRange: "invalid_time_range",
  invalidActive: "invalid_active",
  invalidLimit: "invalid_limit",
  invalidPrice: "invalid_price",
  overlappingWindows: "overlapping_windows",
} as const;

export const ENTRY_SLOT_OVERLAP_PUBLIC_MESSAGE =
  "Entry times overlap, so these tickets cannot be offered.";

export type EntrySlotParseErrorCode =
  (typeof ENTRY_SLOT_PARSE_ERROR)[keyof typeof ENTRY_SLOT_PARSE_ERROR];

export class EntrySlotParseError extends Error {
  readonly code: EntrySlotParseErrorCode;

  constructor(code: EntrySlotParseErrorCode, message: string) {
    super(message);
    this.name = "EntrySlotParseError";
    this.code = code;
  }
}

function fail(
  code: EntrySlotParseErrorCode,
  sheetRowNumber: number,
  message: string,
): never {
  throw new EntrySlotParseError(
    code,
    `Row ${sheetRowNumber}: ${message}`,
  );
}

function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function timeToMinutes(value: string): number {
  const match = CLOCK_TIME.exec(value);

  if (!match) {
    return Number.NaN;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function parseActive(value: string, sheetRowNumber: number): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  fail(
    ENTRY_SLOT_PARSE_ERROR.invalidActive,
    sheetRowNumber,
    `invalid active value "${value}"`,
  );
}

function parseNonNegativeInteger(
  value: string,
  fieldName: string,
  sheetRowNumber: number,
  minimum: number,
): number {
  const trimmed = value.trim();

  if (!NON_NEGATIVE_INTEGER.test(trimmed)) {
    fail(
      ENTRY_SLOT_PARSE_ERROR.invalidLimit,
      sheetRowNumber,
      `invalid ${fieldName} "${value}"`,
    );
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    fail(
      ENTRY_SLOT_PARSE_ERROR.invalidLimit,
      sheetRowNumber,
      `invalid ${fieldName} "${value}"`,
    );
  }

  return parsed;
}

function parsePrice(
  value: string,
  fieldName: string,
  sheetRowNumber: number,
): number {
  const trimmed = value.trim();

  if (!NON_NEGATIVE_DECIMAL.test(trimmed)) {
    fail(
      ENTRY_SLOT_PARSE_ERROR.invalidPrice,
      sheetRowNumber,
      `invalid ${fieldName} "${value}"`,
    );
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(
      ENTRY_SLOT_PARSE_ERROR.invalidPrice,
      sheetRowNumber,
      `invalid ${fieldName} "${value}"`,
    );
  }

  return parsed;
}

function parseSlotId(value: string, sheetRowNumber: number): string {
  if (value.trim() === "") {
    fail(
      ENTRY_SLOT_PARSE_ERROR.emptySlotId,
      sheetRowNumber,
      "slot_id is empty",
    );
  }

  if (!SLOT_ID.test(value)) {
    fail(
      ENTRY_SLOT_PARSE_ERROR.invalidSlotId,
      sheetRowNumber,
      `invalid slot_id "${value}"`,
    );
  }

  return value;
}

/**
 * Parses the `Wejścia` sheet.
 * Rows that share a date stay separate. `slot_id` values must be unique.
 * Active windows on the same date must not overlap. Touching endpoints are allowed.
 * One overlap rejects the whole sheet, so no window from that read can be sold.
 * Does not accept the live day-level header.
 */
export function publicEntrySlotAvailabilityMessage(error: unknown): string | null {
  if (
    error instanceof EntrySlotParseError &&
    error.code === ENTRY_SLOT_PARSE_ERROR.overlappingWindows
  ) {
    return ENTRY_SLOT_OVERLAP_PUBLIC_MESSAGE;
  }

  return null;
}

export function parseEntrySlotRows(rows: string[][]): EntrySlotRow[] {
  if (rows.length === 0) {
    throw new EntrySlotParseError(
      ENTRY_SLOT_PARSE_ERROR.unexpectedHeader,
      `Unexpected "${SHEET_TABS.entrySlots}" header. Expected: ${ENTRY_SLOT_COLUMNS.join(", ")}`,
    );
  }

  if (detectDatesSheetFormat(rows[0]) !== "entry-slot") {
    throw new EntrySlotParseError(
      ENTRY_SLOT_PARSE_ERROR.unexpectedHeader,
      `Unexpected "${SHEET_TABS.entrySlots}" header. Expected: ${ENTRY_SLOT_COLUMNS.join(", ")}`,
    );
  }

  if (rows.length < 2) {
    return [];
  }

  const [, ...dataRows] = rows;
  const seenSlotIds = new Set<string>();
  const slots: EntrySlotRow[] = [];

  dataRows.forEach((row, index) => {
    if (!row.some((cell) => String(cell).trim() !== "")) {
      return;
    }

    const sheetRowNumber = index + 2;
    const record = mapRowToRecord(ENTRY_SLOT_COLUMNS, row);
    const slotId = parseSlotId(record.slot_id, sheetRowNumber);

    if (seenSlotIds.has(slotId)) {
      fail(
        ENTRY_SLOT_PARSE_ERROR.duplicateSlotId,
        sheetRowNumber,
        `duplicate slot_id "${slotId}"`,
      );
    }

    seenSlotIds.add(slotId);

    const date = record.date.trim();
    const timeStart = record.time_start.trim();
    const timeEnd = record.time_end.trim();

    if (!isValidIsoDate(date)) {
      fail(
        ENTRY_SLOT_PARSE_ERROR.invalidDate,
        sheetRowNumber,
        `invalid date "${record.date}"`,
      );
    }

    const startMinutes = timeToMinutes(timeStart);
    const endMinutes = timeToMinutes(timeEnd);

    if (Number.isNaN(startMinutes)) {
      fail(
        ENTRY_SLOT_PARSE_ERROR.invalidTime,
        sheetRowNumber,
        `invalid time_start "${record.time_start}"`,
      );
    }

    if (Number.isNaN(endMinutes)) {
      fail(
        ENTRY_SLOT_PARSE_ERROR.invalidTime,
        sheetRowNumber,
        `invalid time_end "${record.time_end}"`,
      );
    }

    if (startMinutes >= endMinutes) {
      fail(
        ENTRY_SLOT_PARSE_ERROR.invalidTimeRange,
        sheetRowNumber,
        `time_start "${timeStart}" must be earlier than time_end "${timeEnd}"`,
      );
    }

    slots.push({
      slot_id: slotId,
      date,
      time_start: timeStart,
      time_end: timeEnd,
      active: parseActive(record.active, sheetRowNumber),
      ticket_limit: parseNonNegativeInteger(
        record.ticket_limit,
        "ticket_limit",
        sheetRowNumber,
        0,
      ),
      sold_count: parseNonNegativeInteger(
        record.sold_count,
        "sold_count",
        sheetRowNumber,
        0,
      ),
      price_normal: parsePrice(
        record.price_normal,
        "price_normal",
        sheetRowNumber,
      ),
      price_reduced: parsePrice(
        record.price_reduced,
        "price_reduced",
        sheetRowNumber,
      ),
      note: record.note,
      max_tickets_per_order: parseNonNegativeInteger(
        record.max_tickets_per_order,
        "max_tickets_per_order",
        sheetRowNumber,
        1,
      ),
    });
  });

  assertNoActiveOverlap(slots);
  return slots;
}

/**
 * Active windows on one date use a half-open clock range [start, end).
 * 10:00–14:00 and 14:00–18:00 do not overlap. Row order does not matter.
 * A conflict fails the entire parse instead of dropping one window.
 */
function assertNoActiveOverlap(slots: readonly EntrySlotRow[]): void {
  const byDate = new Map<string, EntrySlotRow[]>();

  for (const slot of slots) {
    if (!slot.active) {
      continue;
    }

    const daySlots = byDate.get(slot.date) ?? [];
    daySlots.push(slot);
    byDate.set(slot.date, daySlots);
  }

  for (const [date, daySlots] of byDate) {
    const ordered = [...daySlots].sort(
      (left, right) =>
        timeToMinutes(left.time_start) - timeToMinutes(right.time_start) ||
        timeToMinutes(left.time_end) - timeToMinutes(right.time_end),
    );

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const next = ordered[index];

      if (
        previous &&
        next &&
        timeToMinutes(next.time_start) < timeToMinutes(previous.time_end)
      ) {
        throw new EntrySlotParseError(
          ENTRY_SLOT_PARSE_ERROR.overlappingWindows,
          `Active entry windows overlap on ${date}`,
        );
      }
    }
  }
}
