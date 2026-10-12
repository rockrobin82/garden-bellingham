-- Records how many day-sheet seats each order currently contributes.
-- NULL means the contribution was never recorded.
-- Paid day orders that already have sheet_synced_at were incremented and are
-- still paid, so their contribution is ticket_qty. Refunded orders stay NULL:
-- a decrease may already have happened and this migration does not guess.

alter table public.orders
  add column if not exists day_sheet_qty integer;

alter table public.orders
  drop constraint if exists orders_day_sheet_qty_non_negative;

alter table public.orders
  add constraint orders_day_sheet_qty_non_negative
  check (day_sheet_qty is null or day_sheet_qty >= 0);

update public.orders
set day_sheet_qty = ticket_qty
where entry_slot_id is null
  and payment_status = 'paid'
  and sheet_synced_at is not null
  and day_sheet_qty is null;

comment on column public.orders.day_sheet_qty is
  'Seats this day order currently contributes to dates.sold_count. NULL when unknown. Entry-slot orders stay NULL.';

create table if not exists public.day_sold_count_sync (
  booking_date date primary key,
  target_qty integer,
  contributions jsonb not null default '{}'::jsonb,
  status text not null default 'applied',
  updated_at timestamptz not null default now(),
  constraint day_sold_count_sync_status_check
    check (status in ('pending', 'applied')),
  constraint day_sold_count_sync_target_check
    check (
      (status = 'pending' and target_qty is not null and target_qty >= 0)
      or (status = 'applied' and target_qty is null)
    )
);

alter table public.day_sold_count_sync enable row level security;

revoke all on table public.day_sold_count_sync from public, anon, authenticated;
grant select, insert, update on table public.day_sold_count_sync to service_role;

