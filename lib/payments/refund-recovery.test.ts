import { expect, test } from "vitest";

import {
  RefundInProgressError,
  RefundOutcomeUnknownError,
  RefundRejectedError,
} from "@/lib/payments/errors";
import { processOrderRefund } from "@/lib/payments/process-order-refund";
import { refundP24Payment } from "@/lib/payments/refund-p24-payment";
import {
  readRefundRecovery,
  type ProviderRefundLookup,
  type RefundRecoveryRecord,
} from "@/lib/payments/refund-recovery";
import { P24NetworkError, P24RefundRejectedError } from "@/lib/przelewy24";

const orderId = "11111111-1111-4111-8111-111111111111";

function completed(amount = 6000): ProviderRefundLookup {
  return {
    outcome: "listed",
    refunds: [{ requestId: `refund-${orderId}`, status: 1, amount }],
  };
}

function store() {
  let metadata: Record<string, unknown> = {
    entry_slot_reservation: "held",
  };
  let submits = 0;

  return {
    submits: () => submits,
    recovery: () => readRefundRecovery(metadata),
    metadata: () => metadata,
    seed(record: RefundRecoveryRecord) {
      metadata = {
        ...metadata,
        refund_recovery: record,
      };
    },
    async run(
      lookups: ProviderRefundLookup[],
      submit?: () => Promise<never> | void,
    ) {
      const queue = [...lookups];

      return refundP24Payment(orderId, "Zwrot testowy", {
        loadOrder: async () => ({
          id: orderId,
          booking_date: "2026-10-18",
          customer_email: "visitor@example.test",
          ticket_qty: 2,
          total_amount_minor: 6000,
          payment_status: "paid",
          p24_session_id: orderId,
          p24_order_id: "424242",
          payment_metadata: metadata,
        }),
        claimRecovery: async (_id, record, expectedStates) => {
          const current = readRefundRecovery(metadata);
          const token = current?.state ?? "none";

          if (!expectedStates.includes(token)) {
            return {
              claimed: false,
              paymentStatus: "paid",
              metadata,
            };
          }

          metadata = {
            ...metadata,
            refund_recovery: record,
          };

          return {
            claimed: true,
            paymentStatus: "paid",
            metadata,
          };
        },
        lookupRefunds: async () => {
          const next = queue.shift();

          if (!next) {
            throw new Error("missing lookup");
          }

          return next;
        },
        submitRefund: async () => {
          submits += 1;

          if (submit) {
            await submit();
          }

          return {
            requestId: `refund-${orderId}`,
            refundsUuid: orderId,
            amount: 6000,
            currency: "PLN",
            items: [],
          };
        },
      });
    },
  };
}

test("a completed lookup finalizes without sending a refund", async () => {
  const refunds = store();
  const result = await refunds.run([completed()]);

  expect(refunds.submits()).toBe(0);
  expect(result.refundAmountMinor).toBe(6000);
  expect(result.p24.requestId).toBe(`refund-${orderId}`);
  expect(refunds.recovery()?.state).toBe("accepted");
  expect(refunds.metadata().entry_slot_reservation).toBe("held");
});

test("an unavailable lookup does not send a refund", async () => {
  const refunds = store();

  await expect(refunds.run([{ outcome: "unavailable" }])).rejects.toBeInstanceOf(
    RefundOutcomeUnknownError,
  );
  expect(refunds.submits()).toBe(0);
  expect(refunds.recovery()).toBeNull();
  expect(refunds.metadata().entry_slot_reservation).toBe("held");
});

test("a timeout is not followed by another send while lookup stays unavailable", async () => {
  const refunds = store();

  await expect(
    refunds.run([{ outcome: "not_found" }], () => {
      throw new P24NetworkError("timeout");
    }),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);
  expect(refunds.submits()).toBe(1);
  expect(refunds.recovery()?.state).toBe("unknown");

  await expect(refunds.run([{ outcome: "unavailable" }])).rejects.toBeInstanceOf(
    RefundOutcomeUnknownError,
  );
  expect(refunds.submits()).toBe(1);
});

