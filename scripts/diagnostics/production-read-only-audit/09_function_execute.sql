-- Read-only. Run this file alone. Reports EXECUTE only; it does not call the functions.

with expected(proname) as (
  values
    ('insert_order_tickets'),
    ('claim_order_refund'),
    ('plan_day_sold_count_sync'),
    ('mark_day_sold_count_submitted'),
    ('complete_day_sold_count_sync'),
    ('reserve_entry_slot'),
    ('confirm_entry_slot_hold'),
    ('release_entry_slot_hold'),
    ('sync_entry_slot_limit'),
    ('expire_entry_slot_holds')
),
found as (
  select p.proname, p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select
  e.proname,
  count(f.oid) as overload_count,
  bool_or(f.oid is not null) as present,
  bool_or(
    case
      when f.oid is null then false
      else has_function_privilege('anon', f.oid, 'EXECUTE')
    end
  ) as anon_execute,
  bool_or(
    case
      when f.oid is null then false
      else has_function_privilege('authenticated', f.oid, 'EXECUTE')
    end
  ) as authenticated_execute,
  bool_or(
    case
      when f.oid is null then false
      else has_function_privilege('service_role', f.oid, 'EXECUTE')
    end
  ) as service_role_execute,
  bool_or(
    case
      when f.oid is null then false
      else has_function_privilege('postgres', f.oid, 'EXECUTE')
    end
  ) as postgres_execute
from expected e
left join found f on f.proname = e.proname
group by e.proname
order by e.proname;
