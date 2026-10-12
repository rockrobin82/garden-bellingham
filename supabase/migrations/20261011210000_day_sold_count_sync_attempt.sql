-- Extends the phase 2F day-sheet sync with one durable attempt per date.
-- planned: target is stored and has not been sent.
-- submitted: the write was armed; PostgreSQL does not yet know the sheet result.
-- applied: the contribution map is stored.
-- manual_review: the result is ambiguous, so no further sheet write is attempted.
-- A leftover pending row is submitted with no observed value. A later read may
-- confirm it only when the cell already equals the stored target.

alter table public.day_sold_count_sync
  add column if not exists operation_id uuid,
  add column if not exists observed_qty integer,
  add column if not exists detail text;

alter table public.day_sold_count_sync
  drop constraint if exists day_sold_count_sync_status_check;

alter table public.day_sold_count_sync
  drop constraint if exists day_sold_count_sync_target_check;

update public.day_sold_count_sync
set
  status = 'submitted',
  operation_id = coalesce(operation_id, gen_random_uuid()),
  detail = coalesce(detail, 'migrated_pending')
where status = 'pending';

alter table public.day_sold_count_sync
  add constraint day_sold_count_sync_status_check
  check (status in ('planned', 'submitted', 'applied', 'manual_review'));

alter table public.day_sold_count_sync
  add constraint day_sold_count_sync_target_check
  check (
    (
      status = 'planned'
      and target_qty is not null
      and target_qty >= 0
      and observed_qty is not null
      and observed_qty >= 0
      and operation_id is not null
    )
    or (
      status = 'submitted'
      and target_qty is not null
      and target_qty >= 0
      and operation_id is not null
      and (observed_qty is null or observed_qty >= 0)
    )
    or (
      status = 'applied'
      and target_qty is null
      and observed_qty is null
    )
    or status = 'manual_review'
  );

alter table public.day_sold_count_sync
  add constraint day_sold_count_sync_observed_non_negative
  check (observed_qty is null or observed_qty >= 0);

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
  v_observed integer;
  v_operation uuid;
  v_detail text;
  v_order record;
  v_recorded integer := 0;
  v_desired integer := 0;
  v_contribution integer;
  v_next integer;
  v_map jsonb := '{}'::jsonb;
  v_markers_match boolean := true;
