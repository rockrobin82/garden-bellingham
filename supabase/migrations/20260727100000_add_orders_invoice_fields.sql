alter table public.orders
  add column if not exists invoice_requested boolean not null default false;

alter table public.orders
  add column if not exists invoice_company_name text;

alter table public.orders
  add column if not exists invoice_nip text;

alter table public.orders
  add column if not exists invoice_street text;

alter table public.orders
  add column if not exists invoice_postal_code text;

alter table public.orders
  add column if not exists invoice_city text;

alter table public.orders
  add column if not exists invoice_issued boolean not null default false;

alter table public.orders
  add column if not exists invoice_issued_at timestamptz;

create index if not exists orders_invoice_pending_idx
  on public.orders (invoice_requested, invoice_issued)
  where invoice_requested = true and invoice_issued = false;
