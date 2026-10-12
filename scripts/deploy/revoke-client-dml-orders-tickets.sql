-- Prepared privilege correction. Do not run this during the entry-slot migration push.
-- Do not copy it into supabase/migrations until the impact check in
-- docs/production-rollout-checklist.md section 6 is confirmed.
--
-- Removes data and catalog privileges from anon and authenticated on the
-- existing orders and tickets tables. Does not change service_role, postgres,
-- default privileges, or any other table.
-- The Next.js server reaches these tables with the service role. The browser
-- Supabase client in this repository has no callers.

revoke select, insert, update, delete, truncate, references, trigger
  on table public.orders
  from anon, authenticated;

revoke select, insert, update, delete, truncate, references, trigger
  on table public.tickets
  from anon, authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on table public.orders from anon, authenticated';
    execute 'revoke maintain on table public.tickets from anon, authenticated';
  end if;
end
$$;
