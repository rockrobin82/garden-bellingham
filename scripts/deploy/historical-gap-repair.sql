-- Re-runnable repair for the three objects missing on production.
-- Does not update, insert, or delete orders. Does not touch schema_migrations.
-- Run this whole file once, only after historical-gap-precheck.sql
-- returns decision = repair_allowed.
--
-- Definitions match the original files:
--   20260715100000_add_orders_ticket_breakdown.sql
--     check (normal_qty >= 0)
--     check (reduced_qty >= 0)
--   20260727100000_add_orders_invoice_fields.sql
--     partial index on (invoice_requested, invoice_issued)
--     where invoice_requested = true and invoice_issued = false
--
-- CREATE INDEX CONCURRENTLY is not used. PostgreSQL rejects it inside a
-- transaction block, and the SQL Editor runs this script as one transaction.
-- CREATE INDEX IF NOT EXISTS is the form from the original migration.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_normal_qty_non_negative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_normal_qty_non_negative
      check (normal_qty >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_reduced_qty_non_negative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_reduced_qty_non_negative
      check (reduced_qty >= 0);
  end if;
end
$$;

create index if not exists orders_invoice_pending_idx
  on public.orders (invoice_requested, invoice_issued)
  where invoice_requested = true and invoice_issued = false;