begin
  if p_booking_date is null or p_sheet_qty is null or p_sheet_qty < 0 then
    raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:invalid_sheet_value';
  end if;

  insert into public.day_sold_count_sync (booking_date, status)
  values (p_booking_date, 'applied')
  on conflict (booking_date) do nothing;

  select status, target_qty, observed_qty, operation_id, detail
  into v_status, v_target, v_observed, v_operation, v_detail
  from public.day_sold_count_sync
  where booking_date = p_booking_date
  for update;

  if v_status = 'manual_review' then
    return jsonb_build_object(
      'action', 'blocked',
      'targetQty', v_target,
      'observedQty', v_observed,
      'operationId', v_operation,
      'detail', coalesce(v_detail, 'manual_review')
    );
  end if;

  if v_status = 'submitted' then
    if p_sheet_qty = v_target then
      return jsonb_build_object(
        'action', 'confirm',
        'targetQty', v_target,
        'observedQty', v_observed,
        'operationId', v_operation,
        'detail', null
      );
    end if;

    if v_observed is not null and p_sheet_qty = v_observed then
      return jsonb_build_object(
        'action', 'write',
        'targetQty', v_target,
        'observedQty', v_observed,
        'operationId', v_operation,
        'detail', null
      );
    end if;

    v_detail := format(
      'sheet_changed:%s:%s:%s',
      coalesce(v_observed, -1),
      v_target,
      p_sheet_qty
    );

    update public.day_sold_count_sync
    set
      status = 'manual_review',
      detail = v_detail,
      updated_at = now()
    where booking_date = p_booking_date;

    return jsonb_build_object(
      'action', 'blocked',
      'targetQty', v_target,
      'observedQty', v_observed,
      'operationId', v_operation,
      'detail', v_detail
    );
  end if;

  if v_status = 'planned' and p_sheet_qty = v_observed then
    return jsonb_build_object(
      'action', 'dispatch',
      'targetQty', v_target,
      'observedQty', v_observed,
      'operationId', v_operation,
      'detail', null
    );
  end if;

  if v_status = 'planned' then
    update public.day_sold_count_sync
    set
      status = 'applied',
      target_qty = null,
      observed_qty = null,
      operation_id = null,
      contributions = '{}'::jsonb,
      detail = null,
      updated_at = now()
    where booking_date = p_booking_date;
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
    v_detail := null;

    if v_order.payment_status not in (
      'pending',
      'paid',
      'failed',
      'cancelled',
      'refunded'
    ) then
      v_detail := format('unsupported_status:%s', v_order.id);
    elsif v_order.day_sheet_qty is not null
      and v_order.day_sheet_qty <> 0
      and v_order.day_sheet_qty <> v_order.ticket_qty then
      v_detail := format('inconsistent_marker:%s', v_order.id);
    elsif v_order.payment_status = 'paid'
      and v_order.refund_amount_minor is not null then
      v_detail := format('partial_refund:%s', v_order.id);
    elsif v_order.payment_status = 'refunded'
      and v_order.refund_amount_minor is not null
      and v_order.refund_amount_minor <> v_order.total_amount_minor then
      v_detail := format('partial_refund:%s', v_order.id);
    elsif v_order.payment_status = 'refunded'
      and v_order.day_sheet_qty is null
      and v_order.sheet_synced_at is not null then
      v_detail := format('unknown_sheet_effect:%s', v_order.id);
    elsif v_order.payment_status not in ('paid', 'refunded')
      and v_order.day_sheet_qty is not null
      and v_order.day_sheet_qty <> 0 then
      v_detail := format('inconsistent_marker:%s', v_order.id);
    end if;

    if v_detail is not null then
      update public.day_sold_count_sync
      set
        status = 'manual_review',
        detail = v_detail,
        updated_at = now()
      where booking_date = p_booking_date;

      return jsonb_build_object(
        'action', 'blocked',
        'targetQty', null,
        'observedQty', p_sheet_qty,
        'operationId', null,
        'detail', v_detail
      );
    end if;

    if v_order.payment_status = 'paid' then
      v_next := v_order.ticket_qty;

      if v_order.day_sheet_qty is not null then
        v_contribution := v_order.day_sheet_qty;
      elsif v_order.sheet_synced_at is not null then
        v_contribution := v_order.ticket_qty;
      else
        v_contribution := 0;
      end if;
    elsif v_order.payment_status = 'refunded' then
      v_next := 0;

      if v_order.day_sheet_qty is not null then
        v_contribution := v_order.day_sheet_qty;
      else
        v_contribution := 0;
      end if;
    else
      v_next := 0;
      v_contribution := 0;
    end if;

    if v_order.day_sheet_qty is distinct from v_next then
      v_markers_match := false;
    end if;

    v_recorded := v_recorded + v_contribution;
    v_desired := v_desired + v_next;
    v_map := v_map || jsonb_build_object(v_order.id::text, v_next);
  end loop;

  v_target := p_sheet_qty - v_recorded + v_desired;

  if v_target < 0 then
    v_detail := format(
      'unexplained_sheet_value:%s:%s:%s',
      p_sheet_qty,
      v_recorded,
      v_desired
    );

    update public.day_sold_count_sync
    set
      status = 'manual_review',
      detail = v_detail,
      updated_at = now()
    where booking_date = p_booking_date;

    return jsonb_build_object(
      'action', 'blocked',
      'targetQty', null,
      'observedQty', p_sheet_qty,
      'operationId', null,
      'detail', v_detail
    );
  end if;

  if v_target = p_sheet_qty and v_markers_match then
    return jsonb_build_object(
      'action', 'confirm',
      'targetQty', v_target,
      'observedQty', p_sheet_qty,
      'operationId', null,
      'detail', null
    );
  end if;

  v_operation := gen_random_uuid();

  update public.day_sold_count_sync
  set
    status = 'planned',
    target_qty = v_target,
    observed_qty = p_sheet_qty,
    operation_id = v_operation,
    contributions = v_map,
    detail = null,
    updated_at = now()
  where booking_date = p_booking_date;

  return jsonb_build_object(
    'action', 'dispatch',
    'targetQty', v_target,
    'observedQty', p_sheet_qty,
    'operationId', v_operation,
    'detail', null
  );
