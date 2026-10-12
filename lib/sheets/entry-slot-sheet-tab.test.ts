import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/availability/slots/route";
import { EntrySlotSheetError } from "@/lib/orders/errors";
import { createEntrySlotOrder } from "@/lib/orders/create-entry-slot-order";
import { projectEntrySlotSoldCount } from "@/lib/sheets/project-entry-slot-sold-count";
import {
  DATES_COLUMNS,
  ENTRY_SLOT_COLUMNS,
  SHEET_COLUMNS,
  SHEET_TABS,
} from "@/lib/sheets/schema";
import {
  decreaseSoldCountForOrder,
  updateSoldCountForOrder,
} from "@/lib/sheets/update-sold-count";

const { readSheetRange, sheetUpdate, from } = vi.hoisted(() => ({
  readSheetRange: vi.fn(),
  sheetUpdate: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/sheets/helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sheets/helpers")>(
    "@/lib/sheets/helpers",
  );

  return {
    ...actual,
    readSheetRange,
  };
});

vi.mock("@/lib/sheets/client", () => ({
  getGoogleSheetsClient: () => ({
    spreadsheets: {
      values: {
        update: sheetUpdate,
      },
    },
  }),
}));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({
    GOOGLE_SHEETS_SPREADSHEET_ID: "sheet-id",
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ from }),
}));

const slotRow = [
  "gb-morning",
  "2026-10-17",
  "10:00",
  "11:00",
  "TRUE",
  "40",
  "0",
  "35",
  "25",
  "",
  "6",
];

function query(result: { data: unknown; error: null }) {
  return {
    select() {
      return this;
    },
    update() {
      return this;
    },
    eq() {
      return this;
    },
    is: async () => ({ error: null }),
    maybeSingle: async () => result,
  };
}

