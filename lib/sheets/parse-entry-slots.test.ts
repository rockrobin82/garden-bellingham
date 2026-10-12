import { describe, expect, it } from "vitest";

import { toAvailabilityEntrySlots } from "@/lib/availability/entry-slots";
import {
  ENTRY_SLOT_OVERLAP_PUBLIC_MESSAGE,
  ENTRY_SLOT_PARSE_ERROR,
  EntrySlotParseError,
  parseEntrySlotRows,
  publicEntrySlotAvailabilityMessage,
} from "@/lib/sheets/parse-entry-slots";
import { DATES_COLUMNS, ENTRY_SLOT_COLUMNS } from "@/lib/sheets/schema";

type SlotCells = Record<(typeof ENTRY_SLOT_COLUMNS)[number], string>;

const baseSlot: SlotCells = {
  slot_id: "gb-2026-10-17-morning",
  date: "2026-10-17",
  time_start: "10:00",
  time_end: "14:00",
  active: "TRUE",
  ticket_limit: "40",
  sold_count: "28",
  price_normal: "35",
  price_reduced: "25",
  note: "",
  max_tickets_per_order: "6",
};

function cells(overrides: Partial<SlotCells> = {}): string[] {
  const values = { ...baseSlot, ...overrides };
  return ENTRY_SLOT_COLUMNS.map((column) => values[column]);
}

function sheet(...dataRows: string[][]): string[][] {
  return [[...ENTRY_SLOT_COLUMNS], ...dataRows];
}

function expectCode(rows: string[][], code: string): void {
  expect(() => parseEntrySlotRows(rows)).toThrow(EntrySlotParseError);

  try {
    parseEntrySlotRows(rows);
  } catch (error) {
    expect(error).toBeInstanceOf(EntrySlotParseError);
    expect((error as EntrySlotParseError).code).toBe(code);
  }
}

