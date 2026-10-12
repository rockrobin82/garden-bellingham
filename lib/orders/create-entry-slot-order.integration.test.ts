import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import { createEntrySlotOrder } from "@/lib/orders/create-entry-slot-order";
import {
  EntrySlotCapacityError,
  EntrySlotDateMismatchError,
  EntrySlotHoldConflictError,
  EntrySlotInactiveError,
  EntrySlotLimitError,
  EntrySlotNotFoundError,
  EntrySlotOrderLimitError,
  EntrySlotQuantityError,
  EntrySlotSheetError,
  EntrySlotUnavailableError,
} from "@/lib/orders/errors";
import { ENTRY_SLOT_COLUMNS } from "@/lib/sheets/schema";
import type { Database } from "@/types/database";
import type { CreateEntrySlotOrderRequest } from "@/types/booking";

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseUrl =
  process.env.ENTRY_SLOT_TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey =
  process.env.ENTRY_SLOT_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const emailLike = "phase2b-%@example.test";
const slotLike = "phase2b-%";

type SlotCells = Record<(typeof ENTRY_SLOT_COLUMNS)[number], string>;

const morning: SlotCells = {
  slot_id: "phase2b-morning",
  date: "2026-10-17",
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
    throw new Error("Refusing to run entry-slot order tests against a non-local database");
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
    bookingDate: "2026-10-17",
    email: "phase2b-visitor@example.test",
    normalQty: 1,
    reducedQty: 1,
    entrySlotId: "phase2b-morning",
    idempotencyKey: "phase2b-default-key",
    invoiceRequested: false,
    ...overrides,
  };
}

async function cleanup(): Promise<void> {
  await pg.query(
    `delete from public.entry_slot_holds
     where order_id in (select id from public.orders where customer_email like $1)`,
    [emailLike],
  );
  await pg.query(`delete from public.orders where customer_email like $1`, [emailLike]);
  await pg.query(`delete from public.entry_slot_inventory where slot_id like $1`, [slotLike]);
}

async function inventory(slotId: string): Promise<{
  held_qty: number;
  sold_qty: number;
  active: boolean;
} | null> {
  const result = await pg.query(
    `select held_qty, sold_qty, active
     from public.entry_slot_inventory
     where slot_id = $1`,
    [slotId],
  );
  return result.rows[0] ?? null;
}

async function ordersFor(email: string): Promise<
  Array<{
    id: string;
    payment_status: string;
    total_amount_minor: number;
    entry_slot_id: string | null;
    entry_time_start: string | null;
    entry_time_end: string | null;
    normal_qty: number;
    reduced_qty: number;
  }>
