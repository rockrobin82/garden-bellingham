import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import { createEntrySlotOrder } from "@/lib/orders/create-entry-slot-order";
import { EntrySlotUnavailableError } from "@/lib/orders/errors";
import {
  applyVerifiedEntrySlotPayment,
  type ApplyVerifiedEntrySlotPaymentDependencies,
} from "@/lib/payments/apply-verified-entry-slot-payment";
import { completeEntrySlotRefund } from "@/lib/payments/complete-entry-slot-refund";
import { createP24Payment } from "@/lib/payments/create-p24-payment";
import { OrderNotPayableError } from "@/lib/payments/errors";
import { refundP24Payment } from "@/lib/payments/refund-p24-payment";
import {
  processOrderRefund,
  type RefundOrderRecord,
} from "@/lib/payments/process-order-refund";
import { runExpireEntrySlotHolds } from "@/lib/reservations/expire-entry-slot-holds";
import {
  projectEntrySlotSoldCount,
  repairEntrySlotSoldCount,
} from "@/lib/sheets/project-entry-slot-sold-count";
import { ENTRY_SLOT_COLUMNS } from "@/lib/sheets/schema";
import { decreaseSoldCountForOrder } from "@/lib/sheets/update-sold-count";
import { insertOrderTickets } from "@/lib/tickets/insert-order-tickets";
import type { CreateEntrySlotOrderRequest } from "@/types/booking";
import type { Database } from "@/types/database";
import type { RefundP24PaymentResult } from "@/lib/payments/refund-p24-payment";

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseUrl =
  process.env.ENTRY_SLOT_TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey =
  process.env.ENTRY_SLOT_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const emailLike = "phase2c-%@example.test";
const slotId = "phase2c-morning";

type SlotCells = Record<(typeof ENTRY_SLOT_COLUMNS)[number], string>;

const morning: SlotCells = {
  slot_id: slotId,
  date: "2026-10-18",
  time_start: "10:00",
  time_end: "14:00",
  active: "TRUE",
  ticket_limit: "40",
  sold_count: "100",
  price_normal: "35",
  price_reduced: "25",
  note: "",
  max_tickets_per_order: "6",
};

let pg: Client;
let supabase: SupabaseClient<Database>;

