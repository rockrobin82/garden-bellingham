import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import {
  OrderAlreadyRefundedError,
  RefundInProgressError,
  RefundOutcomeUnknownError,
} from "@/lib/payments/errors";
import { finalizeRefundedOrder } from "@/lib/payments/finalize-refunded-order";
import { processOrderRefund } from "@/lib/payments/process-order-refund";
import { refundP24Payment } from "@/lib/payments/refund-p24-payment";
import type { ProviderRefundLookup } from "@/lib/payments/refund-recovery";
import { P24NetworkError } from "@/lib/przelewy24";
import type { Database } from "@/types/database";

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseUrl =
  process.env.ENTRY_SLOT_TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey =
  process.env.ENTRY_SLOT_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const emailLike = "phase2e-%@example.test";

let pg: Client;
let supabase: SupabaseClient<Database>;

function assertLocalTestTarget(): void {
  const databaseHost = new URL(databaseUrl).hostname;
  const apiHost = new URL(supabaseUrl).hostname;

  if (
    (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") ||
    (apiHost !== "127.0.0.1" && apiHost !== "localhost")
  ) {
    throw new Error("Refusing to run refund claim tests against a non-local database");
  }
}

function completed(orderId: string, amount = 7000): ProviderRefundLookup {
  return {
    outcome: "listed",
    refunds: [{ requestId: `refund-${orderId}`, status: 1, amount }],
  };
}

async function insertPaidOrder(label: string): Promise<string> {
  const inserted = await pg.query<{ id: string }>(
    `insert into public.orders (
       booking_date,
       customer_email,
       ticket_qty,
       normal_qty,
       reduced_qty,
       unit_price_minor,
       total_amount_minor,
       payment_status,
       p24_order_id,
       p24_session_id,
       payment_metadata
     )
     values (
       '2026-10-20',
       $1,
       2,
       2,
       0,
       3500,
       7000,
       'paid',
       '424242',
       'phase2e-session',
       jsonb_build_object('entry_slot_reservation', 'held')
     )
     returning id::text as id`,
    [`phase2e-${label}@example.test`],
  );

  return inserted.rows[0].id;
}

async function recoveryState(orderId: string): Promise<string | null> {
  const result = await pg.query<{ state: string | null }>(
    `select payment_metadata #>> '{refund_recovery,state}' as state
     from public.orders where id = $1`,
    [orderId],
  );

  return result.rows[0]?.state ?? null;
}

async function paymentStatus(orderId: string): Promise<string> {
  const result = await pg.query<{ payment_status: string }>(
    `select payment_status::text from public.orders where id = $1`,
    [orderId],
  );

  return result.rows[0].payment_status;
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
  await pg.query(`delete from public.orders where customer_email like $1`, [emailLike]);
});

afterAll(async () => {
  if (!pg) {
    return;
  }

  try {
    await pg.query(`delete from public.orders where customer_email like $1`, [emailLike]);
  } finally {
    await pg.end();
  }
});

test("only one of two concurrent refunds sends a provider request", async () => {
  const orderId = await insertPaidOrder("parallel");
  let submits = 0;

  const run = () =>
    refundP24Payment(orderId, "Zwrot testowy", {
      supabase,
      lookupRefunds: async () =>
        submits > 0 ? completed(orderId) : { outcome: "not_found" },
      submitRefund: async () => {
        submits += 1;
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          requestId: `refund-${orderId}`,
          refundsUuid: orderId,
          amount: 7000,
          currency: "PLN",
          items: [],
        };
      },
    });

  const results = await Promise.allSettled([run(), run()]);
  const failures = results.filter((result) => result.status === "rejected");

  expect(submits).toBe(1);
  expect(await recoveryState(orderId)).toBe("accepted");
  expect(failures.every((result) => result.reason instanceof RefundInProgressError)).toBe(
    true,
  );
});