> {
  const result = await pg.query(
    `select id::text, payment_status, total_amount_minor, entry_slot_id,
            entry_time_start::text, entry_time_end::text, normal_qty, reduced_qty
     from public.orders
     where customer_email = $1
     order by created_at`,
    [email],
  );
  return result.rows;
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

test("creates a slot order from sheet prices and ignores sheet sold_count", async () => {
  const email = "phase2b-create@example.test";
  const created = await createEntrySlotOrder(
    request({
      email,
      idempotencyKey: "phase2b-create-order",
      normalQty: 1,
      reducedQty: 1,
    }),
    {
      supabase,
      readDateSheet: async () => sheet([morning]),
    },
  );

  const rows = await ordersFor(email);
  expect(created).toEqual({
    orderId: rows[0]?.id,
    status: "pending",
    totalAmountMinor: 6000,
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    payment_status: "pending",
    entry_slot_id: "phase2b-morning",
    normal_qty: 1,
    reduced_qty: 1,
    total_amount_minor: 6000,
  });
  expect(rows[0]?.entry_time_start?.startsWith("10:00")).toBe(true);
  expect(rows[0]?.entry_time_end?.startsWith("14:00")).toBe(true);
  expect(await inventory("phase2b-morning")).toMatchObject({
    held_qty: 2,
    sold_qty: 0,
  });
});

test("prices each slot on the same date independently", async () => {
  const rows = sheet([
    morning,
    {
      ...morning,
      slot_id: "phase2b-afternoon",
      time_start: "15:00",
      time_end: "19:00",
      price_normal: "40",
      price_reduced: "30",
      sold_count: "12",
    },
  ]);
  const readDateSheet = async () => rows;

  const morningOrder = await createEntrySlotOrder(
    request({
      email: "phase2b-morning@example.test",
      idempotencyKey: "phase2b-price-morning",
      entrySlotId: "phase2b-morning",
    }),
    { supabase, readDateSheet },
  );
  const afternoonOrder = await createEntrySlotOrder(
    request({
      email: "phase2b-afternoon@example.test",
      idempotencyKey: "phase2b-price-afternoon",
      entrySlotId: "phase2b-afternoon",
    }),
    { supabase, readDateSheet },
  );

  expect(morningOrder.totalAmountMinor).toBe(6000);
  expect(afternoonOrder.totalAmountMinor).toBe(7000);
  const afternoon = await ordersFor("phase2b-afternoon@example.test");
  expect(afternoon[0]?.entry_slot_id).toBe("phase2b-afternoon");
  expect(afternoon[0]?.entry_time_start?.startsWith("15:00")).toBe(true);
  expect(afternoon[0]?.entry_time_end?.startsWith("19:00")).toBe(true);
});

test("rejects a missing slot, a date mismatch, an inactive slot, and too many tickets", async () => {
  const readDateSheet = async () =>
    sheet([{ ...morning, active: "FALSE", max_tickets_per_order: "2" }]);

  await expect(
    createEntrySlotOrder(
      request({ entrySlotId: "phase2b-missing", idempotencyKey: "phase2b-missing-key" }),
      { supabase, readDateSheet },
    ),
  ).rejects.toBeInstanceOf(EntrySlotNotFoundError);
  expect(await inventory("phase2b-missing")).toBeNull();

  await expect(
    createEntrySlotOrder(
      request({
        bookingDate: "2026-10-18",
        idempotencyKey: "phase2b-date-mismatch",
      }),
      { supabase, readDateSheet },
    ),
  ).rejects.toBeInstanceOf(EntrySlotDateMismatchError);

  await expect(
    createEntrySlotOrder(
      request({ idempotencyKey: "phase2b-inactive-key" }),
      { supabase, readDateSheet },
    ),
  ).rejects.toBeInstanceOf(EntrySlotInactiveError);
  expect(await inventory("phase2b-morning")).toMatchObject({ held_qty: 0, active: false });
  const inactiveOrders = await ordersFor("phase2b-visitor@example.test");
  expect(inactiveOrders.every((order) => order.payment_status !== "pending")).toBe(true);

  await expect(
    createEntrySlotOrder(
      request({
        email: "phase2b-too-many@example.test",
        normalQty: 3,
        reducedQty: 0,
        idempotencyKey: "phase2b-too-many-key",
      }),
      {
        supabase,
        readDateSheet: async () =>
          sheet([{ ...morning, active: "TRUE", max_tickets_per_order: "2" }]),
      },
    ),
  ).rejects.toBeInstanceOf(EntrySlotOrderLimitError);
  expect(await ordersFor("phase2b-too-many@example.test")).toHaveLength(0);
});

test("rejects a reservation above the postgres capacity without a payable order", async () => {
  await expect(
    createEntrySlotOrder(
      request({
        email: "phase2b-capacity@example.test",
        normalQty: 3,
        reducedQty: 0,
        idempotencyKey: "phase2b-capacity-key",
      }),
      {
        supabase,
        readDateSheet: async () =>
          sheet([{ ...morning, ticket_limit: "2", max_tickets_per_order: "6" }]),
      },
    ),
  ).rejects.toBeInstanceOf(EntrySlotCapacityError);

  expect(await inventory("phase2b-morning")).toMatchObject({ held_qty: 0, sold_qty: 0 });
  expect((await ordersFor("phase2b-capacity@example.test"))[0]?.payment_status).toBe(
    "cancelled",
  );
});

test("lets at most one concurrent order take the last seat", async () => {
  const readDateSheet = async () =>
    sheet([{ ...morning, ticket_limit: "1", max_tickets_per_order: "1" }]);
  const attempts = await Promise.allSettled([
    createEntrySlotOrder(
      request({
        email: "phase2b-race-a@example.test",
        normalQty: 1,
        reducedQty: 0,
        idempotencyKey: "phase2b-race-a-key",
      }),
      { supabase, readDateSheet },
    ),
    createEntrySlotOrder(
      request({
        email: "phase2b-race-b@example.test",
        normalQty: 1,
        reducedQty: 0,
        idempotencyKey: "phase2b-race-b-key",
      }),
      { supabase, readDateSheet },
    ),
  ]);

  const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
  const rejected = attempts.filter((attempt) => attempt.status === "rejected");
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(EntrySlotCapacityError);
  expect(await inventory("phase2b-morning")).toMatchObject({ held_qty: 1, sold_qty: 0 });
});

test("repeating the same request does not reserve twice or reprice the order", async () => {
  let priceNormal = "35";
  const readDateSheet = async () => sheet([{ ...morning, price_normal: priceNormal }]);
  const input = request({
    email: "phase2b-retry@example.test",
    normalQty: 2,
    reducedQty: 0,
    idempotencyKey: "phase2b-retry-key",
  });

  const first = await createEntrySlotOrder(input, { supabase, readDateSheet });
  priceNormal = "99";
  const second = await createEntrySlotOrder(input, { supabase, readDateSheet });

  expect(second).toEqual(first);
  expect(first.totalAmountMinor).toBe(7000);
  expect(await ordersFor("phase2b-retry@example.test")).toHaveLength(1);
  expect(await inventory("phase2b-morning")).toMatchObject({ held_qty: 2, sold_qty: 0 });

  await expect(
    createEntrySlotOrder(
      { ...input, normalQty: 1 },
      { supabase, readDateSheet },
    ),
  ).rejects.toBeInstanceOf(EntrySlotHoldConflictError);
  expect(await inventory("phase2b-morning")).toMatchObject({ held_qty: 2 });
});

test("retries a crash between insert and reserve without a second hold", async () => {
  const input = request({
    email: "phase2b-crash@example.test",
    normalQty: 1,
    reducedQty: 0,
    idempotencyKey: "phase2b-crash-key",
  });
  const readDateSheet = async () => sheet([morning]);

  await expect(
    createEntrySlotOrder(input, {
      supabase,
      readDateSheet,
      beforeReserve: () => {
        throw new Error("crash before reserve");
      },
    }),
  ).rejects.toThrow(/crash before reserve/);

  expect(await inventory("phase2b-morning")).toMatchObject({ held_qty: 0 });
  expect((await ordersFor("phase2b-crash@example.test"))[0]?.payment_status).toBe(
    "cancelled",
  );

  const created = await createEntrySlotOrder(input, { supabase, readDateSheet });
  expect(created.status).toBe("pending");
  expect(await ordersFor("phase2b-crash@example.test")).toHaveLength(1);
  expect(await inventory("phase2b-morning")).toMatchObject({ held_qty: 1, sold_qty: 0 });
});

test("rejects a sheet failure and a database failure without leaking internals", async () => {
  await expect(
    createEntrySlotOrder(request({ idempotencyKey: "phase2b-sheet-key" }), {
      supabase,
      readDateSheet: async () => {
        throw new Error("https://sheets.googleapis.com/v4/secret-token");
      },
    }),
  ).rejects.toBeInstanceOf(EntrySlotSheetError);

  const deadClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async () =>
        new Response(
          JSON.stringify({
            message: "postgres://postgres:secret@db/postgres eyJhbGciOiJIUzI1NiJ9",
            code: "PGRST000",
          }),
          { status: 500, headers: { "content-type": "application/json" } },
        ),
    },
  });
  const databaseError = await createEntrySlotOrder(
    request({
      email: "phase2b-db@example.test",
      idempotencyKey: "phase2b-db-key",
    }),
    {
      supabase: deadClient,
      readDateSheet: async () => sheet([morning]),
    },
  ).then(
    () => null,
    (error: unknown) => error,
  );

  expect(databaseError).toBeInstanceOf(EntrySlotUnavailableError);
  expect((databaseError as Error).message).toBe("Ordering is temporarily unavailable");
  expect((databaseError as Error).message).not.toMatch(/secret|eyJ|127\.0\.0\.1:9/);
  expect(await ordersFor("phase2b-db@example.test")).toHaveLength(0);
});