function assertLocalTestTarget(): void {
  const databaseHost = new URL(databaseUrl).hostname;
  const apiHost = new URL(supabaseUrl).hostname;

  if (
    (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") ||
    (apiHost !== "127.0.0.1" && apiHost !== "localhost")
  ) {
    throw new Error("Refusing to run entry-slot payment tests against a non-local database");
  }
}

function sheet(rows: SlotCells[]): string[][] {
  return [
    [...ENTRY_SLOT_COLUMNS],
    ...rows.map((row) => ENTRY_SLOT_COLUMNS.map((column) => row[column])),
  ];
}

function request(
  overrides: Partial<CreateEntrySlotOrderRequest> = {},
): CreateEntrySlotOrderRequest {
  return {
    bookingDate: "2026-10-18",
    email: "phase2c-visitor@example.test",
    normalQty: 1,
    reducedQty: 1,
    entrySlotId: slotId,
    idempotencyKey: "phase2c-default-key",
    invoiceRequested: false,
    ...overrides,
  };
}

async function cleanup(): Promise<void> {
  await pg.query(
    `delete from public.tickets
     where order_id in (select id from public.orders where customer_email like $1)`,
    [emailLike],
  );
  await pg.query(
    `delete from public.entry_slot_holds
     where order_id in (select id from public.orders where customer_email like $1)`,
    [emailLike],
  );
  await pg.query(`delete from public.orders where customer_email like $1`, [emailLike]);
  await pg.query(`delete from public.entry_slot_inventory where slot_id = $1`, [slotId]);
}

async function inventory(): Promise<{ held_qty: number; sold_qty: number }> {
  const result = await pg.query(
    `select held_qty, sold_qty from public.entry_slot_inventory where slot_id = $1`,
    [slotId],
  );
  return result.rows[0];
}

async function orderState(orderId: string): Promise<{
  payment_status: string;
  paid_at: string | null;
  p24_order_id: string | null;
  refund_id: string | null;
  manual_review_reason: string | null;
  entry_slot_id: string | null;
}> {
  const result = await pg.query(
    `select payment_status, paid_at::text, p24_order_id, refund_id, entry_slot_id,
            payment_metadata->>'manual_review_reason' as manual_review_reason
     from public.orders where id = $1`,
    [orderId],
  );
  return result.rows[0];
}

async function holdStatus(orderId: string): Promise<string | null> {
  const result = await pg.query(
    `select status from public.entry_slot_holds where order_id = $1`,
    [orderId],
  );
  return result.rows[0]?.status ?? null;
}

async function ticketCount(orderId: string): Promise<number> {
  const result = await pg.query(
    `select count(*)::int as count from public.tickets where order_id = $1`,
    [orderId],
  );
  return result.rows[0].count;
}

async function ageHold(orderId: string): Promise<void> {
  await pg.query(
    `update public.entry_slot_holds
     set expires_at = now() - interval '1 minute'
     where order_id = $1`,
    [orderId],
  );
}

async function createHeldOrder(email: string, idempotencyKey: string): Promise<string> {
  const created = await createEntrySlotOrder(
    request({ email, idempotencyKey }),
    { supabase, readEntrySlotSheet: async () => sheet([morning]) },
  );
  return created.orderId;
}

function verifiedPayment(orderId: string, amountMinor = 6000) {
  return {
    orderId,
    p24OrderId: `p24-${orderId.slice(0, 8)}`,
    p24SessionId: orderId,
    amountMinor,
  };
}

function fulfillment(
  overrides: Partial<ApplyVerifiedEntrySlotPaymentDependencies> = {},
): ApplyVerifiedEntrySlotPaymentDependencies {
  return {
    supabase,
    generateTickets: (orderId: string) => insertOrderTickets(supabase, orderId),
    syncSheet: async () => {},
    sendEmail: async () => {},
    sendInvoiceEmails: async () => {},
    ...overrides,
  };
}

function refundReceipt(
  orderId: string,
  amountMinor: number,
): RefundP24PaymentResult {
  return {
    orderId,
    refundId: `refund-${orderId}`,
    refundAmountMinor: amountMinor,
    refundReason: "Zwrot testowy",
    refundedAt: "2026-10-11T12:00:00.000Z",
    p24: {
      requestId: `refund-${orderId}`,
      refundsUuid: `refund-${orderId}`,
      amount: amountMinor,
      currency: "PLN",
      items: [],
    },
  };
}

async function loadRefundOrder(orderId: string): Promise<RefundOrderRecord> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, entry_slot_id, payment_status, refund_id, refund_amount_minor, refund_reason, refunded_at",
    )
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw error ?? new Error("missing order");
  }

  return data;
}

beforeAll(async () => {
  assertLocalTestTarget();
  pg = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
  await pg.connect();
  supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  if (!pg) {
    return;
  }

  try {
    await cleanup();
  } finally {
    await pg.end();
  }
});

test("starts payment only for a pending order with an active hold", async () => {
  const orderId = await createHeldOrder("phase2c-pay@example.test", "phase2c-pay");
  const registered: Array<{ orderId: string; amountMinor: number }> = [];

  const first = await createP24Payment(orderId, {
    supabase,
    registerTransaction: async (input) => {
      registered.push({ orderId: input.orderId, amountMinor: input.amountMinor });
      return { token: "token-phase2c", redirectUrl: "https://example.test/pay" };
    },
  });

  expect(first.token).toBe("token-phase2c");
  expect(registered).toEqual([{ orderId, amountMinor: 6000 }]);

  await ageHold(orderId);
  await runExpireEntrySlotHolds({ supabase, slotId });

  await expect(
    createP24Payment(orderId, {
      supabase,
      registerTransaction: async () => {
        throw new Error("register should not run");
      },
    }),
  ).rejects.toBeInstanceOf(OrderNotPayableError);
  expect(await holdStatus(orderId)).toBe("expired");
});

test("a day order can start payment without an entry-slot hold", async () => {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      booking_date: "2026-10-18",
      customer_email: "phase2c-day@example.test",
      ticket_qty: 2,
      normal_qty: 2,
      reduced_qty: 0,
      unit_price_minor: 3500,
      total_amount_minor: 7000,
      payment_status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("day order insert failed");
  }

  const registered: number[] = [];
  await createP24Payment(data.id, {
    supabase,
    registerTransaction: async (input) => {
      registered.push(input.amountMinor);
      return { token: "token-day", redirectUrl: "https://example.test/day" };
    },
  });

  expect(registered).toEqual([7000]);
  expect(await inventory()).toBeUndefined();
});

