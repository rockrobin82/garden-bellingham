-- A verified Przelewy24 payment whose entry-slot hold can no longer be confirmed.
-- The order is not paid and has no tickets. An operator refunds it through the
-- existing Przelewy24 refund call. Day orders never use this status.
alter type public.payment_status add value if not exists 'review';

-- Inserts the full ticket set for a paid order, or leaves the existing set in place.
-- Locks the order row so two webhook deliveries cannot insert two sets.
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
  v_code text;
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

  if v_existing > 0 then
    return v_existing;
  end if;

  if cardinality(p_ticket_codes) <> v_qty then
    raise exception 'INVALID_QTY';
  end if;

  foreach v_code in array p_ticket_codes loop
    if v_code is null or btrim(v_code) = '' then
      raise exception 'INVALID_QTY';
    end if;

    insert into public.tickets (order_id, ticket_code, qr_payload, status)
    values (p_order_id, v_code, v_code, 'valid');
  end loop;

  return v_qty;
end;
$$;

revoke all on function public.insert_order_tickets(uuid, text[]) from public, anon, authenticated;
grant execute on function public.insert_order_tickets(uuid, text[]) to service_role;

-- Local Supabase does not always grant service_role DML on tickets.
-- Production already updates tickets through the service role; this grant is then a no-op.
grant select, update on table public.tickets to service_role;

comment on function public.insert_order_tickets(uuid, text[]) is
  'Creates the ticket set for a paid order once. A second call returns the existing count.';
