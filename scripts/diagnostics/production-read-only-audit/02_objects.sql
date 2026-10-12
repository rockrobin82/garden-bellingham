-- Read-only. Run this file alone. A null cell means that object is absent.

select
  to_regclass('supabase_migrations.schema_migrations') as schema_migrations,
  to_regtype('public.payment_status') as payment_status,
  to_regclass('public.orders') as orders,
  to_regclass('public.tickets') as tickets,
  to_regclass('public.day_sold_count_sync') as day_sold_count_sync,
  to_regclass('public.entry_slot_inventory') as entry_slot_inventory,
  to_regclass('public.entry_slot_holds') as entry_slot_holds;