test("confirms a verified payment once and keeps the stored total", async () => {
  const orderId = await createHeldOrder("phase2c-paid@example.test", "phase2c-paid");
  const payment = verifiedPayment(orderId);

  expect(await applyVerifiedEntrySlotPayment(payment, fulfillment())).toBe("paid");
  expect(await applyVerifiedEntrySlotPayment(payment, fulfillment())).toBe("paid");

  expect(await orderState(orderId)).toMatchObject({
    payment_status: "paid",
    p24_order_id: payment.p24OrderId,
    entry_slot_id: slotId,
    refund_id: null,
  });
  expect(await holdStatus(orderId)).toBe("confirmed");
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 2 });
  expect(await ticketCount(orderId)).toBe(2);

  const totals = await pg.query(
    `select total_amount_minor from public.orders where id = $1`,
    [orderId],
  );
  expect(totals.rows[0].total_amount_minor).toBe(6000);
});

test("lets one of two concurrent finalizations sell the seats and create one ticket set", async () => {
  const orderId = await createHeldOrder("phase2c-race@example.test", "phase2c-race");
  const payment = verifiedPayment(orderId);
  const results = await Promise.allSettled([
    applyVerifiedEntrySlotPayment(payment, fulfillment()),
    applyVerifiedEntrySlotPayment(payment, fulfillment()),
  ]);

  expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  expect(await orderState(orderId)).toMatchObject({ payment_status: "paid" });
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 2 });
  expect(await ticketCount(orderId)).toBe(2);
  expect(await holdStatus(orderId)).toBe("confirmed");
});

test("keeps a verified payment for manual review when the hold is inactive", async () => {
  const orderId = await createHeldOrder("phase2c-late@example.test", "phase2c-late");
  await ageHold(orderId);
  expect(await runExpireEntrySlotHolds({ supabase, slotId })).toBe(1);

  const payment = verifiedPayment(orderId);
  expect(await applyVerifiedEntrySlotPayment(payment, fulfillment())).toBe("review");
  expect(await applyVerifiedEntrySlotPayment(payment, fulfillment())).toBe("review");

  expect(await orderState(orderId)).toMatchObject({
    payment_status: "review",
    paid_at: null,
    p24_order_id: payment.p24OrderId,
    manual_review_reason: "HOLD_INACTIVE",
    refund_id: null,
  });
  expect(await ticketCount(orderId)).toBe(0);
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 0 });
  expect(await holdStatus(orderId)).toBe("expired");
});

test("retries a temporary reservation error without moving seats twice", async () => {
  const orderId = await createHeldOrder("phase2c-retry@example.test", "phase2c-retry");
  const payment = verifiedPayment(orderId);

  await expect(
    applyVerifiedEntrySlotPayment(payment, {
      ...fulfillment(),
      confirmHold: async () => {
        throw new Error("connection reset by peer");
      },
    }),
  ).rejects.toBeInstanceOf(EntrySlotUnavailableError);

  expect(await orderState(orderId)).toMatchObject({ payment_status: "pending" });
  expect(await inventory()).toMatchObject({ held_qty: 2, sold_qty: 0 });
  expect(await ticketCount(orderId)).toBe(0);

  expect(await applyVerifiedEntrySlotPayment(payment, fulfillment())).toBe("paid");
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 2 });
  expect(await ticketCount(orderId)).toBe(2);
});

test("keeps a paid order when tickets fail and creates them once on retry", async () => {
  const orderId = await createHeldOrder("phase2c-tickets@example.test", "phase2c-tickets");
  let failed = false;

  await expect(
    applyVerifiedEntrySlotPayment(
      verifiedPayment(orderId),
      fulfillment({
        generateTickets: async (paidOrderId: string) => {
          if (!failed) {
            failed = true;
            throw new Error("ticket insert failed");
          }
          await insertOrderTickets(supabase, paidOrderId);
        },
      }),
    ),
  ).rejects.toThrow(/ticket insert failed/);

  expect(await orderState(orderId)).toMatchObject({ payment_status: "paid" });
  expect(await inventory()).toMatchObject({ sold_qty: 2 });
  expect(await ticketCount(orderId)).toBe(0);

  expect(
    await applyVerifiedEntrySlotPayment(verifiedPayment(orderId), fulfillment()),
  ).toBe("paid");
  expect(await ticketCount(orderId)).toBe(2);
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 2 });
});

