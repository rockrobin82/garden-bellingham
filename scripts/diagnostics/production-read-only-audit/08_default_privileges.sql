-- Read-only. Run this file alone.
-- object_kind: r = tables, S = sequences, f = functions.

select
  d.defaclobjtype as object_kind,
  d.defaclacl::text as default_acl
from pg_default_acl d
join pg_roles r on r.oid = d.defaclrole
join pg_namespace n on n.oid = d.defaclnamespace
where r.rolname = 'postgres'
  and n.nspname = 'public'
order by d.defaclobjtype;
