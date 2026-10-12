import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import { OrderAlreadyRefundedError } from "@/lib/payments/errors";
import { processOrderRefund } from "@/lib/payments/process-order-refund";
import { reconcileDaySoldCount } from "@/lib/sheets/reconcile-day-sold-count";
import { DATES_COLUMNS } from "@/lib/sheets/schema";
import type { Database } from "@/types/database";

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseUrl =
  process.env.ENTRY_SLOT_TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey =
  process.env.ENTRY_SLOT_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const emailLike = "phase2f-%@example.test";
const slotId = "phase2f-morning";

let pg: Client;
let supabase: SupabaseClient<Database>;

function assertLocalTestTarget(): void {
  const databaseHost = new URL(databaseUrl).hostname;
  const apiHost = new URL(supabaseUrl).hostname;

  if (
    (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") ||
    (apiHost !== "127.0.0.1" && apiHost !== "localhost")
  ) {
    throw new Error("Refusing to run day sold-count tests against a non-local database");
  }
}

function sheet(date: string, soldCount: string): string[][] {
  return [
    [...DATES_COLUMNS],
    [date, "TRUE", "40", soldCount, "35", "25", "", "6"],
  ];
}

async function insertOrder(input: {
  label: string;
  date: string;
  qty: number;
  status: "paid" | "refunded" | "pending" | "cancelled";
  daySheetQty: number | null;
  sheetSynced: boolean;
  refundAmount?: number | null;
  slot?: boolean;
}): Promise<string> {
  const inserted = await pg.query<{ id: string }>(
    `insert into public.orders (
       booking_date,
       customer_email,
       ticket_qty,
       unit_price_minor,
       total_amount_minor,
       payment_status,
       sheet_synced_at,
       day_sheet_qty,
       refund_amount_minor,
       entry_slot_id,
       entry_time_start,
       entry_time_end
     )
     values (
       $1,
       $2,
       $3,
       3500,
       7000,
       $4,
       case when $5::boolean then now() else null end,
       $6,
       $7,
       $8,
       case when $8::text is null then null else '10:00'::time end,
       case when $8::text is null then null else '12:00'::time end
     )
     returning id::text as id`,
    [
      input.date,
      `phase2f-${input.label}@example.test`,
      input.qty,
      input.status,
      input.sheetSynced,
      input.daySheetQty,
      input.refundAmount ?? null,
      input.slot ? slotId : null,
    ],
  );

  return inserted.rows[0].id;
}

async function marker(orderId: string): Promise<number | null> {
  const result = await pg.query<{ day_sheet_qty: number | null }>(
    `select day_sheet_qty from public.orders where id = $1`,
    [orderId],
  );

  return result.rows[0]?.day_sheet_qty ?? null;
}

async function syncStatus(date: string): Promise<string | null> {
  const result = await pg.query<{ status: string | null }>(
    `select status from public.day_sold_count_sync where booking_date = $1`,
    [date],
  );

  return result.rows[0]?.status ?? null;
}

beforeAll(async () => {
  assertLocalTestTarget();
  pg = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 8000 });
  await pg.connect();
  supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await pg.query(
    `insert into public.entry_slot_inventory (slot_id, ticket_limit, sold_qty)
     values ($1, 40, 5)
     on conflict (slot_id) do nothing`,
    [slotId],
  );
});

beforeEach(async () => {
  await pg.query(`delete from public.orders where customer_email like $1`, [emailLike]);
  await pg.query(
    `delete from public.day_sold_count_sync where booking_date >= '2099-03-01' and booking_date < '2099-04-01'`,
  );
});

afterAll(async () => {
  if (!pg) {
    return;
  }

  try {
    await pg.query(`delete from public.orders where customer_email like $1`, [emailLike]);
    await pg.query(
      `delete from public.day_sold_count_sync where booking_date >= '2099-03-01' and booking_date < '2099-04-01'`,
    );
    await pg.query(`delete from public.entry_slot_inventory where slot_id = $1`, [slotId]);
  } finally {
    await pg.end();
  }
});

