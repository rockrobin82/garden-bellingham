-- Read-only. Run this file alone. Counts categories only. No ticket codes or emails.

with order_rows as (
  select
    (to_jsonb(o)->>'id') as order_id,
    (to_jsonb(o)->>'payment_status') as payment_status,
    (to_jsonb(o)->>'ticket_qty')::integer as ticket_qty
  from public.orders o
),
ticket_rows as (
  select
    (to_jsonb(t)->>'order_id') as order_id,
    (to_jsonb(t)->>'status') as status
  from public.tickets t
),
per_order as (
  select
    o.order_id,
    o.payment_status,
    o.ticket_qty,
    count(t.order_id)::integer as ticket_count,
    count(t.order_id) filter (where t.status = 'valid')::integer as valid_count,
    count(t.order_id) filter (where t.status = 'used')::integer as used_count,
    count(t.order_id) filter (where t.status = 'cancelled')::integer as cancelled_count,
    count(t.order_id) filter (
      where t.status is null or t.status not in ('valid', 'used', 'cancelled')
    )::integer as other_status_count
  from order_rows o
  left join ticket_rows t on t.order_id = o.order_id
  group by o.order_id, o.payment_status, o.ticket_qty
)
select
  count(*) filter (where ticket_count > ticket_qty) as orders_with_excess_tickets,
  count(*) filter (
    where payment_status = 'paid' and ticket_count < ticket_qty
  ) as paid_orders_missing_tickets,
  count(*) filter (
    where payment_status is distinct from 'paid'
      and (valid_count > 0 or used_count > 0)
  ) as non_paid_orders_with_live_tickets,
  count(*) filter (
    where payment_status = 'paid' and cancelled_count > 0
  ) as paid_orders_with_cancelled_tickets,
  count(*) filter (where other_status_count > 0) as orders_with_unlisted_ticket_status,
  coalesce(sum(other_status_count), 0) as tickets_with_unlisted_status
from per_order;