-- Computes one absolute dates.sold_count for a day, or resumes a target that
-- was already decided. Does not read or write Google Sheets.
create or replace function public.plan_day_sold_count_sync(
  p_booking_date date,
  p_sheet_qty integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_target integer;
  v_order record;
  v_recorded integer := 0;
  v_desired integer := 0;
  v_contribution integer;
  v_next integer;
  v_map jsonb := '{}'::jsonb;
begin
  if p_booking_date is null or p_sheet_qty is null or p_sheet_qty < 0 then
    raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:invalid_sheet_value';
  end if;

  insert into public.day_sold_count_sync (booking_date, status)
  values (p_booking_date, 'applied')
  on conflict (booking_date) do nothing;

  select status, target_qty
  into v_status, v_target
  from public.day_sold_count_sync
  where booking_date = p_booking_date
  for update;

  if v_status = 'pending' then
    return jsonb_build_object(
      'action', 'resume',
      'targetQty', v_target
    );
  end if;

  for v_order in
    select
      id,
      ticket_qty,
      payment_status::text as payment_status,
      refund_amount_minor,
      total_amount_minor,
      day_sheet_qty,
      sheet_synced_at
    from public.orders
    where booking_date = p_booking_date
      and entry_slot_id is null
    order by id
    for update
  loop
    if v_order.payment_status not in (
      'pending',
      'paid',
      'failed',
      'cancelled',
      'refunded'
    ) then
      raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:unsupported_status:%', v_order.id;
    end if;

    if v_order.day_sheet_qty is not null
      and v_order.day_sheet_qty <> 0
      and v_order.day_sheet_qty <> v_order.ticket_qty then
      raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:inconsistent_marker:%', v_order.id;
    end if;

    if v_order.payment_status = 'paid' then
      if v_order.refund_amount_minor is not null then
        raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:partial_refund:%', v_order.id;
      end if;

      v_next := v_order.ticket_qty;

      if v_order.day_sheet_qty is not null then
        v_contribution := v_order.day_sheet_qty;
      elsif v_order.sheet_synced_at is not null then
        v_contribution := v_order.ticket_qty;
      else
        v_contribution := 0;
      end if;
    elsif v_order.payment_status = 'refunded' then
      if v_order.refund_amount_minor is not null
        and v_order.refund_amount_minor <> v_order.total_amount_minor then
        raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:partial_refund:%', v_order.id;
      end if;

      v_next := 0;

      if v_order.day_sheet_qty is not null then
        v_contribution := v_order.day_sheet_qty;
      elsif v_order.sheet_synced_at is null then
        v_contribution := 0;
      else
        raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:unknown_sheet_effect:%', v_order.id;
      end if;
    else
      if v_order.day_sheet_qty is not null and v_order.day_sheet_qty <> 0 then
        raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:inconsistent_marker:%', v_order.id;
      end if;

      v_next := 0;
      v_contribution := 0;
    end if;

    v_recorded := v_recorded + v_contribution;
    v_desired := v_desired + v_next;
    v_map := v_map || jsonb_build_object(v_order.id::text, v_next);
  end loop;

  v_target := p_sheet_qty - v_recorded + v_desired;

  if v_target < 0 then
    raise exception
      'DAY_SOLD_COUNT_AMBIGUOUS:unexplained_sheet_value:%:%:%',
      p_sheet_qty,
      v_recorded,
      v_desired;
  end if;

  update public.day_sold_count_sync
  set
    status = 'pending',
    target_qty = v_target,
    contributions = v_map,
    updated_at = now()
  where booking_date = p_booking_date;

  return jsonb_build_object(
    'action', 'write',
    'targetQty', v_target
  );
end;
$$;

-- Applies the planned contribution map when every locked order still has the
-- status assumed by the plan. A changed order clears the plan without writing
-- a second delta; the caller then plans again from the current sheet value.
create or replace function public.complete_day_sold_count_sync(
  p_booking_date date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_map jsonb;
  v_entry record;
  v_qty integer;
  v_payment_status text;
  v_ticket_qty integer;
  v_entry_slot_id text;
  v_expected integer;
  v_count integer;
begin
  if p_booking_date is null then
    raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:invalid_sheet_value';
  end if;

  select status, contributions
  into v_status, v_map
  from public.day_sold_count_sync
  where booking_date = p_booking_date
  for update;

  if not found or v_status is distinct from 'pending' then
    return jsonb_build_object('completed', true);
  end if;

  for v_entry in
    select key, value
    from jsonb_each(coalesce(v_map, '{}'::jsonb))
  loop
    v_qty := (v_entry.value #>> '{}')::integer;

    select payment_status::text, ticket_qty, entry_slot_id
    into v_payment_status, v_ticket_qty, v_entry_slot_id
    from public.orders
    where id = v_entry.key::uuid
    for update;

    if not found or v_entry_slot_id is not null then
      update public.day_sold_count_sync
      set
        status = 'applied',
        target_qty = null,
        contributions = '{}'::jsonb,
        updated_at = now()
      where booking_date = p_booking_date;

      return jsonb_build_object('completed', false);
    end if;

    v_expected := case
      when v_payment_status = 'paid' then v_ticket_qty
      else 0
    end;

    if v_expected <> v_qty then
      update public.day_sold_count_sync
      set
        status = 'applied',
        target_qty = null,
        contributions = '{}'::jsonb,
        updated_at = now()
      where booking_date = p_booking_date;

      return jsonb_build_object('completed', false);
    end if;
  end loop;

  for v_entry in
    select key, value
    from jsonb_each(coalesce(v_map, '{}'::jsonb))
  loop
    v_qty := (v_entry.value #>> '{}')::integer;

    update public.orders
    set
      day_sheet_qty = v_qty,
      sheet_synced_at = case
        when v_qty > 0 and sheet_synced_at is null then now()
        else sheet_synced_at
      end
    where id = v_entry.key::uuid
      and booking_date = p_booking_date
      and entry_slot_id is null;

    get diagnostics v_count = row_count;

    if v_count <> 1 then
      raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:missing_order:%', v_entry.key;
    end if;
  end loop;

  update public.day_sold_count_sync
  set
    status = 'applied',
    target_qty = null,
    contributions = '{}'::jsonb,
    updated_at = now()
  where booking_date = p_booking_date;

  return jsonb_build_object('completed', true);
end;
$$;

revoke all on function public.plan_day_sold_count_sync(date, integer) from public, anon, authenticated;
revoke all on function public.complete_day_sold_count_sync(date) from public, anon, authenticated;
grant execute on function public.plan_day_sold_count_sync(date, integer) to service_role;
grant execute on function public.complete_day_sold_count_sync(date) to service_role;

comment on function public.plan_day_sold_count_sync(date, integer) is
  'Decides one absolute day sold_count from paid day orders and recorded contributions. Does not write the sheet.';

comment on function public.complete_day_sold_count_sync(date) is
  'Stores the planned day-sheet contribution after the absolute sheet write. Does not add or subtract again.';
