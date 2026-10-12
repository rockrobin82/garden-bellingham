-- Idempotency key for entry-slot order creation.
-- Null on every existing order. Multiple nulls are allowed.
-- Do not apply this file with `supabase db push` until entry-slot checkout is enabled.

alter table public.orders
  add column entry_slot_idempotency_key text;

create unique index orders_entry_slot_idempotency_key_idx
  on public.orders (entry_slot_idempotency_key)
  where entry_slot_idempotency_key is not null;

comment on column public.orders.entry_slot_idempotency_key is
  'Client retry key for one entry-slot order. NULL for day-level orders and historical rows.';
