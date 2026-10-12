-- The Next.js server uses the service role to create and update orders.
-- Newer local databases do not auto-grant those privileges on public tables.
-- This grant matches the access the server already needs for the existing checkout.

grant select, insert, update on table public.orders to service_role;