test("rejects a sheet limit that is below seats already held", async () => {
  await createEntrySlotOrder(
    request({
      email: "phase2b-held@example.test",
      normalQty: 4,
      reducedQty: 0,
      idempotencyKey: "phase2b-held-key",
    }),
    {
      supabase,
      readDateSheet: async () =>
        sheet([{ ...morning, ticket_limit: "5", max_tickets_per_order: "6" }]),
    },
  );

  await expect(
    createEntrySlotOrder(
      request({
        email: "phase2b-shrink@example.test",
        normalQty: 1,
        reducedQty: 0,
        idempotencyKey: "phase2b-shrink-key",
      }),
      {
        supabase,
        readDateSheet: async () =>
          sheet([{ ...morning, ticket_limit: "2", max_tickets_per_order: "6" }]),
      },
    ),
  ).rejects.toBeInstanceOf(EntrySlotLimitError);

  expect(await ordersFor("phase2b-shrink@example.test")).toHaveLength(0);
  expect(await inventory("phase2b-morning")).toMatchObject({
    held_qty: 4,
    sold_qty: 0,
  });
});

test("rejects a zero quantity before reserving seats", async () => {
  await expect(
    createEntrySlotOrder(
      request({
        normalQty: 0,
        reducedQty: 0,
        idempotencyKey: "phase2b-zero-order",
      }),
      { supabase, readDateSheet: async () => sheet([morning]) },
    ),
  ).rejects.toBeInstanceOf(EntrySlotQuantityError);
  expect(await inventory("phase2b-morning")).toBeNull();
});