test("a day refund saved before the sheet write repairs the absolute count once", async () => {
  const date = "2099-03-01";
  const orderId = await insertOrder({
    label: "crash",
    date,
    qty: 4,
    status: "refunded",
    daySheetQty: 4,
    sheetSynced: true,
  });
  const writes: number[] = [];
  let sold = "10";

  const target = await reconcileDaySoldCount(date, {
    supabase,
    readDateSheet: async () => sheet(date, sold),
    writeSoldCount: async (_row, soldCount) => {
      writes.push(soldCount);
      sold = String(soldCount);
    },
  });

  expect(target).toBe(6);
  expect(writes).toEqual([6]);
  expect(await marker(orderId)).toBe(0);
  expect(await syncStatus(date)).toBe("applied");

  const again = await reconcileDaySoldCount(date, {
    supabase,
    readDateSheet: async () => sheet(date, sold),
    writeSoldCount: async (_row, soldCount) => {
      writes.push(soldCount);
      sold = String(soldCount);
    },
  });

  expect(again).toBe(6);
  expect(writes).toEqual([6]);
  expect(await marker(orderId)).toBe(0);
});

test("two concurrent reconciles write one absolute count", async () => {
  const date = "2099-03-02";
  const orderId = await insertOrder({
    label: "parallel",
    date,
    qty: 4,
    status: "refunded",
    daySheetQty: 4,
    sheetSynced: true,
  });
  let sold = "10";
  const writes: number[] = [];

  await Promise.all([
    reconcileDaySoldCount(date, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async (_row, soldCount) => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        writes.push(soldCount);
        sold = String(soldCount);
      },
    }),
    reconcileDaySoldCount(date, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async (_row, soldCount) => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        writes.push(soldCount);
        sold = String(soldCount);
      },
    }),
  ]);

  expect(writes.every((value) => value === 6)).toBe(true);
  expect(sold).toBe("6");
  expect(await marker(orderId)).toBe(0);
});

test("a changed cell after a failed write is left for manual review", async () => {
  const date = "2099-03-03";
  const orderId = await insertOrder({
    label: "sheet-error",
    date,
    qty: 4,
    status: "refunded",
    daySheetQty: 4,
    sheetSynced: true,
  });
  let sold = "10";
  let failWrite = true;
  const writes: number[] = [];

  await expect(
    reconcileDaySoldCount(date, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async () => {
        failWrite = false;
        throw new Error("sheet unavailable");
      },
    }),
  ).rejects.toMatchObject({ reason: "sheet_write_failed" });

  expect(await marker(orderId)).toBe(4);
  expect(await syncStatus(date)).toBe("submitted");
  sold = "99";

  await expect(
    reconcileDaySoldCount(date, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async (_row, soldCount) => {
        writes.push(soldCount);
        sold = String(soldCount);
      },
    }),
  ).rejects.toMatchObject({
    reason: expect.stringContaining("sheet_changed"),
  });

  expect(failWrite).toBe(false);
  expect(writes).toEqual([]);
  expect(sold).toBe("99");
  expect(await marker(orderId)).toBe(4);
  expect(await syncStatus(date)).toBe("manual_review");
});