end;
$$;

create or replace function public.mark_day_sold_count_submitted(
  p_booking_date date,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_operation uuid;
begin
  if p_booking_date is null or p_operation_id is null then
    return jsonb_build_object('marked', false);
  end if;

  select status, operation_id
  into v_status, v_operation
  from public.day_sold_count_sync
  where booking_date = p_booking_date
  for update;

  if not found or v_operation is distinct from p_operation_id then
    return jsonb_build_object('marked', false);
  end if;

  if v_status = 'submitted' then
    return jsonb_build_object('marked', true);
  end if;

  if v_status <> 'planned' then
    return jsonb_build_object('marked', false);
  end if;

  update public.day_sold_count_sync
  set
    status = 'submitted',
    updated_at = now()
  where booking_date = p_booking_date;

  return jsonb_build_object('marked', true);
end;
$$;

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
  v_count integer;
  v_missing boolean := false;
begin
  if p_booking_date is null then
    raise exception 'DAY_SOLD_COUNT_AMBIGUOUS:invalid_sheet_value';
  end if;

  select status, contributions
  into v_status, v_map
  from public.day_sold_count_sync
  where booking_date = p_booking_date
  for update;

  if not found or v_status = 'applied' then
    return jsonb_build_object('completed', true);
  end if;

  if v_status <> 'submitted' then
    return jsonb_build_object('completed', false);
  end if;

  for v_entry in
    select key, value
    from jsonb_each(coalesce(v_map, '{}'::jsonb))
  loop
    perform 1
    from public.orders
    where id = v_entry.key::uuid
      and booking_date = p_booking_date
      and entry_slot_id is null
    for update;

    if not found then
      v_missing := true;
      exit;
    end if;
  end loop;

  if v_missing then
    update public.day_sold_count_sync
    set
      status = 'manual_review',
      detail = 'missing_order',
      updated_at = now()
    where booking_date = p_booking_date;

    return jsonb_build_object('completed', false);
  end if;

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
    observed_qty = null,
    operation_id = null,
    contributions = '{}'::jsonb,
    detail = null,
    updated_at = now()
  where booking_date = p_booking_date;

  return jsonb_build_object('completed', true);
end;
$$;

revoke all on function public.plan_day_sold_count_sync(date, integer) from public, anon, authenticated;
revoke all on function public.mark_day_sold_count_submitted(date, uuid) from public, anon, authenticated;
revoke all on function public.complete_day_sold_count_sync(date) from public, anon, authenticated;
grant execute on function public.plan_day_sold_count_sync(date, integer) to service_role;
grant execute on function public.mark_day_sold_count_submitted(date, uuid) to service_role;
grant execute on function public.complete_day_sold_count_sync(date) to service_role;

comment on function public.plan_day_sold_count_sync(date, integer) is
  'Stores or resumes one absolute day sold_count attempt. Does not write Google Sheets.';

comment on function public.mark_day_sold_count_submitted(date, uuid) is
  'Records that a planned day sold_count write is about to be sent. Does not write Google Sheets.';

comment on function public.complete_day_sold_count_sync(date) is
  'Stores the contribution map after the absolute sheet value is known. Does not add or subtract again.';