test("saves a confirmed payment when the email send fails", async () => {
  const orderId = await createHeldOrder("phase2c-mail@example.test", "phase2c-mail");
  const payment = verifiedPayment(orderId);
  let emails = 0;

  await expect(
    applyVerifiedEntrySlotPayment(
      payment,
      fulfillment({
        sendEmail: async () => {
          emails += 1;
          throw new Error("mailbox unavailable");
        },
      }),
    ),
  ).rejects.toThrow(/mailbox unavailable/);

  expect(await orderState(orderId)).toMatchObject({ payment_status: "paid" });
  expect(await inventory()).toMatchObject({ sold_qty: 2 });
  expect(await ticketCount(orderId)).toBe(2);

  expect(await applyVerifiedEntrySlotPayment(payment, fulfillment())).toBe("paid");
  expect(emails).toBe(1);
  expect(await ticketCount(orderId)).toBe(2);
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 2 });
});

test("resumes after a crash between confirmation and marking the order paid", async () => {
  const orderId = await createHeldOrder("phase2c-crash@example.test", "phase2c-crash");
  const payment = verifiedPayment(orderId);

  await expect(
    applyVerifiedEntrySlotPayment(payment, {
      ...fulfillment(),
      beforeMarkPaid: () => {
        throw new Error("crash before paid");
      },
    }),
  ).rejects.toThrow(/crash before paid/);

  expect(await orderState(orderId)).toMatchObject({
    payment_status: "pending",
    paid_at: null,
  });
  expect(await holdStatus(orderId)).toBe("confirmed");
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 2 });
  expect(await ticketCount(orderId)).toBe(0);

  expect(await applyVerifiedEntrySlotPayment(payment, fulfillment())).toBe("paid");
  expect(await orderState(orderId)).toMatchObject({ payment_status: "paid" });
  expect(await ticketCount(orderId)).toBe(2);
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 2 });
});

test("refunds a slot order once and does not decrease the day sheet counter", async () => {
  const orderId = await createHeldOrder("phase2c-refund@example.test", "phase2c-refund");
  await applyVerifiedEntrySlotPayment(verifiedPayment(orderId), fulfillment());

  const rows = sheet([morning]);
  const writes: number[] = [];
  const soldIndex = ENTRY_SLOT_COLUMNS.indexOf("sold_count");
  let refundCalls = 0;
  let dayDecreases = 0;

  const dependencies = {
    loadOrder: loadRefundOrder,
    refundPayment: async () => {
      refundCalls += 1;
      return refundReceipt(orderId, 6000);
    },
    decreaseSoldCount: async () => {
      dayDecreases += 1;
    },
    completeSlotRefund: (input: {
      orderId: string;
      refundId: string;
      refundAmountMinor: number;
      refundReason: string;
      refundedAt: string;
    }) =>
      completeEntrySlotRefund(input, {
        supabase,
        readEntrySlotSheet: async () => rows,
        writeEntrySlotSoldCount: async (sheetRowNumber, soldCount) => {
          writes.push(soldCount);
          rows[sheetRowNumber - 1][soldIndex] = String(soldCount);
        },
      }),
    finalizeDayRefund: async () => {
      throw new Error("day refund path");
    },
    sendRefundEmail: async () => {},
  };

  await processOrderRefund(orderId, "Zwrot testowy", dependencies);
  await processOrderRefund(orderId, "Zwrot testowy", dependencies);

  expect(refundCalls).toBe(1);
  expect(dayDecreases).toBe(0);
  expect(writes).toEqual([0]);
  expect(await orderState(orderId)).toMatchObject({
    payment_status: "refunded",
    refund_id: `refund-${orderId}`,
  });
  expect(await holdStatus(orderId)).toBe("released");
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 0 });

  const tickets = await pg.query(
    `select status from public.tickets where order_id = $1`,
    [orderId],
  );
  expect(tickets.rows.every((row) => row.status === "cancelled")).toBe(true);

  await expect(decreaseSoldCountForOrder(orderId, supabase)).rejects.toThrow(
    /entry-slot order/,
  );
});

test("two concurrent slot refunds release the hold once", async () => {
  const orderId = await createHeldOrder(
    "phase2c-parallel-release@example.test",
    "phase2c-parallel-release",
  );
  await applyVerifiedEntrySlotPayment(verifiedPayment(orderId), fulfillment());

  const rows = sheet([morning]);
  const soldIndex = ENTRY_SLOT_COLUMNS.indexOf("sold_count");
  const input = {
    orderId,
    refundId: `refund-${orderId}`,
    refundAmountMinor: 6000,
    refundReason: "Zwrot testowy",
    refundedAt: "2026-10-11T12:00:00.000Z",
  };
  const dependencies = {
    supabase,
    readEntrySlotSheet: async () => rows,
    writeEntrySlotSoldCount: async (sheetRowNumber: number, soldCount: number) => {
      rows[sheetRowNumber - 1][soldIndex] = String(soldCount);
    },
  };

  await Promise.all([
    completeEntrySlotRefund(input, dependencies),
    completeEntrySlotRefund(input, dependencies),
  ]);

  expect(await holdStatus(orderId)).toBe("released");
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 0 });
  expect(await orderState(orderId)).toMatchObject({ payment_status: "refunded" });
});