test("a partial refund and an unknown historical effect do not write", async () => {
  const partialDate = "2099-03-04";
  await insertOrder({
    label: "partial",
    date: partialDate,
    qty: 2,
    status: "refunded",
    daySheetQty: 2,
    sheetSynced: true,
    refundAmount: 1000,
  });

  await expect(
    reconcileDaySoldCount(partialDate, {
      supabase,
      readDateSheet: async () => sheet(partialDate, "8"),
      writeSoldCount: async () => {
        throw new Error("partial write");
      },
    }),
  ).rejects.toMatchObject({ reason: expect.stringContaining("partial_refund") });
  expect(await syncStatus(partialDate)).toBe("manual_review");

  const unknownDate = "2099-03-05";
  await insertOrder({
    label: "unknown",
    date: unknownDate,
    qty: 2,
    status: "refunded",
    daySheetQty: null,
    sheetSynced: true,
  });

  await expect(
    reconcileDaySoldCount(unknownDate, {
      supabase,
      readDateSheet: async () => sheet(unknownDate, "8"),
      writeSoldCount: async () => {
        throw new Error("unknown write");
      },
    }),
  ).rejects.toMatchObject({
    reason: expect.stringContaining("unknown_sheet_effect"),
  });
  expect(await syncStatus(unknownDate)).toBe("manual_review");
});

test("a sheet below the recorded contribution is left for manual review", async () => {
  const date = "2099-03-06";
  await insertOrder({
    label: "below",
    date,
    qty: 4,
    status: "refunded",
    daySheetQty: 4,
    sheetSynced: true,
  });

  await expect(
    reconcileDaySoldCount(date, {
      supabase,
      readDateSheet: async () => sheet(date, "1"),
      writeSoldCount: async () => {
        throw new Error("discrepancy write");
      },
    }),
  ).rejects.toMatchObject({
    reason: expect.stringContaining("unexplained_sheet_value"),
  });
  expect(await syncStatus(date)).toBe("manual_review");
});

test("entry-slot sales stay out of the day counter", async () => {
  const date = "2099-03-07";
  const dayOrderId = await insertOrder({
    label: "day-only",
    date,
    qty: 2,
    status: "paid",
    daySheetQty: 2,
    sheetSynced: true,
  });
  const slotOrderId = await insertOrder({
    label: "slot-only",
    date,
    qty: 5,
    status: "paid",
    daySheetQty: null,
    sheetSynced: false,
    slot: true,
  });
  const writes: number[] = [];

  const target = await reconcileDaySoldCount(date, {
    supabase,
    readDateSheet: async () => sheet(date, "9"),
    writeSoldCount: async (_row, soldCount) => {
      writes.push(soldCount);
    },
  });

  expect(target).toBe(9);
  expect(writes).toEqual([]);
  expect(await marker(dayOrderId)).toBe(2);
  expect(await marker(slotOrderId)).toBeNull();
});

test("a repeated refund finishes the sheet sync without subtracting twice", async () => {
  const date = "2099-03-08";
  const orderId = await insertOrder({
    label: "retry-refund",
    date,
    qty: 4,
    status: "refunded",
    daySheetQty: 4,
    sheetSynced: true,
  });
  let sold = "10";
  const writes: number[] = [];
  let providerCalls = 0;

  const syncDaySoldCount = async (bookingDate: string): Promise<void> => {
    await reconcileDaySoldCount(bookingDate, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async (_row, soldCount) => {
        writes.push(soldCount);
        sold = String(soldCount);
      },
    });
  };

  const dependencies = {
    loadOrder: async (id: string) => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, entry_slot_id, booking_date, payment_status, refund_id, refund_amount_minor, refund_reason, refunded_at",
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        throw error ?? new Error("missing order");
      }

      return data;
    },
    refundPayment: async () => {
      providerCalls += 1;
      throw new Error("provider should not be called");
    },
    syncDaySoldCount,
    sendRefundEmail: async () => {},
  };

  await expect(
    processOrderRefund(orderId, "Zwrot testowy", dependencies),
  ).rejects.toBeInstanceOf(OrderAlreadyRefundedError);

  expect(providerCalls).toBe(0);
  expect(writes).toEqual([6]);
  expect(sold).toBe("6");
  expect(await marker(orderId)).toBe(0);

  await expect(
    processOrderRefund(orderId, "Zwrot testowy", dependencies),
  ).rejects.toBeInstanceOf(OrderAlreadyRefundedError);

  expect(providerCalls).toBe(0);
  expect(writes).toEqual([6]);
  expect(await marker(orderId)).toBe(0);
});
