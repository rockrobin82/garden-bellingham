-- Read-only. Run this file alone.
-- A missing name means that column does not exist yet. That is not a query error.

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name in (
    'payment_status',
    'sheet_synced_at',
    'payment_metadata',
    'ticket_qty',
    'entry_slot_id',
    'entry_time_start',
    'entry_time_end',
    'day_sheet_qty'
  )
order by column_name;