test("a later not-found lookup does not send again after an unknown result", async () => {
  const refunds = store();

  await expect(
    refunds.run([{ outcome: "not_found" }], () => {
      throw new P24NetworkError("timeout");
    }),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);

  await expect(refunds.run([{ outcome: "not_found" }])).rejects.toBeInstanceOf(
    RefundOutcomeUnknownError,
  );
  expect(refunds.submits()).toBe(1);
  expect(refunds.recovery()?.state).toBe("unknown");

  await refunds.run([completed()]);
  expect(refunds.submits()).toBe(1);
  expect(refunds.recovery()?.state).toBe("accepted");
});

test("a crash after the claim and before the provider call can send once", async () => {
  const refunds = store();
  refunds.seed({
    state: "dispatching",
    requestId: `refund-${orderId}`,
    refundsUuid: orderId,
    p24OrderId: "424242",
    sessionId: orderId,
    amountMinor: 6000,
    reason: "Zwrot testowy",
  });

  await refunds.run([{ outcome: "not_found" }, completed()]);
  expect(refunds.submits()).toBe(1);
  expect(refunds.recovery()?.state).toBe("accepted");
});

test("a second claim loses and does not send", async () => {
  const refunds = store();
  let claims = 0;
  let sends = 0;
  const shared = refunds;

  const run = () =>
    refundP24Payment(orderId, "Zwrot testowy", {
      loadOrder: async () => ({
        id: orderId,
        booking_date: "2026-10-18",
        customer_email: "visitor@example.test",
        ticket_qty: 2,
        total_amount_minor: 6000,
        payment_status: "paid",
        p24_session_id: orderId,
        p24_order_id: "424242",
        payment_metadata: shared.metadata(),
      }),
      claimRecovery: async (_id, record, expectedStates) => {
        const current = readRefundRecovery(shared.metadata());
        const token = current?.state ?? "none";
        claims += 1;

        if (!expectedStates.includes(token)) {
          return {
            claimed: false,
            paymentStatus: "paid",
            metadata: shared.metadata(),
          };
        }

        const metadata = {
          ...shared.metadata(),
          refund_recovery: record,
        };
        shared.seed(record);

        return {
          claimed: true,
          paymentStatus: "paid",
          metadata,
        };
      },
      lookupRefunds: async () => ({ outcome: "not_found" }),
      submitRefund: async () => {
        sends += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          requestId: `refund-${orderId}`,
          refundsUuid: orderId,
          amount: 6000,
          currency: "PLN",
          items: [],
        };
      },
    });

  const results = await Promise.allSettled([run(), run()]);
  const rejected = results.filter((result) => result.status === "rejected");

  expect(claims).toBeGreaterThan(1);
  expect(sends).toBe(1);
  expect(rejected.some((result) => result.reason instanceof RefundInProgressError)).toBe(
    true,
  );
});

test("a provider acknowledgement waits until status is completed", async () => {
  const refunds = store();

  await expect(
    refunds.run([
      { outcome: "not_found" },
      {
        outcome: "listed",
        refunds: [{ requestId: `refund-${orderId}`, status: 2, amount: 6000 }],
      },
    ]),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);
  expect(refunds.submits()).toBe(1);
  expect(refunds.recovery()?.state).toBe("pending_at_provider");

  await expect(
    refunds.run([
      {
        outcome: "listed",
        refunds: [{ requestId: `refund-${orderId}`, status: 3, amount: 6000 }],
      },
    ]),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);
  expect(refunds.submits()).toBe(1);

  const result = await refunds.run([completed()]);
  expect(result.orderId).toBe(orderId);
  expect(refunds.submits()).toBe(1);
});

test("a successful send with a lost confirmation does not send again", async () => {
  const refunds = store();

  await expect(
    refunds.run([{ outcome: "not_found" }, { outcome: "unavailable" }]),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);
  expect(refunds.recovery()?.state).toBe("submitted");

  await expect(refunds.run([{ outcome: "not_found" }])).rejects.toBeInstanceOf(
    RefundOutcomeUnknownError,
  );
  expect(refunds.submits()).toBe(1);
  expect(refunds.recovery()?.state).toBe("submitted");

  await refunds.run([completed()]);
  expect(refunds.submits()).toBe(1);
  expect(refunds.recovery()?.state).toBe("accepted");
});

