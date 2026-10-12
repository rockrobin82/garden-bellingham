-- orders and tickets are created by postgres. Supabase default privileges for
-- that role in schema public grant TRUNCATE, REFERENCES, TRIGGER and MAINTAIN
-- to anon and authenticated. No application migration grants TRUNCATE.
-- The server never truncates these tables. Client roles keep every other
-- privilege they already have. service_role is unchanged.

revoke truncate on table public.orders from anon, authenticated;
revoke truncate on table public.tickets from anon, authenticated;
