-- Read-only. Run this file alone.
-- Zero rows means supabase_migrations.schema_migrations is absent. Stop there.
-- Continue to 06 only when both version and name are listed.
-- When version is listed and name is not, run 06b instead of 06.

select
  column_name,
  data_type,
  ordinal_position
from information_schema.columns
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations'
order by ordinal_position;