test("a definite provider rejection does not release a local refund", async () => {
  const refunds = store();

  await expect(
    refunds.run([{ outcome: "not_found" }], () => {
      throw new P24RefundRejectedError("rejected by operator");
    }),
  ).rejects.toBeInstanceOf(RefundRejectedError);
  expect(refunds.recovery()?.state).toBe("rejected");
  expect(refunds.submits()).toBe(1);
});

test("an amount mismatch stays for manual reconciliation and a full panel refund completes", async () => {
  const mismatch = store();

  await expect(mismatch.run([completed(100)])).rejects.toBeInstanceOf(
    RefundOutcomeUnknownError,
  );
  expect(mismatch.submits()).toBe(0);
  expect(mismatch.recovery()?.state).toBe("manual_review");

  const panel = store();
  const result = await panel.run([
    {
      outcome: "listed",
      refunds: [{ requestId: "", status: 1, amount: 6000 }],
    },
  ]);

  expect(panel.submits()).toBe(0);
  expect(result.refundAmountMinor).toBe(6000);
  expect(panel.recovery()).toMatchObject({
    state: "accepted",
    matchedBy: "amount",
  });
});

test("an unknown refund does not update day or slot counters", async () => {
  let decreased = 0;
  let released = 0;

  await expect(
    processOrderRefund(orderId, "Zwrot testowy", {
      loadOrder: async () => ({
        id: orderId,
        entry_slot_id: null,
        payment_status: "paid",
        refund_id: null,
        refund_amount_minor: null,
        refund_reason: null,
        refunded_at: null,
      }),
      refundPayment: async () => {
        throw new RefundOutcomeUnknownError();
      },
      decreaseSoldCount: async () => {
        decreased += 1;
      },
      completeSlotRefund: async () => {
        released += 1;
      },
      finalizeDayRefund: async () => {
        throw new Error("day finalize");
      },
      sendRefundEmail: async () => {
        throw new Error("mail");
      },
    }),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);

  expect(decreased).toBe(0);
  expect(released).toBe(0);
});

test("a mail failure leaves a saved refund in place", async () => {
  let finalized = 0;
  let decreased = 0;
  const saved: RefundRecoveryRecord = {
    state: "accepted",
    requestId: `refund-${orderId}`,
    refundsUuid: orderId,
    p24OrderId: "424242",
    sessionId: orderId,
    amountMinor: 6000,
    reason: "Zwrot testowy",
  };

  await expect(
    processOrderRefund(orderId, "Zwrot testowy", {
      loadOrder: async () => ({
        id: orderId,
        entry_slot_id: null,
        payment_status: "paid",
        refund_id: null,
        refund_amount_minor: null,
        refund_reason: null,
        refunded_at: null,
      }),
      refundPayment: async () => ({
        orderId,
        refundId: orderId,
        refundAmountMinor: 6000,
        refundReason: saved.reason,
        refundedAt: "2026-10-11T12:00:00.000Z",
        p24: {
          requestId: saved.requestId,
          refundsUuid: orderId,
          amount: 6000,
          currency: "PLN",
          items: [],
        },
      }),
      finalizeDayRefund: async () => {
        finalized += 1;
      },
      decreaseSoldCount: async () => {
        decreased += 1;
      },
      completeSlotRefund: async () => {
        throw new Error("slot path");
      },
      sendRefundEmail: async () => {
        throw new Error("mailbox unavailable");
      },
    }),
  ).resolves.toMatchObject({ orderId, refundAmountMinor: 6000 });

  expect(finalized).toBe(1);
  expect(decreased).toBe(1);
});

test("repeated review notifications are acknowledged without fulfillment", async () => {
  const { entrySlotNotificationDisposition } = await import(
    "@/lib/payments/handle-p24-webhook"
  );

  expect(entrySlotNotificationDisposition("review")).toBe("acknowledge");
  expect(entrySlotNotificationDisposition("review")).toBe("acknowledge");
  expect(entrySlotNotificationDisposition("refunded")).toBe("acknowledge");
  expect(entrySlotNotificationDisposition("paid")).toBe("fulfill");
  expect(entrySlotNotificationDisposition("pending")).toBe("verify");
});