describe("parseEntrySlotRows", () => {
  it("parses one entry window", () => {
    const slots = parseEntrySlotRows(sheet(cells()));

    expect(slots).toEqual([
      {
        slot_id: "gb-2026-10-17-morning",
        date: "2026-10-17",
        time_start: "10:00",
        time_end: "14:00",
        active: true,
        ticket_limit: 40,
        sold_count: 28,
        price_normal: 35,
        price_reduced: 25,
        note: "",
        max_tickets_per_order: 6,
      },
    ]);
  });

  it("keeps several windows on the same date as separate records", () => {
    const slots = parseEntrySlotRows(
      sheet(
        cells(),
        cells({
          slot_id: "gb-2026-10-17-afternoon",
          time_start: "15:00",
          time_end: "19:00",
          sold_count: "12",
          price_normal: "40",
          price_reduced: "30",
        }),
        cells({
          slot_id: "gb-2026-10-18-day",
          date: "2026-10-18",
          time_start: "10:00",
          time_end: "15:00",
          ticket_limit: "80",
          sold_count: "0",
        }),
      ),
    );

    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.slot_id)).toEqual([
      "gb-2026-10-17-morning",
      "gb-2026-10-17-afternoon",
      "gb-2026-10-18-day",
    ]);
    expect(slots.filter((slot) => slot.date === "2026-10-17")).toHaveLength(2);
  });

  it("rejects a duplicate slot_id", () => {
    expectCode(
      sheet(cells(), cells({ time_start: "15:00", time_end: "19:00" })),
      ENTRY_SLOT_PARSE_ERROR.duplicateSlotId,
    );
  });

  it("rejects an empty slot_id", () => {
    expectCode(sheet(cells({ slot_id: "  " })), ENTRY_SLOT_PARSE_ERROR.emptySlotId);
  });

  it("rejects an invalid date", () => {
    expectCode(
      sheet(cells({ date: "2026-02-31" })),
      ENTRY_SLOT_PARSE_ERROR.invalidDate,
    );
    expectCode(
      sheet(cells({ date: "17-10-2026" })),
      ENTRY_SLOT_PARSE_ERROR.invalidDate,
    );
  });

  it("rejects an invalid clock time", () => {
    expectCode(
      sheet(cells({ time_start: "9:00" })),
      ENTRY_SLOT_PARSE_ERROR.invalidTime,
    );
    expectCode(
      sheet(cells({ time_end: "24:00" })),
      ENTRY_SLOT_PARSE_ERROR.invalidTime,
    );
  });

  it("rejects a window that does not move forward", () => {
    expectCode(
      sheet(cells({ time_start: "14:00", time_end: "14:00" })),
      ENTRY_SLOT_PARSE_ERROR.invalidTimeRange,
    );
    expectCode(
      sheet(cells({ time_start: "15:00", time_end: "10:00" })),
      ENTRY_SLOT_PARSE_ERROR.invalidTimeRange,
    );
  });

  it("rejects invalid prices and limits", () => {
    expectCode(
      sheet(cells({ price_normal: "-1" })),
      ENTRY_SLOT_PARSE_ERROR.invalidPrice,
    );
    expectCode(
      sheet(cells({ price_reduced: "n/a" })),
      ENTRY_SLOT_PARSE_ERROR.invalidPrice,
    );
    expectCode(
      sheet(cells({ ticket_limit: "-5" })),
      ENTRY_SLOT_PARSE_ERROR.invalidLimit,
    );
    expectCode(
      sheet(cells({ sold_count: "12.5" })),
      ENTRY_SLOT_PARSE_ERROR.invalidLimit,
    );
    expectCode(
      sheet(cells({ max_tickets_per_order: "0" })),
      ENTRY_SLOT_PARSE_ERROR.invalidLimit,
    );
  });

  it("keeps an inactive window instead of dropping it", () => {
    const slots = parseEntrySlotRows(sheet(cells({ active: "FALSE" })));

    expect(slots).toHaveLength(1);
    expect(slots[0]?.active).toBe(false);
  });

  it("rejects the live day-level header", () => {
    expectCode([[...DATES_COLUMNS], cells()], ENTRY_SLOT_PARSE_ERROR.unexpectedHeader);
  });

  it("rejects a fully overlapping pair in either row order", () => {
    expectOverlap(
      cells({ slot_id: "afternoon", time_start: "10:00", time_end: "14:00" }),
    );
    expectCode(
      sheet(
        cells({ slot_id: "afternoon", time_start: "10:00", time_end: "14:00" }),
        cells(),
      ),
      ENTRY_SLOT_PARSE_ERROR.overlappingWindows,
    );
  });

  it("rejects a partial overlap", () => {
    expectOverlap(
      cells({ slot_id: "late", time_start: "13:00", time_end: "16:00" }),
    );
  });

  it("rejects a window contained in another", () => {
    expectCode(
      sheet(
        cells({ slot_id: "inner", time_start: "12:00", time_end: "14:00" }),
        cells({ slot_id: "long", time_start: "10:00", time_end: "18:00" }),
      ),
      ENTRY_SLOT_PARSE_ERROR.overlappingWindows,
    );
  });

  it("allows windows that only touch at the boundary", () => {
    const slots = parseEntrySlotRows(
      sheet(
        cells({ slot_id: "afternoon", time_start: "14:00", time_end: "18:00" }),
        cells(),
      ),
    );

    expect(slots.map((slot) => slot.slot_id)).toEqual([
      "afternoon",
      "gb-2026-10-17-morning",
    ]);
  });

  it("allows the same hours on different dates", () => {
    const slots = parseEntrySlotRows(
      sheet(
        cells(),
        cells({
          slot_id: "next-day",
          date: "2026-10-18",
        }),
      ),
    );

    expect(slots).toHaveLength(2);
  });

  it("ignores an inactive window that overlaps an active one", () => {
    const slots = parseEntrySlotRows(
      sheet(
        cells(),
        cells({
          slot_id: "closed",
          time_start: "12:00",
          time_end: "16:00",
          active: "no",
        }),
      ),
    );

    expect(slots).toHaveLength(2);
    expect(slots.filter((slot) => slot.active)).toHaveLength(1);
  });

  it("allows overlapping windows when every one is inactive", () => {
    const slots = parseEntrySlotRows(
      sheet(
        cells({ active: "false" }),
        cells({
          slot_id: "also-closed",
          time_start: "12:00",
          time_end: "16:00",
          active: "0",
        }),
      ),
    );

    expect(slots.every((slot) => slot.active === false)).toBe(true);
  });

  it("rejects the whole sheet when one of three windows overlaps", () => {
    const rows = sheet(
      cells({ slot_id: "evening", time_start: "16:00", time_end: "18:00" }),
      cells({
        slot_id: "other-day",
        date: "2026-10-18",
        time_start: "10:00",
        time_end: "14:00",
      }),
      cells(),
      cells({ slot_id: "overlap", time_start: "11:00", time_end: "13:00" }),
    );

    expectCode(rows, ENTRY_SLOT_PARSE_ERROR.overlappingWindows);

    try {
      parseEntrySlotRows(rows);
    } catch (error) {
      expect(error).toBeInstanceOf(EntrySlotParseError);
      expect((error as Error).message).toContain("2026-10-17");
      expect((error as Error).message).not.toContain("evening");
      expect((error as Error).message).not.toContain("other-day");
      expect((error as Error).message).not.toContain("slot_id");
      expect(publicEntrySlotAvailabilityMessage(error)).toBe(
        ENTRY_SLOT_OVERLAP_PUBLIC_MESSAGE,
      );
      expect(publicEntrySlotAvailabilityMessage(error)).not.toContain("2026-10-17");
    }
  });

  it("keeps an invalid clock time on its own error", () => {
    expectCode(
      sheet(cells({ time_start: "10.00" })),
      ENTRY_SLOT_PARSE_ERROR.invalidTime,
    );
    expectCode(
      sheet(cells({ time_end: "1000" })),
      ENTRY_SLOT_PARSE_ERROR.invalidTime,
    );
    expectCode(
      sheet(
        cells({ time_start: "25:99" }),
        cells({ slot_id: "other", time_start: "11:00", time_end: "12:00" }),
      ),
      ENTRY_SLOT_PARSE_ERROR.invalidTime,
    );
  });
});

