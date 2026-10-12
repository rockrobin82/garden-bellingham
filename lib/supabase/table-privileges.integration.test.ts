import { Client } from "pg";
import { afterAll, beforeAll, expect, test } from "vitest";

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const clientRoles = ["anon", "authenticated"] as const;
const tables = ["orders", "tickets"] as const;

let pg: Client;

function assertLocalTestTarget(): void {
  const databaseHost = new URL(databaseUrl).hostname;

  if (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") {
    throw new Error("Refusing to run privilege tests against a non-local database");
  }
}

async function allowed(role: string, table: string, privilege: string): Promise<boolean> {
  const result = await pg.query<{ allowed: boolean }>(
    `select has_table_privilege($1, $2, $3) as allowed`,
    [role, `public.${table}`, privilege],
  );

  return result.rows[0].allowed;
}

async function canExecute(role: string): Promise<boolean> {
  const result = await pg.query<{ allowed: boolean }>(
    `select has_function_privilege($1, 'public.insert_order_tickets(uuid, text[])', 'EXECUTE') as allowed`,
    [role],
  );

  return result.rows[0].allowed;
}

beforeAll(async () => {
  assertLocalTestTarget();
  pg = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 8000 });
  await pg.connect();
});

afterAll(async () => {
  if (pg) {
    await pg.end();
  }
});

test("client roles cannot truncate orders or tickets", async () => {
  for (const role of clientRoles) {
    for (const table of tables) {
      expect(await allowed(role, table, "TRUNCATE")).toBe(false);
      expect(await allowed(role, table, "SELECT")).toBe(false);
      expect(await allowed(role, table, "INSERT")).toBe(false);
      expect(await allowed(role, table, "UPDATE")).toBe(false);
      expect(await allowed(role, table, "DELETE")).toBe(false);
    }
  }
});

test("a direct truncate by a client role is rejected and leaves the tables unchanged", async () => {
  const before = await pg.query<{ orders: number; tickets: number }>(
    `select
       (select count(*)::int from public.orders) as orders,
       (select count(*)::int from public.tickets) as tickets`,
  );

  for (const role of clientRoles) {
    for (const table of tables) {
      await pg.query("begin");
      let denied = false;

      try {
        await pg.query(`set local role ${role}`);
        await pg.query(`truncate table public.${table}`);
      } catch (error) {
        denied = error instanceof Error && /permission denied/i.test(error.message);
        if (!denied) {
          throw error;
        }
      } finally {
        await pg.query("rollback");
      }

      expect(denied).toBe(true);
    }
  }

  const after = await pg.query<{ orders: number; tickets: number }>(
    `select
       (select count(*)::int from public.orders) as orders,
       (select count(*)::int from public.tickets) as tickets`,
  );
  expect(after.rows[0]).toEqual(before.rows[0]);
});

test("service_role keeps the table access the server uses, inside a rolled-back transaction", async () => {
  expect(await allowed("service_role", "orders", "SELECT")).toBe(true);
  expect(await allowed("service_role", "orders", "INSERT")).toBe(true);
  expect(await allowed("service_role", "orders", "UPDATE")).toBe(true);
  expect(await allowed("service_role", "tickets", "SELECT")).toBe(true);
  expect(await allowed("service_role", "tickets", "UPDATE")).toBe(true);

  const before = await pg.query<{ orders: number }>(
    `select count(*)::int as orders from public.orders where customer_email = $1`,
    ["phase2j-privileges@example.test"],
  );

  await pg.query("begin");

  try {
    await pg.query("set local role service_role");
    const inserted = await pg.query<{ id: string }>(
      `insert into public.orders (
         booking_date, customer_email, ticket_qty, unit_price_minor, total_amount_minor
       )
       values ('2099-06-01', 'phase2j-privileges@example.test', 1, 3500, 3500)
       returning id::text as id`,
    );
    const orderId = inserted.rows[0].id;
    await pg.query(`update public.orders set notes = 'privilege-check' where id = $1`, [orderId]);
    const selected = await pg.query(`select id from public.orders where id = $1`, [orderId]);
    expect(selected.rowCount).toBe(1);
    await pg.query(`select id from public.tickets where false`);
    const updatedTickets = await pg.query(`update public.tickets set status = status where false`);
    expect(updatedTickets.rowCount).toBe(0);
  } finally {
    await pg.query("rollback");
  }

  const after = await pg.query<{ orders: number }>(
    `select count(*)::int as orders from public.orders where customer_email = $1`,
    ["phase2j-privileges@example.test"],
  );
  expect(after.rows[0].orders).toBe(before.rows[0].orders);
});

test("insert_order_tickets stays executable only for service_role and postgres", async () => {
  expect(await canExecute("anon")).toBe(false);
  expect(await canExecute("authenticated")).toBe(false);
  expect(await canExecute("service_role")).toBe(true);
  expect(await canExecute("postgres")).toBe(true);

  await pg.query("begin");
  let denied = false;

  try {
    await pg.query("set local role anon");
    await pg.query(
      `select public.insert_order_tickets('00000000-0000-0000-0000-000000000000'::uuid, array['PHASE2J-DENIED'])`,
    );
  } catch (error) {
    denied = error instanceof Error && /permission denied/i.test(error.message);
    if (!denied) {
      throw error;
    }
  } finally {
    await pg.query("rollback");
  }

  expect(denied).toBe(true);

  await pg.query("begin");
  let missingOrder = false;

  try {
    await pg.query("set local role service_role");
    await pg.query(
      `select public.insert_order_tickets('00000000-0000-0000-0000-000000000000'::uuid, array['PHASE2J-MISSING'])`,
    );
  } catch (error) {
    missingOrder = error instanceof Error && /ORDER_NOT_FOUND/.test(error.message);
    if (!missingOrder) {
      throw error;
    }
  } finally {
    await pg.query("rollback");
  }

  expect(missingOrder).toBe(true);
});
