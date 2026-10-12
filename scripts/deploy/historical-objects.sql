-- Read-only. Run this file alone in the Supabase SQL Editor.
-- One result grid. present means that object from the migration file exists.
-- repair_decision is all_four_complete only when every object below exists.
-- Do not repair a version, and do not run db push, when any row says missing.
-- This file does not write and does not touch schema_migrations.

with objects(version, object_kind, object_name, present) as (
  values
    (
      '20260710210000',
      'column',
      'orders.sheet_synced_at',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'sheet_synced_at'
          and c.udt_name = 'timestamptz'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260715100000',
      'column',
      'orders.normal_qty',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'normal_qty'
          and c.data_type = 'integer'
          and c.is_nullable = 'NO'
          and c.column_default in ('0', '0::integer')
      )
    ),
    (
      '20260715100000',
      'column',
      'orders.reduced_qty',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'reduced_qty'
          and c.data_type = 'integer'
          and c.is_nullable = 'NO'
          and c.column_default in ('0', '0::integer')
      )
    ),
    (
      '20260715100000',
      'constraint',
      'orders_normal_qty_non_negative',
      exists (
        select 1
        from pg_constraint
        where conname = 'orders_normal_qty_non_negative'
          and conrelid = 'public.orders'::regclass
          and pg_get_constraintdef(oid) ilike '%normal_qty >= 0%'
      )
    ),
    (
      '20260715100000',
      'constraint',
      'orders_reduced_qty_non_negative',
      exists (
        select 1
        from pg_constraint
        where conname = 'orders_reduced_qty_non_negative'
          and conrelid = 'public.orders'::regclass
          and pg_get_constraintdef(oid) ilike '%reduced_qty >= 0%'
      )
    ),
    (
      '20260726220000',
      'enum',
      'payment_status.refunded',
      exists (
        select 1
        from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public'
          and t.typname = 'payment_status'
          and e.enumlabel = 'refunded'
      )
    ),
    (
      '20260726220000',
      'column',
      'orders.refunded_at',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'refunded_at'
          and c.udt_name = 'timestamptz'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260726220000',
      'column',
      'orders.refund_id',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'refund_id'
          and c.data_type = 'text'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260726220000',
      'column',
      'orders.refund_amount_minor',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'refund_amount_minor'
          and c.data_type = 'integer'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260726220000',
      'column',
      'orders.refund_reason',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'refund_reason'
          and c.data_type = 'text'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260727100000',
      'column',
      'orders.invoice_requested',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'invoice_requested'
          and c.data_type = 'boolean'
          and c.is_nullable = 'NO'
          and c.column_default in ('false', 'false::boolean')
      )
    ),
    (
      '20260727100000',
      'column',
      'orders.invoice_company_name',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'invoice_company_name'
          and c.data_type = 'text'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260727100000',
      'column',
      'orders.invoice_nip',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'invoice_nip'
          and c.data_type = 'text'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260727100000',
      'column',
      'orders.invoice_street',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'invoice_street'
          and c.data_type = 'text'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260727100000',
      'column',
      'orders.invoice_postal_code',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'invoice_postal_code'
          and c.data_type = 'text'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260727100000',
      'column',
      'orders.invoice_city',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'invoice_city'
          and c.data_type = 'text'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260727100000',
      'column',
      'orders.invoice_issued',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'invoice_issued'
          and c.data_type = 'boolean'
          and c.is_nullable = 'NO'
          and c.column_default in ('false', 'false::boolean')
      )
    ),
    (
      '20260727100000',
      'column',
      'orders.invoice_issued_at',
      exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'orders'
          and c.column_name = 'invoice_issued_at'
          and c.udt_name = 'timestamptz'
          and c.is_nullable = 'YES'
      )
    ),
    (
      '20260727100000',
      'index',
      'orders_invoice_pending_idx',
      exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'orders'
          and indexname = 'orders_invoice_pending_idx'
          and indexdef ilike '%invoice_requested%'
          and indexdef ilike '%invoice_issued%'
      )
    )
)
select
  version,
  object_kind,
  object_name,
  case when present then 'present' else 'missing' end as state,
  case
    when bool_and(present) over () then 'all_four_complete'
    else 'stop'
  end as repair_decision
from objects
order by version, object_kind, object_name;
