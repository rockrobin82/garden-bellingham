import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/orders/route";
import {
  bodyRequestsEntrySlot,
  isEntrySlotOrderRequest,
} from "@/lib/orders/entry-slot-order-request";
import { createEntrySlotOrder } from "@/lib/orders/create-entry-slot-order";
import {
  EntrySlotCapacityError,
  EntrySlotSheetError,
  EntrySlotUnavailableError,
} from "@/lib/orders/errors";
import { mapEntrySlotRpcError } from "@/lib/orders/map-entry-slot-rpc-error";
import { ENTRY_SLOT_COLUMNS } from "@/lib/sheets/schema";
import {
  parseCreateEntrySlotOrderRequest,
  parseCreateOrderRequest,
} from "@/lib/validation/orders";

const dayRequest = {
  bookingDate: "2026-10-17",
  email: "visitor@example.test",
  normalQty: 1,
  reducedQty: 0,
  invoiceRequested: false,
};

describe("public entry-slot checkout gate", () => {
  it("keeps a day order request on the existing contract", () => {
    const parsed = parseCreateOrderRequest(dayRequest);

    expect(parsed).toEqual(dayRequest);
    expect(isEntrySlotOrderRequest(parsed)).toBe(false);
    expect(bodyRequestsEntrySlot(dayRequest)).toBe(false);
  });

  it("rejects an entry slot on the public order route", async () => {
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dayRequest,
          entrySlotId: "phase2b-morning",
          idempotencyKey: "phase2b-public-gate",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Entry slot checkout is not available",
    });
  });

  it("rejects an empty ticket quantity before any reservation", () => {
    expect(() =>
      parseCreateEntrySlotOrderRequest({
        ...dayRequest,
        normalQty: 0,
        reducedQty: 0,
        entrySlotId: "phase2b-morning",
        idempotencyKey: "phase2b-zero-qty",
      }),
    ).toThrow(/At least one ticket is required/);
  });

  it("rejects a fractional quantity", () => {
    expect(() =>
      parseCreateEntrySlotOrderRequest({
        ...dayRequest,
        normalQty: 1.5,
        entrySlotId: "phase2b-morning",
        idempotencyKey: "phase2b-fraction",
      }),
    ).toThrow(/expected int|Invalid/i);
  });
});

describe("overlapping entry slots", () => {
  it("stops order creation before the database is used", async () => {
    const header = [...ENTRY_SLOT_COLUMNS];
    const morning = [
      "morning",
      "2026-10-17",
      "10:00",
      "14:00",
      "TRUE",
      "40",
      "0",
      "35",
      "25",
      "",
      "6",
    ];
    const overlap = [
      "late",
      "2026-10-17",
      "13:00",
      "16:00",
      "TRUE",
      "40",
      "0",
      "35",
      "25",
      "",
      "6",
    ];

    await expect(
      createEntrySlotOrder(
        {
          bookingDate: "2026-10-17",
          email: "visitor@example.test",
          normalQty: 1,
          reducedQty: 0,
          entrySlotId: "morning",
          idempotencyKey: "overlap-key-1",
          invoiceRequested: false,
        },
        {
          supabase: {
            from() {
              throw new Error("database used");
            },
          } as never,
          readEntrySlotSheet: async () => [header, morning, overlap],
        },
      ),
    ).rejects.toBeInstanceOf(EntrySlotSheetError);
  });
});

describe("mapEntrySlotRpcError", () => {
  it("hides database and credential details", () => {
    const error = mapEntrySlotRpcError(
      new Error(
        "connect postgres://postgres:secret@db.example/postgres eyJhbGciOiJIUzI1NiJ9",
      ),
    );

    expect(error).toBeInstanceOf(EntrySlotUnavailableError);
    expect(error.message).toBe("Ordering is temporarily unavailable");
    expect(error.message).not.toMatch(/postgres:\/\/|secret|eyJ/);
  });

  it("maps capacity and inactive slot failures", () => {
    expect(mapEntrySlotRpcError(new Error("INSUFFICIENT_CAPACITY"))).toBeInstanceOf(
      EntrySlotCapacityError,
    );
    expect(mapEntrySlotRpcError(new Error("SLOT_INACTIVE")).message).toBe(
      "Entry slot is not available",
    );
    expect(
      mapEntrySlotRpcError(
        new Error("LIMIT_BELOW_COMMITTED: committed 4 exceeds requested limit 2"),
      ).message,
    ).toBe("Entry slot limit cannot be applied");
  });
});