test("records a provider-completed refund without sending it again", async () => {
  const orderId = await createHeldOrder(
    "phase2c-refund-lookup@example.test",
    "phase2c-refund-lookup",
  );
  await applyVerifiedEntrySlotPayment(
    { ...verifiedPayment(orderId), p24OrderId: "424242" },
    fulfillment(),
  );

  const rows = sheet([morning]);
  const writes: number[] = [];
  const soldIndex = ENTRY_SLOT_COLUMNS.indexOf("sold_count");
  let submits = 0;

  const dependencies = {
    loadOrder: loadRefundOrder,
    refundPayment: (id: string, reason?: string) =>
      refundP24Payment(id, reason, {
        supabase,
        lookupRefunds: async () => ({
          outcome: "listed" as const,
          refunds: [{ requestId: `refund-${orderId}`, status: 1, amount: 6000 }],
        }),
        submitRefund: async () => {
          submits += 1;
          throw new Error("provider submit");
        },
      }),
    decreaseSoldCount: async () => {
      throw new Error("day refund path");
    },
    completeSlotRefund: (input: {
      orderId: string;
      refundId: string;
      refundAmountMinor: number;
      refundReason: string;
      refundedAt: string;
    }) =>
      completeEntrySlotRefund(input, {
        supabase,
        readEntrySlotSheet: async () => rows,
        writeEntrySlotSoldCount: async (sheetRowNumber, soldCount) => {
          writes.push(soldCount);
          rows[sheetRowNumber - 1][soldIndex] = String(soldCount);
        },
      }),
    finalizeDayRefund: async () => {
      throw new Error("day refund path");
    },
    sendRefundEmail: async () => {
      throw new Error("mailbox unavailable");
    },
  };

  await processOrderRefund(orderId, "Zwrot testowy", dependencies);
  await processOrderRefund(orderId, "Zwrot testowy", dependencies);

  expect(submits).toBe(0);
  expect(writes).toEqual([0]);
  expect(await orderState(orderId)).toMatchObject({ payment_status: "refunded" });
  expect(await holdStatus(orderId)).toBe("released");
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 0 });
});

test("keeps seats when release fails and frees them once on the next attempt", async () => {
  const orderId = await createHeldOrder(
    "phase2c-release-retry@example.test",
    "phase2c-release-retry",
  );
  await applyVerifiedEntrySlotPayment(verifiedPayment(orderId), fulfillment());

  const rows = sheet([morning]);
  const soldIndex = ENTRY_SLOT_COLUMNS.indexOf("sold_count");
  let releaseFailures = 0;
  const input = {
    orderId,
    refundId: `refund-${orderId}`,
    refundAmountMinor: 6000,
    refundReason: "Zwrot testowy",
    refundedAt: "2026-10-11T12:00:00.000Z",
  };
  const sheetDeps = {
    supabase,
    readEntrySlotSheet: async () => rows,
    writeEntrySlotSoldCount: async (sheetRowNumber: number, soldCount: number) => {
      rows[sheetRowNumber - 1][soldIndex] = String(soldCount);
    },
  };

  await expect(
    completeEntrySlotRefund(input, {
      ...sheetDeps,
      releaseHold: async () => {
        releaseFailures += 1;
        throw new Error("release failed");
      },
    }),
  ).rejects.toThrow(/release failed/);

  expect(releaseFailures).toBe(1);
  expect(await orderState(orderId)).toMatchObject({ payment_status: "refunded" });
  expect(await holdStatus(orderId)).toBe("confirmed");
  expect(await inventory()).toMatchObject({ sold_qty: 2 });

  await completeEntrySlotRefund(input, sheetDeps);

  expect(await holdStatus(orderId)).toBe("released");
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 0 });
});

