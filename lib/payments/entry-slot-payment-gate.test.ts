import { afterEach, expect, test } from "vitest";

import { POST as expireEntrySlotHolds } from "@/app/api/internal/entry-slots/expire/route";
import { OrderAlreadyRefundedError } from "@/lib/payments/errors";
import { processOrderRefund } from "@/lib/payments/process-order-refund";
import type { RefundP24PaymentResult } from "@/lib/payments/refund-p24-payment";

const originalSecret = process.env.ENTRY_SLOT_EXPIRE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.ENTRY_SLOT_EXPIRE_SECRET;
  } else {
    process.env.ENTRY_SLOT_EXPIRE_SECRET = originalSecret;
  }
});

test("the expiry route stays closed without a server secret", async () => {
  delete process.env.ENTRY_SLOT_EXPIRE_SECRET;

  const response = await expireEntrySlotHolds(
    new Request("http://localhost/api/internal/entry-slots/expire", {
      method: "POST",
      headers: { authorization: "Bearer phase2c-secret" },
    }),
  );

  expect(response.status).toBe(503);
});

test("the expiry route rejects a missing or wrong bearer token", async () => {
  process.env.ENTRY_SLOT_EXPIRE_SECRET = "phase2c-server-secret";

  const missing = await expireEntrySlotHolds(
    new Request("http://localhost/api/internal/entry-slots/expire", {
      method: "POST",
    }),
  );
  const wrong = await expireEntrySlotHolds(
    new Request("http://localhost/api/internal/entry-slots/expire", {
      method: "POST",
      headers: { authorization: "Bearer phase2c-other-secret" },
    }),
  );

  expect(missing.status).toBe(401);
  expect(wrong.status).toBe(401);
});

test("a day refund still decreases the date sheet and leaves slot release unused", async () => {
  let decreased = 0;
  let slotRefunds = 0;
  let providerRefunds = 0;
  const receipt: RefundP24PaymentResult = {
    orderId: "day-order",
    refundId: "refund-day",
    refundAmountMinor: 7000,
    refundReason: "Zwrot dzienny",
    refundedAt: "2026-10-11T12:00:00.000Z",
    p24: {
      requestId: "refund-day-order",
      refundsUuid: "refund-day",
      amount: 7000,
      currency: "PLN",
      items: [],
    },
  };

  await processOrderRefund("day-order", "Zwrot dzienny", {
    loadOrder: async () => ({
      id: "day-order",
      entry_slot_id: null,
      payment_status: "paid",
      refund_id: null,
      refund_amount_minor: null,
      refund_reason: null,
      refunded_at: null,
    }),
    refundPayment: async () => {
      providerRefunds += 1;
      return receipt;
    },
    finalizeDayRefund: async () => {},
    decreaseSoldCount: async () => {
      decreased += 1;
    },
    completeSlotRefund: async () => {
      slotRefunds += 1;
    },
    sendRefundEmail: async () => {},
  });

  expect(providerRefunds).toBe(1);
  expect(decreased).toBe(1);
  expect(slotRefunds).toBe(0);
});

test("a repeated day refund stops before another provider call", async () => {
  let providerRefunds = 0;

  await expect(
    processOrderRefund("day-order", undefined, {
      loadOrder: async () => ({
        id: "day-order",
        entry_slot_id: null,
        payment_status: "refunded",
        refund_id: "refund-day",
        refund_amount_minor: 7000,
        refund_reason: "Zwrot dzienny",
        refunded_at: "2026-10-11T12:00:00.000Z",
      }),
      refundPayment: async () => {
        providerRefunds += 1;
        throw new Error("provider should not be called");
      },
      decreaseSoldCount: async () => {
        throw new Error("sheet should not be called");
      },
      completeSlotRefund: async () => {
        throw new Error("slot release should not be called");
      },
      sendRefundEmail: async () => {},
    }),
  ).rejects.toBeInstanceOf(OrderAlreadyRefundedError);

  expect(providerRefunds).toBe(0);
});
