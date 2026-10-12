import { Client, Pool } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

/**
 * Runs against a local Postgres that already has the entry-slot migration.
 * Default URL is the Supabase local database from supabase/config.toml.
 * These tests are not mocks. If the database is down, the suite fails to connect
 * and must be reported as not executed.
 */
const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const emailLike = "phase2a-%@example.test";
const slotLike = "phase2a-%";

let pool: Pool;

type Inventory = {
  held_qty: number;
  sold_qty: number;
  ticket_limit: number;
  active: boolean;
};

type Hold = {
  status: string;
  qty: number;
  slot_id: string;
  order_id: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function expectError(run: () => Promise<unknown>, fragment: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(errorMessage(error)).toContain(fragment);
    return;
  }

  throw new Error(`Expected ${fragment}`);
}

async function query<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}

async function cleanup(): Promise<void> {
  await pool.query(
    `delete from public.entry_slot_holds
     where order_id in (
       select id from public.orders where customer_email like $1
     )`,
    [emailLike],
  );
  await pool.query(
    `delete from public.orders where customer_email like $1`,
    [emailLike],
  );
  await pool.query(
    `delete from public.entry_slot_inventory where slot_id like $1`,
    [slotLike],
  );
}

async function insertOrder(label: string, ticketQty = 2): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into public.orders (
       booking_date,
       customer_email,
       ticket_qty,
       normal_qty,
       reduced_qty,
       unit_price_minor,
       total_amount_minor
     )
     values ('2026-10-17', $1, $2, $2, 0, 3500, 3500 * $2)
     returning id::text as id`,
    [`phase2a-${label}@example.test`, ticketQty],
  );
  return rows[0].id;
}

async function syncSlot(
  slotId: string,
  ticketLimit: number,
  active = true,
): Promise<void> {
  await pool.query(
    `select * from public.sync_entry_slot_limit($1, $2, $3)`,
    [slotId, ticketLimit, active],
  );
}

async function reserve(
  slotId: string,
  orderId: string,
  qty: number,
  ttlSeconds = 900,
): Promise<Hold> {
  const rows = await query<Hold>(
    `select status, qty, slot_id, order_id::text as order_id
     from public.reserve_entry_slot($1, $2, $3, $4)`,
    [slotId, orderId, qty, ttlSeconds],
  );
  return rows[0];
}

async function confirm(orderId: string, slotId: string, qty: number): Promise<Hold> {
  const rows = await query<Hold>(
    `select status, qty, slot_id, order_id::text as order_id
     from public.confirm_entry_slot_hold($1, $2, $3)`,
    [orderId, slotId, qty],
  );
  return rows[0];
}

async function release(orderId: string, slotId: string, qty: number): Promise<Hold> {
  const rows = await query<Hold>(
    `select status, qty, slot_id, order_id::text as order_id
     from public.release_entry_slot_hold($1, $2, $3)`,
    [orderId, slotId, qty],
  );
  return rows[0];
}

async function expire(slotId: string | null): Promise<number> {
  const rows = await query<{ expired_count: number }>(
    `select public.expire_entry_slot_holds($1)::int as expired_count`,
    [slotId],
  );
  return rows[0].expired_count;
}

async function inventory(slotId: string): Promise<Inventory> {
  const rows = await query<Inventory>(
    `select held_qty, sold_qty, ticket_limit, active
     from public.entry_slot_inventory
     where slot_id = $1`,
    [slotId],
  );
  return rows[0];
}

async function ageHold(orderId: string): Promise<void> {
  await pool.query(
    `update public.entry_slot_holds
     set expires_at = now() - interval '1 second'
     where order_id = $1`,
    [orderId],
  );
}

async function waitForLock(marker: string): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < 5000) {
    const rows = await query(
      `select pid
       from pg_stat_activity
       where wait_event_type = 'Lock'
         and query like $1
         and pid <> pg_backend_pid()`,
      [`%${marker}%`],
    );

    if (rows.length > 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
  }

  throw new Error(`Timed out waiting for a lock on ${marker}`);
}

beforeAll(async () => {
  const probe = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2000,
  });
  await probe.connect();
  await probe.end();

  pool = new Pool({
    connectionString: databaseUrl,
    max: 4,
    connectionTimeoutMillis: 2000,
  });

  const idType = await query<{ data_type: string }>(
    `select data_type
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'orders'
       and column_name = 'id'`,
  );
  expect(idType[0]?.data_type).toBe("uuid");
});

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  if (!pool) {
    return;
  }

  try {
    await cleanup();
  } finally {
    await pool.end();
  }
});

test("reserves seats and leaves a new slot at zero sold before any hold", async () => {
  await syncSlot("phase2a-basic", 40);
  const created = await inventory("phase2a-basic");
  expect(created).toMatchObject({ held_qty: 0, sold_qty: 0, ticket_limit: 40, active: true });

  const orderId = await insertOrder("basic", 2);
  const hold = await reserve("phase2a-basic", orderId, 2);

  expect(hold).toMatchObject({ status: "held", qty: 2, slot_id: "phase2a-basic" });
  expect(await inventory("phase2a-basic")).toMatchObject({ held_qty: 2, sold_qty: 0 });
});

test("reserves exactly the remaining seats", async () => {
  await syncSlot("phase2a-last", 2);
  const orderId = await insertOrder("last", 2);
  await reserve("phase2a-last", orderId, 2);

  expect(await inventory("phase2a-last")).toMatchObject({ held_qty: 2, sold_qty: 0 });
});

test("rejects a reservation above the limit without changing counters", async () => {
  await syncSlot("phase2a-over", 2);
  const orderId = await insertOrder("over", 3);

  await expectError(
    () => reserve("phase2a-over", orderId, 3),
    "INSUFFICIENT_CAPACITY",
  );
  expect(await inventory("phase2a-over")).toMatchObject({ held_qty: 0, sold_qty: 0 });
});

test("lets at most one of two concurrent reservations take the last seat", async () => {
  await syncSlot("phase2a-race", 1);
  const firstOrderId = await insertOrder("race-a", 1);
  const secondOrderId = await insertOrder("race-b", 1);
  const left = pool.connect();
  const right = pool.connect();
  const clientA = await left;
  const clientB = await right;

  try {
    const attempts = await Promise.allSettled([
      clientA.query(
        `select status from public.reserve_entry_slot($1, $2, 1, 900)`,
        ["phase2a-race", firstOrderId],
      ),
      clientB.query(
        `select status from public.reserve_entry_slot($1, $2, 1, 900)`,
        ["phase2a-race", secondOrderId],
      ),
    ]);

    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    const rejected = attempts.filter((attempt) => attempt.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(errorMessage((rejected[0] as PromiseRejectedResult).reason)).toContain(
      "INSUFFICIENT_CAPACITY",
    );
    expect(await inventory("phase2a-race")).toMatchObject({ held_qty: 1, sold_qty: 0 });
  } finally {
    clientA.release();
    clientB.release();
  }
});

test("repeating the same reservation does not increment held_qty", async () => {
  await syncSlot("phase2a-idem-reserve", 5);
  const orderId = await insertOrder("idem-reserve", 2);
  await reserve("phase2a-idem-reserve", orderId, 2);
  await reserve("phase2a-idem-reserve", orderId, 2);

  const holds = await query(
    `select id from public.entry_slot_holds where order_id = $1`,
    [orderId],
  );
  expect(holds).toHaveLength(1);
  expect(await inventory("phase2a-idem-reserve")).toMatchObject({
    held_qty: 2,
    sold_qty: 0,
  });
});

test("confirmation moves quantity from held_qty to sold_qty", async () => {
  await syncSlot("phase2a-confirm", 5);
  const orderId = await insertOrder("confirm", 2);
  await reserve("phase2a-confirm", orderId, 2);
  const hold = await confirm(orderId, "phase2a-confirm", 2);

  expect(hold.status).toBe("confirmed");
  expect(await inventory("phase2a-confirm")).toMatchObject({ held_qty: 0, sold_qty: 2 });
});

test("confirming twice does not move the counters again", async () => {
  await syncSlot("phase2a-confirm-twice", 5);
  const orderId = await insertOrder("confirm-twice", 2);
  await reserve("phase2a-confirm-twice", orderId, 2);
  await confirm(orderId, "phase2a-confirm-twice", 2);
  await confirm(orderId, "phase2a-confirm-twice", 2);

  expect(await inventory("phase2a-confirm-twice")).toMatchObject({
    held_qty: 0,
    sold_qty: 2,
  });
});

test("releasing a hold returns the seats", async () => {
  await syncSlot("phase2a-release", 5);
  const orderId = await insertOrder("release", 2);
  await reserve("phase2a-release", orderId, 2);
  const hold = await release(orderId, "phase2a-release", 2);

  expect(hold.status).toBe("released");
  expect(await inventory("phase2a-release")).toMatchObject({ held_qty: 0, sold_qty: 0 });
});

test("releasing twice does not change the counters again", async () => {
  await syncSlot("phase2a-release-twice", 5);
  const orderId = await insertOrder("release-twice", 2);
  await reserve("phase2a-release-twice", orderId, 2);
  await confirm(orderId, "phase2a-release-twice", 2);
  await release(orderId, "phase2a-release-twice", 2);
  const second = await release(orderId, "phase2a-release-twice", 2);

  expect(second.status).toBe("released");
  expect(await inventory("phase2a-release-twice")).toMatchObject({
    held_qty: 0,
    sold_qty: 0,
  });
});

test("expiring a hold frees seats once", async () => {
  await syncSlot("phase2a-expire", 5);
  const orderId = await insertOrder("expire", 2);
  await reserve("phase2a-expire", orderId, 2);
  await ageHold(orderId);

  expect(await inventory("phase2a-expire")).toMatchObject({ held_qty: 2, sold_qty: 0 });
  expect(await expire("phase2a-expire")).toBe(1);
  expect(await inventory("phase2a-expire")).toMatchObject({ held_qty: 0, sold_qty: 0 });
  expect(await expire("phase2a-expire")).toBe(0);
  expect(await inventory("phase2a-expire")).toMatchObject({ held_qty: 0, sold_qty: 0 });

  const holds = await query<{ status: string }>(
    `select status from public.entry_slot_holds where order_id = $1`,
    [orderId],
  );
  expect(holds[0]?.status).toBe("expired");
});

test("confirmation wins when it commits before expiry", async () => {
  await syncSlot("phase2a-confirm-wins", 4);
  const orderId = await insertOrder("confirm-wins", 2);
  await reserve("phase2a-confirm-wins", orderId, 2);
  await ageHold(orderId);

  const locker = await pool.connect();
  const expirer = await pool.connect();

  try {
    await locker.query("begin");
    await locker.query(
      `select 1 from public.entry_slot_inventory where slot_id = $1 for update`,
      ["phase2a-confirm-wins"],
    );

    const expiry = expirer.query(
      `select public.expire_entry_slot_holds($1)::int as expired_count /* phase2a-expire-waiter */`,
      ["phase2a-confirm-wins"],
    );
    await waitForLock("phase2a-expire-waiter");
    await locker.query(
      `select status from public.confirm_entry_slot_hold($1, $2, $3)`,
      [orderId, "phase2a-confirm-wins", 2],
    );
    await locker.query("commit");

    const expired = await expiry;
    expect(expired.rows[0]?.expired_count).toBe(0);
    expect(await inventory("phase2a-confirm-wins")).toMatchObject({
      held_qty: 0,
      sold_qty: 2,
    });
  } finally {
    await locker.query("rollback").catch(() => undefined);
    locker.release();
    expirer.release();
  }
});

test("expiry wins when it commits before confirmation", async () => {
  await syncSlot("phase2a-expire-wins", 4);
  const orderId = await insertOrder("expire-wins", 2);
  await reserve("phase2a-expire-wins", orderId, 2);
  await ageHold(orderId);

  const locker = await pool.connect();
  const confirmer = await pool.connect();

  try {
    await locker.query("begin");
    await locker.query(
      `select 1 from public.entry_slot_inventory where slot_id = $1 for update`,
      ["phase2a-expire-wins"],
    );

    const confirmation = confirmer.query(
      `select status from public.confirm_entry_slot_hold($1, $2, $3) /* phase2a-confirm-waiter */`,
      [orderId, "phase2a-expire-wins", 2],
    );
    void confirmation.catch(() => undefined);
    await waitForLock("phase2a-confirm-waiter");
    await locker.query(
      `select public.expire_entry_slot_holds($1)`,
      ["phase2a-expire-wins"],
    );
    await locker.query("commit");

    await expect(confirmation).rejects.toThrow(/HOLD_INACTIVE/);
    expect(await inventory("phase2a-expire-wins")).toMatchObject({
      held_qty: 0,
      sold_qty: 0,
    });
  } finally {
    await locker.query("rollback").catch(() => undefined);
    locker.release();
    confirmer.release();
  }
});

test("rejects a limit below held and sold seats and keeps the previous limit", async () => {
  await syncSlot("phase2a-limit", 5);
  const orderId = await insertOrder("limit", 3);
  await reserve("phase2a-limit", orderId, 3);
  await confirm(orderId, "phase2a-limit", 3);

  await expectError(
    () => syncSlot("phase2a-limit", 2, false),
    "LIMIT_BELOW_COMMITTED",
  );

  expect(await inventory("phase2a-limit")).toMatchObject({
    ticket_limit: 5,
    held_qty: 0,
    sold_qty: 3,
    active: true,
  });
});

test("rejects a new reservation on an inactive or missing slot", async () => {
  await syncSlot("phase2a-inactive", 5, false);
  const inactiveOrderId = await insertOrder("inactive", 1);
  await expectError(
    () => reserve("phase2a-inactive", inactiveOrderId, 1),
    "SLOT_INACTIVE",
  );
  expect(await inventory("phase2a-inactive")).toMatchObject({ held_qty: 0, sold_qty: 0 });

  const missingOrderId = await insertOrder("missing", 1);
  await expectError(
    () => reserve("phase2a-missing", missingOrderId, 1),
    "SLOT_NOT_FOUND",
  );
});

test("rejects mismatched order, slot, or quantity without moving counters", async () => {
  await syncSlot("phase2a-match-a", 5);
  await syncSlot("phase2a-match-b", 5);
  const orderId = await insertOrder("match", 2);
  await reserve("phase2a-match-a", orderId, 2);

  await expectError(() => reserve("phase2a-match-b", orderId, 2), "HOLD_CONFLICT");
  await expectError(() => reserve("phase2a-match-a", orderId, 1), "HOLD_CONFLICT");
  await expectError(
    () => confirm(orderId, "phase2a-match-b", 2),
    "HOLD_CONFLICT",
  );
  await expectError(
    () => confirm(orderId, "phase2a-match-a", 1),
    "HOLD_CONFLICT",
  );
  await expectError(
    () => confirm("00000000-0000-4000-8000-000000000000", "phase2a-match-a", 2),
    "HOLD_NOT_FOUND",
  );
  await expectError(() => reserve("phase2a-match-a", orderId, 0), "INVALID_QTY");

  expect(await inventory("phase2a-match-a")).toMatchObject({ held_qty: 2, sold_qty: 0 });
  expect(await inventory("phase2a-match-b")).toMatchObject({ held_qty: 0, sold_qty: 0 });
});

test("keeps two slots on the same visit date independent", async () => {
  await syncSlot("phase2a-morning", 40);
  await syncSlot("phase2a-afternoon", 40);
  const morningOrderId = await insertOrder("morning", 4);
  const afternoonOrderId = await insertOrder("afternoon", 1);
  await reserve("phase2a-morning", morningOrderId, 4);
  await confirm(morningOrderId, "phase2a-morning", 4);
  await reserve("phase2a-afternoon", afternoonOrderId, 1);

  expect(await inventory("phase2a-morning")).toMatchObject({ held_qty: 0, sold_qty: 4 });
  expect(await inventory("phase2a-afternoon")).toMatchObject({ held_qty: 1, sold_qty: 0 });
});

test("leaves historical orders without a slot or hours", async () => {
  const orderId = await insertOrder("legacy", 1);
  const rows = await query<{
    entry_slot_id: string | null;
    entry_time_start: string | null;
    entry_time_end: string | null;
  }>(
    `select entry_slot_id, entry_time_start::text, entry_time_end::text
     from public.orders
     where id = $1`,
    [orderId],
  );

  expect(rows[0]).toEqual({
    entry_slot_id: null,
    entry_time_start: null,
    entry_time_end: null,
  });

  await expect(
    pool.query(
      `update public.orders set entry_time_start = '10:00' where id = $1`,
      [orderId],
    ),
  ).rejects.toThrow(/orders_entry_window_complete/);
});

test("allows only the service role to execute the reservation functions", async () => {
  const config = await query<{ prosecdef: boolean; proconfig: string[] | null }>(
    `select prosecdef, proconfig
     from pg_proc
     join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
     where pg_namespace.nspname = 'public'
       and proname = 'reserve_entry_slot'`,
  );
  expect(config[0]?.prosecdef).toBe(true);
  expect(config[0]?.proconfig?.join(" ")).toContain("search_path=pg_catalog, public");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role anon");
    await expect(
      client.query(
        `select public.reserve_entry_slot('phase2a-denied', '00000000-0000-4000-8000-000000000000', 1, 900)`,
      ),
    ).rejects.toThrow(/permission denied/i);
    await client.query("rollback");

    await client.query("begin");
    await client.query("set local role service_role");
    await client.query(
      `select * from public.sync_entry_slot_limit('phase2a-service-role', 4, true)`,
    );
    await client.query("rollback");
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
});

test("a held reservation past expires_at can still be confirmed until expiry commits", async () => {
  await syncSlot("phase2a-late-pay", 3);
  const orderId = await insertOrder("late-pay", 1);
  await reserve("phase2a-late-pay", orderId, 1);
  await ageHold(orderId);
  await confirm(orderId, "phase2a-late-pay", 1);

  expect(await expire("phase2a-late-pay")).toBe(0);
  expect(await inventory("phase2a-late-pay")).toMatchObject({ held_qty: 0, sold_qty: 1 });
});
