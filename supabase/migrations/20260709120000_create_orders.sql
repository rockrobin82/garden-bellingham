create type public.payment_status as enum (
  'pending',
  'paid',
  'failed',
  'cancelled'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  booking_date date not null,
  customer_email text not null,
  ticket_qty integer not null,
  unit_price_minor integer not null,
  total_amount_minor integer not null,
  payment_status public.payment_status not null default 'pending',
  p24_session_id text,
  p24_order_id text,
  paid_at timestamptz,
  email_sent_at timestamptz,
  payment_metadata jsonb not null default '{}'::jsonb,
  notes text,

  constraint orders_ticket_qty_positive check (ticket_qty > 0),
  constraint orders_unit_price_non_negative check (unit_price_minor >= 0),
  constraint orders_total_amount_non_negative check (total_amount_minor >= 0)
);

create index orders_booking_date_idx on public.orders (booking_date);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_customer_email_idx on public.orders (customer_email);
create index orders_created_at_idx on public.orders (created_at);

create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();
