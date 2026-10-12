-- Completes a paid order's ticket set while the order row stays locked.
-- Existing ticket rows are never updated or deleted, so a code already issued
-- and a ticket already marked used at check-in keep their identity.
-- A short set receives only the missing rows. A full set, or a set that is
-- already larger, is left untouched. A failure inside this function rolls
-- the new rows back with the transaction; previously committed tickets stay.

create or replace function public.insert_order_tickets(
  p_order_id uuid,
  p_ticket_codes text[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_qty integer;
  v_status public.payment_status;
  v_existing integer;
  v_needed integer;
  v_inserted integer;
begin
  if p_order_id is null or p_ticket_codes is null then
    raise exception 'INVALID_QTY';
  end if;

  select ticket_qty, payment_status
  into v_qty, v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_status <> 'paid' then
    return 0;
  end if;

  select count(*)::integer
  into v_existing
  from public.tickets
  where order_id = p_order_id;

  if v_existing >= v_qty then
    return v_existing;
  end if;

  v_needed := v_qty - v_existing;

  if cardinality(p_ticket_codes) < v_needed then
    raise exception 'INVALID_QTY';
  end if;

  if exists (
    select 1
    from unnest(p_ticket_codes[1:v_needed]) as supplied(code)
    where supplied.code is null or btrim(supplied.code) = ''
  ) then
    raise exception 'INVALID_QTY';
  end if;

  insert into public.tickets (order_id, ticket_code, qr_payload, status)
  select p_order_id, supplied.code, supplied.code, 'valid'
  from unnest(p_ticket_codes[1:v_needed]) as supplied(code);

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_needed then
    raise exception 'INVALID_QTY';
  end if;

  return v_qty;
end;
$$;

revoke all on function public.insert_order_tickets(uuid, text[]) from public, anon, authenticated;
grant execute on function public.insert_order_tickets(uuid, text[]) to service_role;

comment on function public.insert_order_tickets(uuid, text[]) is
  'Locks a paid order and inserts only the missing tickets. Existing rows, including used tickets, stay as they are.';
