import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";

import { generateTicketsForOrder } from "@/lib/tickets/generate-tickets-for-order";
import { generateTicketCode } from "@/lib/tickets/generate-ticket-code";
import { insertOrderTickets } from "@/lib/tickets/insert-order-tickets";
import type { Database } from "@/types/database";

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseUrl =
  process.env.ENTRY_SLOT_TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey =
  process.env.ENTRY_SLOT_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const emailLike = "phase2h-tickets-%@example.test";
const slotId = "phase2h-window";

type TicketRow = {
  id: string;
  ticket_code: string;
  qr_payload: string;
  status: string;
  used_at: string | null;
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
    throw new Error("Refusing to run ticket tests against a non-local database");
  }
}

function localSupabase(): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function openConnection(): Promise<Client> {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
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

async function insertOrder(input: {
  label: string;
  qty: number;
  status?: "paid" | "pending";
  entrySlot?: boolean;
}): Promise<string> {
  if (input.entrySlot) {
    await pg.query(
      `insert into public.entry_slot_inventory (slot_id, ticket_limit, active)
       values ($1, 40, true)
       on conflict (slot_id) do nothing`,
      [slotId],
    );
  }

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
       entry_slot_id,
       entry_time_start,
       entry_time_end
     )
     values (
       '2099-05-02', $1, $2, $2, 0, 3500, $2 * 3500, $3,
       case when $4::boolean then $5 else null end,
       case when $4::boolean then '10:00'::time else null end,
       case when $4::boolean then '14:00'::time else null end
     )
     returning id::text as id`,
    [
      `phase2h-tickets-${input.label}@example.test`,
      input.qty,
      input.status ?? "paid",
      input.entrySlot ?? false,
      slotId,
    ],
  );

  return inserted.rows[0].id;
}

async function insertTicket(
  orderId: string,
  ticketCode: string,
  qrPayload: string,
  status: "valid" | "used" = "valid",
): Promise<TicketRow> {
  const inserted = await pg.query<TicketRow>(
    `insert into public.tickets (order_id, ticket_code, qr_payload, status, used_at)
     values ($1, $2, $3, $4, case when $4 = 'used' then now() else null end)
     returning id::text as id, ticket_code, qr_payload, status, used_at::text as used_at`,
    [orderId, ticketCode, qrPayload, status],
  );

  return inserted.rows[0];
}

async function tickets(orderId: string): Promise<TicketRow[]> {
  const result = await pg.query<TicketRow>(
    `select id::text as id, ticket_code, qr_payload, status, used_at::text as used_at
     from public.tickets
     where order_id = $1
     order by created_at, id`,
    [orderId],
  );

  return result.rows;
}

async function insertThroughLock(
  client: Client,
  orderId: string,
  codes: string[],
): Promise<number> {
  const result = await client.query<{ inserted: number }>(
    `select public.insert_order_tickets($1::uuid, $2::text[])::int as inserted`,
    [orderId, codes],
  );

  return result.rows[0].inserted;
}

beforeAll(async () => {
  assertLocalTestTarget();
  pg = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 8000 });
  await pg.connect();
  supabase = localSupabase();
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

test("two concurrent first inserts on separate connections create one ticket set", async () => {
  const orderId = await insertOrder({ label: "concurrent-sql", qty: 3 });
  const firstCodes = ["PHASE2H-A1", "PHASE2H-A2", "PHASE2H-A3"];
  const secondCodes = ["PHASE2H-B1", "PHASE2H-B2", "PHASE2H-B3"];
  const first = await openConnection();
  const second = await openConnection();

  try {
    const counts = await Promise.all([
      insertThroughLock(first, orderId, firstCodes),
      insertThroughLock(second, orderId, secondCodes),
    ]);

    expect(counts).toEqual([3, 3]);
    const stored = (await tickets(orderId)).map((ticket) => ticket.ticket_code).sort();
    const winners = [firstCodes, secondCodes].map((codes) => [...codes].sort());
    expect(winners).toContainEqual(stored);
  } finally {
    await first.end();
    await second.end();
  }
});

test("two concurrent day-order finalizations create one ticket set", async () => {
  const orderId = await insertOrder({ label: "concurrent-day", qty: 2 });
  const first = localSupabase();
  const second = localSupabase();

  await Promise.all([
    generateTicketsForOrder(orderId, first),
    generateTicketsForOrder(orderId, second),
  ]);

  expect(await tickets(orderId)).toHaveLength(2);
});

test("two concurrent slot-order finalizations create one ticket set", async () => {
  const orderId = await insertOrder({ label: "concurrent-slot", qty: 2, entrySlot: true });
  const first = localSupabase();
  const second = localSupabase();

  await Promise.all([
    insertOrderTickets(first, orderId),
    insertOrderTickets(second, orderId),
  ]);

  expect(await tickets(orderId)).toHaveLength(2);
});

test("repeated finalization of a complete order does not add tickets", async () => {
  const orderId = await insertOrder({ label: "repeat-day", qty: 2 });
  await generateTicketsForOrder(orderId, supabase);
  const firstSet = await tickets(orderId);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await generateTicketsForOrder(orderId, supabase);
  }

  expect(await tickets(orderId)).toEqual(firstSet);
});

test("a webhook retry after a complete slot set does not add tickets", async () => {
  const orderId = await insertOrder({ label: "retry-slot", qty: 2, entrySlot: true });
  await insertOrderTickets(supabase, orderId);
  const firstSet = await tickets(orderId);

  await insertOrderTickets(supabase, orderId);
  await insertOrderTickets(supabase, orderId);

  expect(await tickets(orderId)).toEqual(firstSet);
});

test("a failure while inserting the missing tickets rolls back and a retry completes the set", async () => {
  const orderId = await insertOrder({ label: "partial-crash", qty: 3 });
  const kept = await insertTicket(orderId, "PHASE2H-KEEP", "qr-payload-keep");
  const otherOrderId = await insertOrder({ label: "partial-other", qty: 1 });
  await insertTicket(otherOrderId, "PHASE2H-COLLIDE", "qr-payload-collide");

  await expect(
    insertThroughLock(pg, orderId, ["PHASE2H-FRESH", "PHASE2H-COLLIDE", "PHASE2H-UNUSED"]),
  ).rejects.toThrow(/PHASE2H-COLLIDE|duplicate key|unique/i);

  const afterFailure = await tickets(orderId);
  expect(afterFailure).toEqual([kept]);

  const inserted = await insertThroughLock(pg, orderId, [
    "PHASE2H-NEW-1",
    "PHASE2H-NEW-2",
    "PHASE2H-NEW-3",
  ]);

  expect(inserted).toBe(3);
  const completed = await tickets(orderId);
  expect(completed.map((ticket) => ticket.ticket_code).sort()).toEqual([
    "PHASE2H-KEEP",
    "PHASE2H-NEW-1",
    "PHASE2H-NEW-2",
  ]);
  expect(completed.find((ticket) => ticket.id === kept.id)).toEqual(kept);
});

test("a database error from the app path leaves the short set, and the retry fills only the gap", async () => {
  const orderId = await insertOrder({ label: "db-error", qty: 3 });
  const kept = await insertTicket(orderId, "PHASE2H-APP-KEEP", "qr-payload-app-keep");
  const otherOrderId = await insertOrder({ label: "db-error-other", qty: 1 });
  await insertTicket(otherOrderId, "PHASE2H-APP-COLLIDE", "qr-payload-app-collide");
  const generated = ["PHASE2H-APP-FRESH", "PHASE2H-APP-COLLIDE", "PHASE2H-APP-LATER"];
  let index = 0;

  await expect(
    insertOrderTickets(supabase, orderId, () => generated[index++] ?? generateTicketCode()),
  ).rejects.toThrow(/PHASE2H-APP-COLLIDE|duplicate key|unique/i);

  expect(await tickets(orderId)).toEqual([kept]);

  await insertOrderTickets(supabase, orderId);

  const completed = await tickets(orderId);
  expect(completed).toHaveLength(3);
  expect(completed[0]).toEqual(kept);
  expect(completed.map((ticket) => ticket.ticket_code)).not.toContain("PHASE2H-APP-FRESH");
});

test("an order that already has every ticket keeps those QR codes", async () => {
  const orderId = await insertOrder({ label: "complete", qty: 2 });
  const first = await insertTicket(orderId, "PHASE2H-FULL-1", "qr-full-1");
  const second = await insertTicket(orderId, "PHASE2H-FULL-2", "qr-full-2");

  await generateTicketsForOrder(orderId, supabase);

  expect(await tickets(orderId)).toEqual([first, second]);
});

test("an incomplete ticket set is completed without rewriting the existing QR code", async () => {
  const orderId = await insertOrder({ label: "incomplete", qty: 3 });
  const kept = await insertTicket(orderId, "PHASE2H-SHORT", "qr-payload-short");

  await generateTicketsForOrder(orderId, supabase);

  const completed = await tickets(orderId);
  expect(completed).toHaveLength(3);
  expect(completed[0]).toEqual(kept);
  expect(new Set(completed.map((ticket) => ticket.ticket_code)).size).toBe(3);
});

test("tickets already used at check-in keep their identity when finalization is repeated", async () => {
  const orderId = await insertOrder({ label: "used-complete", qty: 2 });
  const used = await insertTicket(orderId, "PHASE2H-USED", "qr-payload-used", "used");
  const companion = await insertTicket(orderId, "PHASE2H-STILL-VALID", "qr-payload-valid");

  await insertOrderTickets(supabase, orderId);

  expect(await tickets(orderId)).toEqual([used, companion]);
});

test("a short set that includes a used ticket gains only the missing tickets", async () => {
  const orderId = await insertOrder({ label: "used-short", qty: 3 });
  const used = await insertTicket(orderId, "PHASE2H-USED-SHORT", "qr-payload-used-short", "used");

  await generateTicketsForOrder(orderId, supabase);

  const completed = await tickets(orderId);
  expect(completed).toHaveLength(3);
  expect(completed[0]).toEqual(used);
  expect(
    completed
      .filter((ticket) => ticket.id !== used.id)
      .every((ticket) => ticket.status === "valid" && ticket.used_at === null),
  ).toBe(true);
});

test("an oversized historical set is left in place, including a used ticket", async () => {
  const orderId = await insertOrder({ label: "oversized", qty: 2 });
  const used = await insertTicket(orderId, "PHASE2H-EXTRA-USED", "qr-extra-used", "used");
  const second = await insertTicket(orderId, "PHASE2H-EXTRA-2", "qr-extra-2");
  const third = await insertTicket(orderId, "PHASE2H-EXTRA-3", "qr-extra-3");

  await generateTicketsForOrder(orderId, supabase);

  expect(await tickets(orderId)).toEqual([used, second, third]);
});

test("day and slot orders each receive one set and do not ticket an unpaid order", async () => {
  const dayOrderId = await insertOrder({ label: "day", qty: 2 });
  const slotOrderId = await insertOrder({ label: "slot", qty: 3, entrySlot: true });
  const pendingOrderId = await insertOrder({ label: "pending", qty: 2, status: "pending" });

  await generateTicketsForOrder(dayOrderId, supabase);
  await insertOrderTickets(supabase, slotOrderId);
  await generateTicketsForOrder(pendingOrderId, supabase);

  const dayTickets = await tickets(dayOrderId);
  const slotTickets = await tickets(slotOrderId);
  const dayCodes = new Set(dayTickets.map((ticket) => ticket.ticket_code));
  expect(dayTickets).toHaveLength(2);
  expect(slotTickets).toHaveLength(3);
  expect(await tickets(pendingOrderId)).toEqual([]);
  expect(slotTickets.every((ticket) => !dayCodes.has(ticket.ticket_code))).toBe(true);
});
