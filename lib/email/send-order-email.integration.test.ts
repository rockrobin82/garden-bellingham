import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

import { sendOrderEmail } from "@/lib/email/send-order-email";
import type { Database } from "@/types/database";

vi.mock("@/lib/orders/get-order-with-tickets", () => ({
  getOrderPageUrl: (orderId: string) => `http://127.0.0.1:3000/orders/${orderId}`,
}));

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseUrl =
  process.env.ENTRY_SLOT_TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey =
  process.env.ENTRY_SLOT_TEST_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const emailLike = "phase2h-mail-%@example.test";

let pg: Client;
let supabase: SupabaseClient<Database>;

function assertLocalTestTarget(): void {
  const databaseHost = new URL(databaseUrl).hostname;
  const apiHost = new URL(supabaseUrl).hostname;

  if (
    (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") ||
    (apiHost !== "127.0.0.1" && apiHost !== "localhost")
  ) {
    throw new Error("Refusing to run order email tests against a non-local database");
  }
}

function localSupabase(): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function insertPaidOrder(label: string): Promise<string> {
  const inserted = await pg.query<{ id: string }>(
    `insert into public.orders (
       booking_date, customer_email, ticket_qty, normal_qty, reduced_qty,
       unit_price_minor, total_amount_minor, payment_status
     )
     values ('2099-05-04', $1, 2, 1, 1, 3500, 6000, 'paid')
     returning id::text as id`,
    [`phase2h-mail-${label}@example.test`],
  );

  return inserted.rows[0].id;
}

async function emailSentAt(orderId: string): Promise<string | null> {
  const result = await pg.query<{ email_sent_at: string | null }>(
    `select email_sent_at::text as email_sent_at from public.orders where id = $1`,
    [orderId],
  );

  return result.rows[0]?.email_sent_at ?? null;
}

beforeAll(async () => {
  assertLocalTestTarget();
  pg = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 8000 });
  await pg.connect();
  supabase = localSupabase();
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

test("stores email_sent_at after a successful send and skips the next attempt", async () => {
  const orderId = await insertPaidOrder("once");
  const keys: string[] = [];
  const sendEmail = vi.fn(async (_payload: unknown, options: { idempotencyKey: string }) => {
    keys.push(options.idempotencyKey);
    return { error: null };
  });

  await sendOrderEmail(orderId, {
    supabase,
    fromAddress: "bilety@example.test",
    sendEmail,
  });
  await sendOrderEmail(orderId, {
    supabase,
    fromAddress: "bilety@example.test",
    sendEmail,
  });

  expect(keys).toEqual([`order-confirmation/${orderId}`]);
  expect(await emailSentAt(orderId)).not.toBeNull();
});

test("a rejected send leaves email_sent_at empty and the retry uses the same key", async () => {
  const orderId = await insertPaidOrder("retry");
  const keys: string[] = [];
  const sendEmail = vi
    .fn()
    .mockImplementationOnce(async (_payload: unknown, options: { idempotencyKey: string }) => {
      keys.push(options.idempotencyKey);
      return { error: { message: "mailbox unavailable" } };
    })
    .mockImplementationOnce(async (_payload: unknown, options: { idempotencyKey: string }) => {
      keys.push(options.idempotencyKey);
      return { error: null };
    });

  await expect(
    sendOrderEmail(orderId, {
      supabase,
      fromAddress: "bilety@example.test",
      sendEmail,
    }),
  ).rejects.toThrow(/mailbox unavailable/);
  expect(await emailSentAt(orderId)).toBeNull();

  await sendOrderEmail(orderId, {
    supabase,
    fromAddress: "bilety@example.test",
    sendEmail,
  });

  expect(keys).toEqual([
    `order-confirmation/${orderId}`,
    `order-confirmation/${orderId}`,
  ]);
  expect(await emailSentAt(orderId)).not.toBeNull();
});

test("two overlapping sends both reach Resend with one stable key", async () => {
  const orderId = await insertPaidOrder("overlap");
  const keys: string[] = [];
  let started = 0;
  let releaseBoth: () => void = () => {};
  const bothStarted = new Promise<void>((resolve) => {
    releaseBoth = resolve;
  });
  const sendEmail = async (_payload: unknown, options: { idempotencyKey: string }) => {
    keys.push(options.idempotencyKey);
    started += 1;
    if (started === 2) {
      releaseBoth();
    }
    await bothStarted;
    return { error: null };
  };

  await Promise.race([
    Promise.all([
      sendOrderEmail(orderId, {
        supabase: localSupabase(),
        fromAddress: "bilety@example.test",
        sendEmail,
      }),
      sendOrderEmail(orderId, {
        supabase: localSupabase(),
        fromAddress: "bilety@example.test",
        sendEmail,
      }),
    ]),
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error("email sends did not overlap")), 3000);
    }),
  ]);

  expect(keys).toEqual([
    `order-confirmation/${orderId}`,
    `order-confirmation/${orderId}`,
  ]);
  expect(await emailSentAt(orderId)).not.toBeNull();
});
