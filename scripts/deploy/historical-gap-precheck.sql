-- Read-only. Run this file alone in the Supabase SQL Editor.
-- One row. repair_allowed means the repair script may add the two checks
-- and the partial invoice index. stop means do not run the repair.
-- This file does not change orders or schema_migrations.

select
  negative_normal_qty,
  negative_reduced_qty,
  invoice_index_state,
  case
    when negative_normal_qty > 0 or negative_reduced_qty > 0 then 'stop'
    when invoice_index_state = 'name_conflict' then 'stop'
    else 'repair_allowed'
  end as decision
from (
  select
    (
      select count(*)
      from public.orders
      where normal_qty < 0
    ) as negative_normal_qty,
    (
      select count(*)
      from public.orders
      where reduced_qty < 0
    ) as negative_reduced_qty,
    case
      when exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'orders'
          and indexname = 'orders_invoice_pending_idx'
          and indexdef ilike '%invoice_requested%'
          and indexdef ilike '%invoice_issued%'
      ) then 'present'
      when exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'orders'
          and indexname = 'orders_invoice_pending_idx'
      ) then 'name_conflict'
      else 'missing'
    end as invoice_index_state
) as gap;