test("a crash after the claim and before the provider call can still send once", async () => {
  const orderId = await insertPaidOrder("crash-before-send");
  const { error } = await supabase.rpc("claim_order_refund", {
    p_order_id: orderId,
    p_recovery: {
      state: "dispatching",
      requestId: `refund-${orderId}`,
      refundsUuid: orderId,
      p24OrderId: "424242",
      sessionId: "phase2e-session",
      amountMinor: 7000,
      reason: "Zwrot testowy",
    },
    p_expected_states: ["none"],
  });

  expect(error).toBeNull();
  expect(await recoveryState(orderId)).toBe("dispatching");

  let submits = 0;
  await refundP24Payment(orderId, "Zwrot testowy", {
    supabase,
    lookupRefunds: async () =>
      submits > 0 ? completed(orderId) : { outcome: "not_found" },
    submitRefund: async () => {
      submits += 1;
      return {
        requestId: `refund-${orderId}`,
        refundsUuid: orderId,
        amount: 7000,
        currency: "PLN",
        items: [],
      };
    },
  });

  expect(submits).toBe(1);
  expect(await recoveryState(orderId)).toBe("accepted");
  expect(await paymentStatus(orderId)).toBe("paid");
});

test("a timeout leaves an unknown result and a later 404 does not send again", async () => {
  const orderId = await insertPaidOrder("timeout");
  let submits = 0;
  const dependencies = {
    supabase,
    lookupRefunds: async (): Promise<ProviderRefundLookup> => ({ outcome: "not_found" }),
    submitRefund: async () => {
      submits += 1;
      throw new P24NetworkError("timeout");
    },
  };

  await expect(
    refundP24Payment(orderId, "Zwrot testowy", dependencies),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);
  expect(submits).toBe(1);
  expect(await recoveryState(orderId)).toBe("unknown");

  await expect(
    refundP24Payment(orderId, "Zwrot testowy", {
      ...dependencies,
      submitRefund: async () => {
        submits += 1;
        throw new Error("second send");
      },
    }),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);
  expect(submits).toBe(1);
});

test("a submitted refund stays submitted when the lookup is 404", async () => {
  const orderId = await insertPaidOrder("submitted-404");
  const { error } = await supabase.rpc("claim_order_refund", {
    p_order_id: orderId,
    p_recovery: {
      state: "submitted",
      requestId: `refund-${orderId}`,
      refundsUuid: orderId,
      p24OrderId: "424242",
      sessionId: "phase2e-session",
      amountMinor: 7000,
      reason: "Zwrot testowy",
    },
    p_expected_states: ["none"],
  });
  expect(error).toBeNull();

  let submits = 0;
  await expect(
    refundP24Payment(orderId, "Zwrot testowy", {
      supabase,
      lookupRefunds: async () => ({ outcome: "not_found" }),
      submitRefund: async () => {
        submits += 1;
        throw new Error("second send");
      },
    }),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);

  expect(submits).toBe(0);
  expect(await recoveryState(orderId)).toBe("submitted");
});

test("the first 404 sends one refund and preserves unrelated metadata", async () => {
  const orderId = await insertPaidOrder("first-404");
  let submits = 0;

  await refundP24Payment(orderId, "Zwrot testowy", {
    supabase,
    lookupRefunds: async () =>
      submits > 0 ? completed(orderId) : { outcome: "not_found" },
    submitRefund: async () => {
      submits += 1;
      return {
        requestId: `refund-${orderId}`,
        refundsUuid: orderId,
        amount: 7000,
        currency: "PLN",
        items: [],
      };
    },
  });

  const metadata = await pg.query<{ reservation: string | null; request_id: string | null }>(
    `select payment_metadata->>'entry_slot_reservation' as reservation,
            payment_metadata #>> '{refund_recovery,requestId}' as request_id
     from public.orders where id = $1`,
    [orderId],
  );

  expect(submits).toBe(1);
  expect(metadata.rows[0]).toEqual({
    reservation: "held",
    request_id: `refund-${orderId}`,
  });
});

