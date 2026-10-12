-- Read-only. Run this file alone. Checks privileges; it does not change them.

with tables as (
  select c.oid, c.relname, c.relacl::text as acl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('orders', 'tickets')
),
roles as (
  select oid, rolname
  from pg_roles
  where rolname in ('anon', 'authenticated', 'service_role', 'postgres')
)
select
  t.relname,
  r.rolname,
  t.acl,
  has_table_privilege(r.oid, t.oid, 'SELECT') as can_select,
  has_table_privilege(r.oid, t.oid, 'INSERT') as can_insert,
  has_table_privilege(r.oid, t.oid, 'UPDATE') as can_update,
  has_table_privilege(r.oid, t.oid, 'DELETE') as can_delete,
  has_table_privilege(r.oid, t.oid, 'TRUNCATE') as can_truncate,
  has_table_privilege(r.oid, t.oid, 'REFERENCES') as can_reference,
  has_table_privilege(r.oid, t.oid, 'TRIGGER') as can_trigger,
  case
    when current_setting('server_version_num')::integer >= 170000
      then has_table_privilege(r.oid, t.oid, 'MAINTAIN')
    else null
  end as can_maintain
from tables t
cross join roles r
order by t.relname, r.rolname;
