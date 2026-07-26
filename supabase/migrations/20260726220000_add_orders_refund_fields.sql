alter type public.payment_status add value if not exists 'refunded';

alter table public.orders
  add column if not exists refunded_at timestamptz;

alter table public.orders
  add column if not exists refund_id text;

alter table public.orders
  add column if not exists refund_amount_minor integer;

alter table public.orders
  add column if not exists refund_reason text;