test("retries the slot sheet projection without decrementing sold_qty again", async () => {
  const orderId = await createHeldOrder(
    "phase2c-sheet-retry@example.test",
    "phase2c-sheet-retry",
  );
  await applyVerifiedEntrySlotPayment(verifiedPayment(orderId), fulfillment());

  const rows = sheet([morning]);
  const writes: number[] = [];
  const soldIndex = ENTRY_SLOT_COLUMNS.indexOf("sold_count");
  let failSheet = true;
  const complete = (orderIdForRefund: string) =>
    completeEntrySlotRefund(
      {
        orderId: orderIdForRefund,
        refundId: `refund-${orderIdForRefund}`,
        refundAmountMinor: 6000,
        refundReason: "Zwrot testowy",
        refundedAt: "2026-10-11T12:00:00.000Z",
      },
      {
        supabase,
        readEntrySlotSheet: async () => rows,
        writeEntrySlotSoldCount: async (sheetRowNumber, soldCount) => {
          if (failSheet) {
            failSheet = false;
            throw new Error("sheet failed");
          }

          writes.push(soldCount);
          rows[sheetRowNumber - 1][soldIndex] = String(soldCount);
        },
      },
    );

  await expect(
    processOrderRefund(orderId, "Zwrot testowy", {
      loadOrder: loadRefundOrder,
      refundPayment: async () => refundReceipt(orderId, 6000),
      decreaseSoldCount: async () => {
        throw new Error("day refund path");
      },
      completeSlotRefund: (input) => complete(input.orderId),
      finalizeDayRefund: async () => {
        throw new Error("day refund path");
      },
      sendRefundEmail: async () => {},
    }),
  ).rejects.toThrow(/could not be updated/);

  expect(await orderState(orderId)).toMatchObject({ payment_status: "refunded" });
  expect(await holdStatus(orderId)).toBe("released");
  expect(await inventory()).toMatchObject({ sold_qty: 0 });
  expect(writes).toEqual([]);

  await processOrderRefund(orderId, "Zwrot testowy", {
    loadOrder: loadRefundOrder,
    refundPayment: async () => {
      throw new Error("provider should not be called");
    },
    decreaseSoldCount: async () => {
      throw new Error("day refund path");
    },
    completeSlotRefund: (input) => complete(input.orderId),
    finalizeDayRefund: async () => {
      throw new Error("day refund path");
    },
    sendRefundEmail: async () => {},
  });

  expect(writes).toEqual([0]);
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 0 });
});

test("projects sold_qty onto the slot row and can repair a drifted cell", async () => {
  const orderId = await createHeldOrder("phase2c-sheet@example.test", "phase2c-sheet");
  await applyVerifiedEntrySlotPayment(verifiedPayment(orderId), fulfillment());

  const rows = sheet([morning]);
  const writes: number[] = [];
  const soldIndex = ENTRY_SLOT_COLUMNS.indexOf("sold_count");
  const sheetDeps = {
    supabase,
    readEntrySlotSheet: async () => rows,
    writeEntrySlotSoldCount: async (sheetRowNumber: number, soldCount: number) => {
      writes.push(soldCount);
      rows[sheetRowNumber - 1][soldIndex] = String(soldCount);
    },
  };

  await projectEntrySlotSoldCount(orderId, sheetDeps);
  await projectEntrySlotSoldCount(orderId, sheetDeps);
  expect(writes).toEqual([2]);

  rows[1][soldIndex] = "50";
  await repairEntrySlotSoldCount(slotId, sheetDeps);
  expect(writes).toEqual([2, 2]);
  expect(await inventory()).toMatchObject({ sold_qty: 2 });

  const dayRows = [["date", "active", "ticket_limit", "sold_count"]];
  const dayWrites: number[] = [];
  await expect(
    projectEntrySlotSoldCount(orderId, {
      supabase,
      readEntrySlotSheet: async () => dayRows,
      writeEntrySlotSoldCount: async (_row, soldCount) => {
        dayWrites.push(soldCount);
      },
    }),
  ).rejects.toThrow(/could not be updated/);
  expect(dayWrites).toEqual([]);
});

test("expires one slot and a second run frees nothing more", async () => {
  const orderId = await createHeldOrder("phase2c-expire@example.test", "phase2c-expire");
  await ageHold(orderId);

  expect(await runExpireEntrySlotHolds({ supabase, slotId })).toBe(1);
  expect(await runExpireEntrySlotHolds({ supabase, slotId })).toBe(0);
  expect(await inventory()).toMatchObject({ held_qty: 0, sold_qty: 0 });
  expect(await holdStatus(orderId)).toBe("expired");
  expect(await orderState(orderId)).toMatchObject({ payment_status: "pending" });
});
