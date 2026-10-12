import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import { DATES_COLUMNS } from "@/lib/sheets/schema";
import { updateSoldCountForOrder } from "@/lib/sheets/update-sold-count";
import type { Database } from "@/types/database";

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseUrl =
  process.env.ENTRY_SLOT_TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey =
  process.env.ENTRY_SLOT_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const emailLike = "phase2g-%@example.test";

let pg: Client;
let supabase: SupabaseClient<Database>;

function assertLocalTestTarget(): void {
  const databaseHost = new URL(databaseUrl).hostname;
  const apiHost = new URL(supabaseUrl).hostname;

  if (
    (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") ||
    (apiHost !== "127.0.0.1" && apiHost !== "localhost")
  ) {
    throw new Error("Refusing to run day sheet sync tests against a non-local database");
  }
}

function sheet(date: string, soldCount: string): string[][] {
  return [
    [...DATES_COLUMNS],
    [date, "TRUE", "40", soldCount, "35", "25", "", "6"],
  ];
}

async function insertPaidOrder(input: {
  label: string;
  date: string;
  qty: number;
  status?: "paid" | "refunded";
  sheetSynced?: boolean;
  daySheetQty?: number | null;
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
       day_sheet_qty
     )
     values (
       $1, $2, $3, 3500, 7000, $4,
       case when $5::boolean then now() else null end,
       $6
     )
     returning id::text as id`,
    [
      input.date,
      `phase2g-${input.label}@example.test`,
      input.qty,
      input.status ?? "paid",
      input.sheetSynced ?? false,
      input.daySheetQty ?? null,
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

async function syncState(date: string): Promise<{ status: string | null; detail: string | null }> {
  const result = await pg.query<{ status: string | null; detail: string | null }>(
    `select status, detail from public.day_sold_count_sync where booking_date = $1`,
    [date],
  );

  return result.rows[0] ?? { status: null, detail: null };
}

beforeAll(async () => {
  assertLocalTestTarget();
  pg = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 8000 });
  await pg.connect();
  supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

beforeEach(async () => {
  await pg.query(`delete from public.orders where customer_email like $1`, [emailLike]);
  await pg.query(
    `delete from public.day_sold_count_sync
     where booking_date >= '2099-04-01' and booking_date < '2099-05-01'`,
  );
});

afterAll(async () => {
  if (!pg) {
    return;
  }

  try {
    await pg.query(`delete from public.orders where customer_email like $1`, [emailLike]);
    await pg.query(
      `delete from public.day_sold_count_sync
       where booking_date >= '2099-04-01' and booking_date < '2099-05-01'`,
    );
  } finally {
    await pg.end();
  }
});

test("a planned sync is stored before Google Sheets is called", async () => {
  const date = "2099-04-01";
  const orderId = await insertPaidOrder({ label: "planned", date, qty: 2 });
  let sold = "10";
  const writes: number[] = [];

  const planned = await supabase.rpc("plan_day_sold_count_sync", {
    p_booking_date: date,
    p_sheet_qty: 10,
  });

  expect(planned.error).toBeNull();
  expect(planned.data?.action).toBe("dispatch");
  expect((await syncState(date)).status).toBe("planned");
  expect(writes).toEqual([]);

  await updateSoldCountForOrder(orderId, {
    supabase,
    readDateSheet: async () => sheet(date, sold),
    writeSoldCount: async (_row, soldCount) => {
      expect((await syncState(date)).status).toBe("submitted");
      writes.push(soldCount);
      sold = String(soldCount);
    },
  });

  expect(writes).toEqual([12]);
  expect(await marker(orderId)).toBe(2);
  expect((await syncState(date)).status).toBe("applied");
});

test("a sheet write that lands before database confirmation is not added again", async () => {
  const date = "2099-04-02";
  const orderId = await insertPaidOrder({ label: "after-write", date, qty: 2 });
  let sold = "10";
  const writes: number[] = [];
  let crashAfterWrite = true;

  const dependencies = {
    supabase,
    readDateSheet: async () => sheet(date, sold),
    writeSoldCount: async (_row: number, soldCount: number) => {
      writes.push(soldCount);
      sold = String(soldCount);

      if (crashAfterWrite) {
        crashAfterWrite = false;
        throw new Error("process stopped after the sheet write");
      }
    },
  };

  await expect(updateSoldCountForOrder(orderId, dependencies)).rejects.toMatchObject({
    reason: "sheet_write_failed",
  });
  expect(writes).toEqual([12]);
  expect(await marker(orderId)).toBeNull();
  expect((await syncState(date)).status).toBe("submitted");

  await updateSoldCountForOrder(orderId, dependencies);
  await updateSoldCountForOrder(orderId, dependencies);

  expect(writes).toEqual([12]);
  expect(sold).toBe("12");
  expect(await marker(orderId)).toBe(2);
  expect((await syncState(date)).status).toBe("applied");
});

test("a timeout before the sheet changes retries the same absolute value once", async () => {
  const date = "2099-04-03";
  const orderId = await insertPaidOrder({ label: "timeout", date, qty: 2 });
  let sold = "10";
  const writes: number[] = [];
  let failWrite = true;

  const dependencies = {
    supabase,
    readDateSheet: async () => sheet(date, sold),
    writeSoldCount: async (_row: number, soldCount: number) => {
      if (failWrite) {
        failWrite = false;
        throw new Error("timeout");
      }

      writes.push(soldCount);
      sold = String(soldCount);
    },
  };

  await expect(updateSoldCountForOrder(orderId, dependencies)).rejects.toMatchObject({
    reason: "sheet_write_failed",
  });
  expect(sold).toBe("10");
  expect((await syncState(date)).status).toBe("submitted");

  await updateSoldCountForOrder(orderId, dependencies);

  expect(writes).toEqual([12]);
  expect(sold).toBe("12");
  expect(await marker(orderId)).toBe(2);
});

test("two concurrent webhook syncs of one order add it once", async () => {
  const date = "2099-04-04";
  const orderId = await insertPaidOrder({ label: "same-order", date, qty: 2 });
  let sold = "10";
  const writes: number[] = [];

  await Promise.all([
    updateSoldCountForOrder(orderId, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async (_row, soldCount) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        writes.push(soldCount);
        sold = String(soldCount);
      },
    }),
    updateSoldCountForOrder(orderId, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async (_row, soldCount) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        writes.push(soldCount);
        sold = String(soldCount);
      },
    }),
  ]);

  expect(sold).toBe("12");
  expect(writes.every((value) => value === 12)).toBe(true);
  expect(await marker(orderId)).toBe(2);
});

test("two orders on the same day are each added once", async () => {
  const date = "2099-04-05";
  const firstId = await insertPaidOrder({ label: "day-a", date, qty: 2 });
  const secondId = await insertPaidOrder({ label: "day-b", date, qty: 3 });
  let sold = "10";
  const writes: number[] = [];

  await Promise.all([
    updateSoldCountForOrder(firstId, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async (_row, soldCount) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        writes.push(soldCount);
        sold = String(soldCount);
      },
    }),
    updateSoldCountForOrder(secondId, {
      supabase,
      readDateSheet: async () => sheet(date, sold),
      writeSoldCount: async (_row, soldCount) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        writes.push(soldCount);
        sold = String(soldCount);
      },
    }),
  ]);

  expect(sold).toBe("15");
  expect(writes.every((value) => value === 15)).toBe(true);
  expect(await marker(firstId)).toBe(2);
  expect(await marker(secondId)).toBe(3);
});

test("an operator change before the write is included, and a later unknown cell is not overwritten", async () => {
  const beforeSend = "2099-04-06";
  const beforeId = await insertPaidOrder({ label: "before-send", date: beforeSend, qty: 2 });
  let beforeSold = "10";
  const beforeWrites: number[] = [];

  await supabase.rpc("plan_day_sold_count_sync", {
    p_booking_date: beforeSend,
    p_sheet_qty: 10,
  });
  beforeSold = "14";

  await updateSoldCountForOrder(beforeId, {
    supabase,
    readDateSheet: async () => sheet(beforeSend, beforeSold),
    writeSoldCount: async (_row, soldCount) => {
      beforeWrites.push(soldCount);
      beforeSold = String(soldCount);
    },
  });

  expect(beforeWrites).toEqual([16]);
  expect(await marker(beforeId)).toBe(2);

  const afterSend = "2099-04-07";
  const afterId = await insertPaidOrder({ label: "after-send", date: afterSend, qty: 2 });
  let afterSold = "10";

  await expect(
    updateSoldCountForOrder(afterId, {
      supabase,
      readDateSheet: async () => sheet(afterSend, afterSold),
      writeSoldCount: async () => {
        throw new Error("timeout");
      },
    }),
  ).rejects.toMatchObject({ reason: "sheet_write_failed" });

  afterSold = "11";
  const ambiguousWrites: number[] = [];

  await expect(
    updateSoldCountForOrder(afterId, {
      supabase,
      readDateSheet: async () => sheet(afterSend, afterSold),
      writeSoldCount: async (_row, soldCount) => {
        ambiguousWrites.push(soldCount);
        afterSold = String(soldCount);
      },
    }),
  ).rejects.toMatchObject({
    reason: expect.stringContaining("sheet_changed"),
  });

  expect(ambiguousWrites).toEqual([]);
  expect(afterSold).toBe("11");
  expect(await marker(afterId)).toBeNull();
  expect(await syncState(afterSend)).toMatchObject({
    status: "manual_review",
    detail: expect.stringContaining("sheet_changed:10:12:11"),
  });
});

test("a historical refund with an unknown sheet effect blocks a new increment", async () => {
  const date = "2099-04-08";
  await insertPaidOrder({
    label: "historical",
    date,
    qty: 4,
    status: "refunded",
    sheetSynced: true,
    daySheetQty: null,
  });
  const paidId = await insertPaidOrder({ label: "new-paid", date, qty: 2 });
  const writes: number[] = [];

  await expect(
    updateSoldCountForOrder(paidId, {
      supabase,
      readDateSheet: async () => sheet(date, "20"),
      writeSoldCount: async (_row, soldCount) => {
        writes.push(soldCount);
      },
    }),
  ).rejects.toMatchObject({
    reason: expect.stringContaining("unknown_sheet_effect"),
  });

  expect(writes).toEqual([]);
  expect(await marker(paidId)).toBeNull();
  expect((await syncState(date)).status).toBe("manual_review");
});