describe("sheet tab split", () => {
  beforeEach(() => {
    readSheetRange.mockReset();
    sheetUpdate.mockReset();
    from.mockReset();
    sheetUpdate.mockResolvedValue({});
  });

  it("keeps day columns on dates and slot columns on Wejścia", () => {
    expect(SHEET_TABS.dates).toBe("dates");
    expect(SHEET_TABS.entrySlots).toBe("Wejścia");
    expect(SHEET_TABS.orders).toBe("orders");
    expect(SHEET_COLUMNS[SHEET_TABS.dates]).toBe(DATES_COLUMNS);
    expect(SHEET_COLUMNS[SHEET_TABS.entrySlots]).toBe(ENTRY_SLOT_COLUMNS);
    expect(DATES_COLUMNS.indexOf("sold_count")).toBe(3);
    expect(ENTRY_SLOT_COLUMNS.indexOf("sold_count")).toBe(6);
  });

  it("reads entry-slot availability from Wejścia", async () => {
    readSheetRange.mockResolvedValue([[...ENTRY_SLOT_COLUMNS], slotRow]);

    const response = await GET();

    expect(readSheetRange).toHaveBeenCalledWith(SHEET_TABS.entrySlots, "A:Z");
    expect(response.status).toBe(200);
  });

  it("keeps the entry-slot availability gate when the Wejścia header is not the slot header", async () => {
    readSheetRange.mockResolvedValue([[...DATES_COLUMNS]]);

    const response = await GET();

    expect(readSheetRange).toHaveBeenCalledWith(SHEET_TABS.entrySlots, "A:Z");
    expect(response.status).toBe(409);
  });

  it("reads the default entry-slot order sheet from Wejścia", async () => {
    readSheetRange.mockResolvedValue([]);

    await expect(
      createEntrySlotOrder({
        bookingDate: "2026-10-17",
        email: "visitor@example.test",
        normalQty: 1,
        reducedQty: 0,
        entrySlotId: "gb-morning",
        idempotencyKey: "tab-split",
        invoiceRequested: false,
      }),
    ).rejects.toBeInstanceOf(EntrySlotSheetError);

    expect(readSheetRange).toHaveBeenCalledWith(SHEET_TABS.entrySlots, "A:Z");
  });

  it("writes an entry-slot sold_count to Wejścia with the slot column index", async () => {
    readSheetRange.mockResolvedValue([[...ENTRY_SLOT_COLUMNS], slotRow]);
    from.mockImplementation((table: string) => {
      if (table === "orders") {
        return query({
          data: {
            id: "order-1",
            entry_slot_id: "gb-morning",
            payment_status: "paid",
          },
          error: null,
        });
      }

      if (table === "entry_slot_inventory") {
        return query({ data: { sold_qty: 4 }, error: null });
      }

      throw new Error(`unexpected table ${table}`);
    });

    await projectEntrySlotSoldCount("order-1");

    expect(readSheetRange).toHaveBeenCalledWith(SHEET_TABS.entrySlots, "A:Z");
    expect(sheetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: "sheet-id",
        range: `${SHEET_TABS.entrySlots}!G2`,
        requestBody: { values: [[4]] },
      }),
    );
  });

  it("uses an injected Wejścia sheet and skips the write when the header is the day header", async () => {
    const writes: number[] = [];
    from.mockImplementation((table: string) => {
      if (table === "orders") {
        return query({
          data: {
            id: "order-1",
            entry_slot_id: "gb-morning",
            payment_status: "paid",
          },
          error: null,
        });
      }

      if (table === "entry_slot_inventory") {
        return query({ data: { sold_qty: 4 }, error: null });
      }

      throw new Error(`unexpected table ${table}`);
    });

    await projectEntrySlotSoldCount("order-1", {
      readEntrySlotSheet: async () => [[...ENTRY_SLOT_COLUMNS], slotRow],
      writeEntrySlotSoldCount: async (_sheetRowNumber, soldCount) => {
        writes.push(soldCount);
      },
    });

    expect(writes).toEqual([4]);
    expect(readSheetRange).not.toHaveBeenCalled();
    expect(sheetUpdate).not.toHaveBeenCalled();

    await expect(
      projectEntrySlotSoldCount("order-1", {
        readEntrySlotSheet: async () => [[...DATES_COLUMNS]],
        writeEntrySlotSoldCount: async () => {
          writes.push(-1);
        },
      }),
    ).rejects.toThrow(/could not be updated/);

    expect(writes).toEqual([4]);
  });

  it("does not send a day-sheet dependency into the entry-slot projection", async () => {
    readSheetRange.mockResolvedValue([[...ENTRY_SLOT_COLUMNS], slotRow]);
    from.mockImplementation((table: string) => {
      if (table === "orders") {
        return query({
          data: {
            id: "order-1",
            booking_date: "2026-10-17",
            ticket_qty: 1,
            payment_status: "paid",
            entry_slot_id: "gb-morning",
            sheet_synced_at: null,
            day_sheet_qty: null,
          },
          error: null,
        });
      }

      if (table === "entry_slot_inventory") {
        return query({ data: { sold_qty: 4 }, error: null });
      }

      throw new Error(`unexpected table ${table}`);
    });

    await updateSoldCountForOrder("order-1", {
      readDateSheet: async () => {
        throw new Error("day sheet used");
      },
      writeSoldCount: async () => {
        throw new Error("day sheet used");
      },
    });

    expect(readSheetRange).toHaveBeenCalledWith(SHEET_TABS.entrySlots, "A:Z");
    expect(sheetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        range: `${SHEET_TABS.entrySlots}!G2`,
      }),
    );
  });

  it("keeps day sold_count reads and writes on dates", async () => {
    readSheetRange.mockResolvedValue([
      [...DATES_COLUMNS],
      ["2026-10-17", "TRUE", "40", "2", "35", "25", "", "6"],
    ]);
    from.mockImplementation((table: string) => {
      if (table === "orders") {
        return query({
          data: {
            id: "order-1",
            booking_date: "2026-10-17",
            ticket_qty: 1,
            entry_slot_id: null,
          },
          error: null,
        });
      }

      throw new Error(`unexpected table ${table}`);
    });

    await decreaseSoldCountForOrder("order-1");

    expect(readSheetRange).toHaveBeenCalledWith(SHEET_TABS.dates, "A:Z");
    expect(sheetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        range: `${SHEET_TABS.dates}!D2`,
        requestBody: { values: [[1]] },
      }),
    );
  });
});
