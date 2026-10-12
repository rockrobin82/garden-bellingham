-- Read-only. Run this file alone. The Supabase SQL Editor shows one result set per run.

select
  current_database() as database_name,
  current_user as session_user,
  current_setting('server_version_num') as server_version_num;
