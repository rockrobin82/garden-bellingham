create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  ticket_code text not null,
  qr_payload text not null,
  status text not null default 'valid',
  created_at timestamptz not null default now(),
  used_at timestamptz,

  constraint tickets_ticket_code_unique unique (ticket_code)
);

create index tickets_order_id_idx on public.tickets (order_id);