function expectOverlap(...dataRows: string[][]): void {
  const rows = sheet(cells(), ...dataRows);
  expectCode(rows, ENTRY_SLOT_PARSE_ERROR.overlappingWindows);

  try {
    parseEntrySlotRows(rows);
  } catch (error) {
    expect((error as Error).message).not.toContain("slot_id");
    expect(publicEntrySlotAvailabilityMessage(error)).toBe(
      ENTRY_SLOT_OVERLAP_PUBLIC_MESSAGE,
    );
  }
}

describe("toAvailabilityEntrySlots", () => {
  it("does not return a negative remaining count", () => {
    const slots = toAvailabilityEntrySlots(
      parseEntrySlotRows(
        sheet(
          cells({ sold_count: "28" }),
          cells({
            slot_id: "oversold",
            time_start: "15:00",
            time_end: "19:00",
            ticket_limit: "40",
            sold_count: "55",
          }),
        ),
      ),
    );

    expect(slots.map((slot) => slot.remaining)).toEqual([12, 0]);
    expect(slots.every((slot) => slot.remaining >= 0)).toBe(true);
  });

  it("does not merge windows that share a date", () => {
    const slots = toAvailabilityEntrySlots(
      parseEntrySlotRows(
        sheet(
          cells(),
          cells({
            slot_id: "gb-2026-10-17-afternoon",
            time_start: "15:00",
            time_end: "19:00",
            sold_count: "12",
            price_normal: "40",
            price_reduced: "30",
          }),
        ),
      ),
    );

    expect(slots).toEqual([
      expect.objectContaining({
        slotId: "gb-2026-10-17-morning",
        date: "2026-10-17",
        timeStart: "10:00",
        timeEnd: "14:00",
        remaining: 12,
        priceNormal: 35,
        priceReduced: 25,
      }),
      expect.objectContaining({
        slotId: "gb-2026-10-17-afternoon",
        date: "2026-10-17",
        timeStart: "15:00",
        timeEnd: "19:00",
        remaining: 28,
        priceNormal: 40,
        priceReduced: 30,
      }),
    ]);
  });
});
