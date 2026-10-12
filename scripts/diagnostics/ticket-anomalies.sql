-- Read-only report of ticket and day-sheet anomalies.
-- Do not add UPDATE, DELETE, or function calls that write.
-- A row here is a case to inspect. This script does not repair anything.

-- More tickets than the order purchased. Leave every row in place.
-- A used ticket or a code already shown to the guest must not be deleted.
select
  'excess_tickets' as category,
  o.id as order_id,
  o.payment_status::text,
  o.entry_slot_id,
  o.ticket_qty,
  count(t.id)::integer as ticket_count,
  count(t.id) filter (where t.status = 'used')::integer as used_count,
  null::text as detail
from public.orders o
join public.tickets t on t.order_id = o.id
group by o.id
having count(t.id) > o.ticket_qty

union all

-- Paid order with fewer tickets than ticket_qty.
-- insert_order_tickets can add only the missing rows and keeps existing QR codes.
-- Run that only after confirming the order is still paid and no refund is in progress.
select
  'paid_missing_tickets' as category,
  o.id,
  o.payment_status::text,
  o.entry_slot_id,
  o.ticket_qty,
  count(t.id)::integer,
  count(t.id) filter (where t.status = 'used')::integer,
  null::text
from public.orders o
left join public.tickets t on t.order_id = o.id
where o.payment_status = 'paid'
group by o.id
having count(t.id) < o.ticket_qty

union all

-- A live or checked-in ticket on an order that is not paid.
-- Do not cancel or delete these automatically: a used ticket is a visit record,
-- and a valid ticket on a refunded order may already have been shown to the guest.
select
  'ticket_on_unexpected_order' as category,
  o.id,
  o.payment_status::text,
  o.entry_slot_id,
  o.ticket_qty,
  count(t.id)::integer,
  count(t.id) filter (where t.status = 'used')::integer,
  string_agg(distinct t.status, ',' order by t.status) as detail
from public.orders o
join public.tickets t on t.order_id = o.id
where t.status in ('valid', 'used')
  and o.payment_status <> 'paid'
group by o.id

union all

-- Cancelled tickets while the order is still paid. Inspect the refund attempt
-- before creating replacements. Do not regenerate codes that were cancelled.
select
  'cancelled_ticket_on_paid_order' as category,
  o.id,
  o.payment_status::text,
  o.entry_slot_id,
  o.ticket_qty,
  count(t.id)::integer,
  count(t.id) filter (where t.status = 'used')::integer,
  null::text
from public.orders o
join public.tickets t on t.order_id = o.id
where o.payment_status = 'paid'
  and t.status = 'cancelled'
group by o.id

union all

-- Day order whose sheet contribution was never recorded, or no longer matches
-- the purchased quantity. The sync ledger decides whether a later reconcile
-- may write. manual_review and an unknown historical effect must be checked
-- against the sheet cell before any write.
select
  'day_sheet_marker' as category,
  o.id,
  o.payment_status::text,
  o.entry_slot_id,
  o.ticket_qty,
  o.day_sheet_qty,
  null::integer,
  case
    when o.entry_slot_id is not null then 'slot order has a day-sheet marker'
    when o.payment_status = 'paid' and o.sheet_synced_at is null and o.day_sheet_qty is null
      then 'paid day order has not been synced'
    when o.payment_status = 'paid' and o.day_sheet_qty is distinct from o.ticket_qty
      then 'paid day marker differs from ticket_qty'
    when o.payment_status = 'refunded' and o.sheet_synced_at is not null and o.day_sheet_qty is null
      then 'refunded day order has an unknown sheet effect'
    else 'day marker needs inspection'
  end
from public.orders o
where (
    o.entry_slot_id is not null
    and o.day_sheet_qty is not null
  )
  or (
    o.entry_slot_id is null
    and o.payment_status = 'paid'
    and (
      (o.sheet_synced_at is null and o.day_sheet_qty is null)
      or o.day_sheet_qty is distinct from o.ticket_qty
    )
  )
  or (
    o.entry_slot_id is null
    and o.payment_status = 'refunded'
    and o.sheet_synced_at is not null
    and o.day_sheet_qty is null
  )

union all

select
  'day_sheet_sync' as category,
  null::uuid,
  s.status::text,
  null::text,
  s.target_qty,
  s.observed_qty,
  null::integer,
  s.booking_date::text || coalesce(' ' || s.detail, '')
from public.day_sold_count_sync s
where s.status in ('planned', 'submitted', 'manual_review')

order by category, order_id;