test("a confirmed provider refund finalizes once after a local finalize error", async () => {
  const orderId = await insertPaidOrder("finalize-retry");
  let submits = 0;
  let decreases = 0;
  let finalizeAttempts = 0;

  const dependencies = {
    loadOrder: async (id: string) => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, entry_slot_id, payment_status, refund_id, refund_amount_minor, refund_reason, refunded_at",
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        throw error ?? new Error("missing order");
      }

      return data;
    },
    refundPayment: (id: string, reason?: string) =>
      refundP24Payment(id, reason, {
        supabase,
        lookupRefunds: async () => completed(id),
        submitRefund: async () => {
          submits += 1;
          throw new Error("provider submit");
        },
      }),
    finalizeDayRefund: async (input: {
      orderId: string;
      refundId: string;
      refundAmountMinor: number;
      refundReason: string;
      refundedAt: string;
    }) => {
      finalizeAttempts += 1;

      if (finalizeAttempts === 1) {
        throw new Error("finalize failed");
      }

      return finalizeRefundedOrder(input, supabase);
    },
    decreaseSoldCount: async () => {
      decreases += 1;
    },
    completeSlotRefund: async () => {
      throw new Error("slot path");
    },
    sendRefundEmail: async () => {},
  };

  await expect(processOrderRefund(orderId, "Zwrot testowy", dependencies)).rejects.toThrow(
    /finalize failed/,
  );
  expect(await paymentStatus(orderId)).toBe("paid");
  expect(decreases).toBe(0);

  await processOrderRefund(orderId, "Zwrot testowy", dependencies);

  expect(submits).toBe(0);
  expect(decreases).toBe(1);
  expect(await paymentStatus(orderId)).toBe("refunded");

  await expect(processOrderRefund(orderId, "Zwrot testowy", dependencies)).rejects.toBeInstanceOf(
    OrderAlreadyRefundedError,
  );
  expect(decreases).toBe(1);
  expect(submits).toBe(0);
});

test("two concurrent day finalizations decrease the date counter once", async () => {
  const orderId = await insertPaidOrder("day-counter");
  let decreases = 0;
  const dependencies = {
    loadOrder: async (id: string) => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, entry_slot_id, payment_status, refund_id, refund_amount_minor, refund_reason, refunded_at",
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        throw error ?? new Error("missing order");
      }

      return data;
    },
    refundPayment: (id: string, reason?: string) =>
      refundP24Payment(id, reason, {
        supabase,
        lookupRefunds: async () => completed(id),
        submitRefund: async () => {
          throw new Error("provider submit");
        },
      }),
    finalizeDayRefund: (input: {
      orderId: string;
      refundId: string;
      refundAmountMinor: number;
      refundReason: string;
      refundedAt: string;
    }) => finalizeRefundedOrder(input, supabase),
    decreaseSoldCount: async () => {
      decreases += 1;
    },
    completeSlotRefund: async () => {
      throw new Error("slot path");
    },
    sendRefundEmail: async () => {},
  };

  const results = await Promise.allSettled([
    processOrderRefund(orderId, "Zwrot testowy", dependencies),
    processOrderRefund(orderId, "Zwrot testowy", dependencies),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      expect(result.reason).toBeInstanceOf(OrderAlreadyRefundedError);
    }
  }

  expect(decreases).toBe(1);
  expect(await paymentStatus(orderId)).toBe("refunded");
});

test("a full panel refund is reconciled and a partial one is not applied", async () => {
  const partialId = await insertPaidOrder("panel-partial");
  let submits = 0;

  await expect(
    refundP24Payment(partialId, "Zwrot testowy", {
      supabase,
      lookupRefunds: async () => ({
        outcome: "listed",
        refunds: [{ requestId: "", status: 1, amount: 1000 }],
      }),
      submitRefund: async () => {
        submits += 1;
        throw new Error("provider submit");
      },
    }),
  ).rejects.toBeInstanceOf(RefundOutcomeUnknownError);
  expect(submits).toBe(0);
  expect(await recoveryState(partialId)).toBe("manual_review");
  expect(await paymentStatus(partialId)).toBe("paid");

  const fullId = await insertPaidOrder("panel-full");
  await refundP24Payment(fullId, "Zwrot testowy", {
    supabase,
    lookupRefunds: async () => ({
      outcome: "listed",
      refunds: [{ requestId: "", status: 1, amount: 7000 }],
    }),
    submitRefund: async () => {
      submits += 1;
      throw new Error("provider submit");
    },
  });

  expect(submits).toBe(0);
  expect(await recoveryState(fullId)).toBe("accepted");
  const match = await pg.query<{ matched_by: string | null }>(
    `select payment_metadata #>> '{refund_recovery,matchedBy}' as matched_by
     from public.orders where id = $1`,
    [fullId],
  );
  expect(match.rows[0]?.matched_by).toBe("amount");
});
