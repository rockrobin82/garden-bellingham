import { Client } from "pg";
import { afterAll, beforeAll, expect, test } from "vitest";

const databaseUrl =
  process.env.ENTRY_SLOT_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const clientRoles = ["anon", "authenticated"] as const;

let pg: Client;

function assertLocalTestTarget(): void {
  const databaseHost = new URL(databaseUrl).hostname;

  if (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") {
    throw new Error("Refusing to run privilege tests against a non-local database");
  }
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

test("postgres defaults in public no longer grant client roles table or sequence privileges", async () => {
  const result = await pg.query<{ kind: string; acl: string }>(
    `select d.defaclobjtype as kind, d.defaclacl::text as acl
     from pg_default_acl d
     join pg_roles r on r.oid = d.defaclrole
     join pg_namespace n on n.oid = d.defaclnamespace
     where r.rolname = 'postgres' and n.nspname = 'public'
     order by d.defaclobjtype`,
  );

  const byKind = Object.fromEntries(result.rows.map((row) => [row.kind, row.acl]));

  expect(byKind.r).toBe("{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres}");
  expect(byKind.S).toBe("{postgres=rwU/postgres,service_role=w/postgres}");
  expect(byKind.r).not.toContain("anon=");
  expect(byKind.r).not.toContain("authenticated=");
  expect(byKind.S).not.toContain("anon=");
  expect(byKind.S).not.toContain("authenticated=");
});

test("a new table and sequence stay closed to client roles and usable by service_role", async () => {
  await pg.query("begin");

  try {
    await pg.query("create table public.phase2k_probe (id int primary key)");
    await pg.query("create sequence public.phase2k_probe_seq");

    for (const role of clientRoles) {
      for (const privilege of [
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "TRUNCATE",
        "REFERENCES",
        "TRIGGER",
        "MAINTAIN",
      ]) {
        const table = await pg.query<{ allowed: boolean }>(
          `select has_table_privilege($1, 'public.phase2k_probe', $2) as allowed`,
          [role, privilege],
        );
        expect(table.rows[0].allowed).toBe(false);
      }

      for (const privilege of ["SELECT", "UPDATE", "USAGE"]) {
        const sequence = await pg.query<{ allowed: boolean }>(
          `select has_sequence_privilege($1, 'public.phase2k_probe_seq', $2) as allowed`,
          [role, privilege],
        );
        expect(sequence.rows[0].allowed).toBe(false);
      }
    }

    for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"]) {
      const table = await pg.query<{ allowed: boolean }>(
        `select has_table_privilege('service_role', 'public.phase2k_probe', $1) as allowed`,
        [privilege],
      );
      expect(table.rows[0].allowed).toBe(true);
    }

    const sequenceUpdate = await pg.query<{ allowed: boolean }>(
      `select has_sequence_privilege('service_role', 'public.phase2k_probe_seq', 'UPDATE') as allowed`,
    );
    expect(sequenceUpdate.rows[0].allowed).toBe(true);

    for (const role of clientRoles) {
      await pg.query("savepoint client_attempt");
      let denied = false;

      try {
        await pg.query(`set local role ${role}`);
        await pg.query("truncate table public.phase2k_probe");
      } catch (error) {
        denied = error instanceof Error && /permission denied/i.test(error.message);
        if (!denied) {
          throw error;
        }
      } finally {
        await pg.query("rollback to savepoint client_attempt");
      }

      expect(denied).toBe(true);

      await pg.query("savepoint client_attempt");
      denied = false;

      try {
        await pg.query(`set local role ${role}`);
        await pg.query("select nextval('public.phase2k_probe_seq')");
      } catch (error) {
        denied = error instanceof Error && /permission denied/i.test(error.message);
        if (!denied) {
          throw error;
        }
      } finally {
        await pg.query("rollback to savepoint client_attempt");
      }

      expect(denied).toBe(true);
    }

    await pg.query("set local role service_role");
    const next = await pg.query<{ value: string }>(
      `select nextval('public.phase2k_probe_seq')::text as value`,
    );
    expect(next.rows[0].value).toBe("1");
  } finally {
    await pg.query("rollback");
  }

  const leftover = await pg.query<{ table_name: string | null; sequence_name: string | null }>(
    `select to_regclass('public.phase2k_probe')::text as table_name,
            to_regclass('public.phase2k_probe_seq')::text as sequence_name`,
  );
  expect(leftover.rows[0]).toEqual({ table_name: null, sequence_name: null });
});

test("existing order access and insert_order_tickets are unchanged", async () => {
  const orders = await pg.query<{ allowed: boolean }>(
    `select
       has_table_privilege('anon', 'public.orders', 'TRUNCATE') = false
       and has_table_privilege('anon', 'public.orders', 'SELECT') = false
       and has_table_privilege('service_role', 'public.orders', 'SELECT')
       and has_table_privilege('service_role', 'public.orders', 'INSERT')
       and has_table_privilege('service_role', 'public.orders', 'UPDATE')
       and has_table_privilege('service_role', 'public.tickets', 'SELECT')
       and has_table_privilege('service_role', 'public.tickets', 'UPDATE')
       as allowed`,
  );
  expect(orders.rows[0].allowed).toBe(true);

  for (const role of ["anon", "authenticated", "authenticator"]) {
    const execute = await pg.query<{ allowed: boolean }>(
      `select has_function_privilege($1, 'public.insert_order_tickets(uuid, text[])', 'EXECUTE') as allowed`,
      [role],
    );
    expect(execute.rows[0].allowed).toBe(false);
  }

  for (const role of ["service_role", "postgres"]) {
    const execute = await pg.query<{ allowed: boolean }>(
      `select has_function_privilege($1, 'public.insert_order_tickets(uuid, text[])', 'EXECUTE') as allowed`,
      [role],
    );
    expect(execute.rows[0].allowed).toBe(true);
  }
});

test("a new function still follows the built-in public execute default", async () => {
  await pg.query("begin");

  try {
    await pg.query(
      "create function public.phase2k_probe_fn() returns int language sql as $$ select 1 $$",
    );
    const acl = await pg.query<{ acl: string | null }>(
      `select proacl::text as acl from pg_proc where proname = 'phase2k_probe_fn'`,
    );
    expect(acl.rows[0].acl).toBeNull();

    for (const role of ["anon", "authenticated", "service_role"]) {
      const execute = await pg.query<{ allowed: boolean }>(
        `select has_function_privilege($1, 'public.phase2k_probe_fn()', 'EXECUTE') as allowed`,
        [role],
      );
      expect(execute.rows[0].allowed).toBe(true);
    }
  } finally {
    await pg.query("rollback");
  }
});
