-- Read-only. Run this file alone. Counts orders per status label. No customer data.

select
  e.enumlabel,
  count(o.id) as orders
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
left join public.orders o
  on o.payment_status = e.enumlabel::public.payment_status
where n.nspname = 'public'
  and t.typname = 'payment_status'
group by e.enumsortorder, e.enumlabel
order by e.enumsortorder;
