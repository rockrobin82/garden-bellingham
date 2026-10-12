-- Read-only. Run this file alone.
-- A null count means the column is absent. It does not mean the count is zero.

with flags as (
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'sheet_synced_at'
    ) as has_sheet_synced_at,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'entry_slot_id'
    ) as has_entry_slot_id,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'entry_time_start'
    ) as has_entry_time_start,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'entry_time_end'
    ) as has_entry_time_end,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'day_sheet_qty'
    ) as has_day_sheet_qty,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'payment_metadata'
    ) as has_payment_metadata
)
select
  has_sheet_synced_at,
  has_entry_slot_id,
  has_entry_time_start,
  has_entry_time_end,
  has_day_sheet_qty,
  has_payment_metadata,
  case
    when not has_sheet_synced_at then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o)->>'payment_status') = 'paid'
        and (to_jsonb(o)->>'sheet_synced_at') is not null
        and (
          not flags.has_entry_slot_id
          or (to_jsonb(o)->>'entry_slot_id') is null
        )
    )
  end as paid_day_orders_with_sheet_synced_at,
  case
    when not has_day_sheet_qty then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o)->>'payment_status') = 'paid'
        and (
          not flags.has_entry_slot_id
          or (to_jsonb(o)->>'entry_slot_id') is null
        )
        and (to_jsonb(o)->>'day_sheet_qty') is null
    )
  end as paid_day_orders_with_null_day_sheet_qty,
  case
    when not (has_sheet_synced_at and has_day_sheet_qty) then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o)->>'payment_status') = 'refunded'
        and (to_jsonb(o)->>'sheet_synced_at') is not null
        and (
          not flags.has_entry_slot_id
          or (to_jsonb(o)->>'entry_slot_id') is null
        )
        and (to_jsonb(o)->>'day_sheet_qty') is null
    )
  end as refunded_day_orders_with_sheet_synced_at_and_null_day_sheet_qty,
  case
    when not has_entry_slot_id then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o)->>'entry_slot_id') is not null
    )
  end as orders_with_entry_slot_id,
  case
    when not (has_entry_slot_id and has_entry_time_start and has_entry_time_end) then null
    else (
      select count(*)
      from public.orders o
      where (
        ((to_jsonb(o)->>'entry_slot_id') is not null)::integer
        + ((to_jsonb(o)->>'entry_time_start') is not null)::integer
        + ((to_jsonb(o)->>'entry_time_end') is not null)::integer
      ) not in (0, 3)
      or (
        (to_jsonb(o)->>'entry_time_start') is not null
        and (to_jsonb(o)->>'entry_time_end') is not null
        and (to_jsonb(o)->>'entry_time_start') >= (to_jsonb(o)->>'entry_time_end')
      )
    )
  end as orders_with_incomplete_entry_window,
  case
    when not has_payment_metadata then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o) #>> '{payment_metadata,refund_recovery,state}')
        in ('unknown', 'submitted', 'manual_review')
    )
  end as orders_with_unresolved_refund_recovery
from flags;
