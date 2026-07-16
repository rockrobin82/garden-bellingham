alter table public.orders
  add column normal_qty integer not null default 0,
  add column reduced_qty integer not null default 0;

update public.orders
set
  normal_qty = ticket_qty,
  reduced_qty = 0
where ticket_qty > 0;

alter table public.orders
  add constraint orders_normal_qty_non_negative check (normal_qty >= 0),
  add constraint orders_reduced_qty_non_negative check (reduced_qty >= 0);
