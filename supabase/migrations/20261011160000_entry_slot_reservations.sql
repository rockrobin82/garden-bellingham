-- Entry-slot reservation ledger.
-- orders.id is uuid (20260709120000_create_orders.sql); holds.order_id uses the same type.
-- Existing orders are not updated. entry_slot_id and both clock columns stay NULL.
-- sold_qty is never seeded from a sheet sold_count.
--
-- expires_at does not free seats by itself. A trusted server job should call
--   select public.expire_entry_slot_holds(null);
-- about once a minute, using the service role.
-- reserve_entry_slot expires overdue holds for the targeted slot before taking
-- capacity. confirm_entry_slot_hold does not expire first: while the row is
-- still 'held', confirmation wins the inventory lock even if expires_at has passed.
-- Whichever transaction commits the status change first is the only one that
-- moves held_qty or sold_qty.

create type public.entry_slot_hold_status as enum (
  'held',
  'confirmed',
  'released',
  'expired'
);

create table public.entry_slot_inventory (
  slot_id text primary key,
  ticket_limit integer not null,
  held_qty integer not null default 0,
  sold_qty integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint entry_slot_inventory_slot_id_not_blank check (btrim(slot_id) <> ''),
  constraint entry_slot_inventory_limit_non_negative check (ticket_limit >= 0),
  constraint entry_slot_inventory_held_non_negative check (held_qty >= 0),
  constraint entry_slot_inventory_sold_non_negative check (sold_qty >= 0),
  constraint entry_slot_inventory_within_limit check (held_qty + sold_qty <= ticket_limit)
);

create table public.entry_slot_holds (
  id uuid primary key default gen_random_uuid(),
  slot_id text not null references public.entry_slot_inventory (slot_id),
  order_id uuid not null references public.orders (id),
  qty integer not null,
  status public.entry_slot_hold_status not null default 'held',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,

  constraint entry_slot_holds_qty_positive check (qty > 0),
  constraint entry_slot_holds_order_id_key unique (order_id)
);

create index entry_slot_holds_slot_status_idx
  on public.entry_slot_holds (slot_id, status);

create index entry_slot_holds_expiry_idx
  on public.entry_slot_holds (expires_at)
  where status = 'held';

create trigger entry_slot_inventory_set_updated_at
  before update on public.entry_slot_inventory
  for each row
  execute function public.set_updated_at();

create trigger entry_slot_holds_set_updated_at
  before update on public.entry_slot_holds
  for each row
  execute function public.set_updated_at();

alter table public.orders
  add column entry_slot_id text,
  add column entry_time_start time,
  add column entry_time_end time;

alter table public.orders
  add constraint orders_entry_slot_id_fkey
    foreign key (entry_slot_id)
    references public.entry_slot_inventory (slot_id),
  add constraint orders_entry_window_complete check (
    (
      entry_slot_id is null
      and entry_time_start is null
      and entry_time_end is null
    )
    or (
      entry_slot_id is not null
      and entry_time_start is not null
      and entry_time_end is not null
      and entry_time_start < entry_time_end
    )
  );

create index orders_entry_slot_id_idx
  on public.orders (entry_slot_id)
  where entry_slot_id is not null;

comment on column public.orders.entry_slot_id is
  'Stable slot_id from the dates sheet. NULL on orders placed before entry slots.';

comment on column public.orders.entry_time_start is
  'Entry window start captured at order creation. NULL when entry_slot_id is NULL.';

comment on column public.orders.entry_time_end is
  'Entry window end captured at order creation. NULL when entry_slot_id is NULL.';

comment on table public.entry_slot_inventory is
  'Server-side capacity for one entry slot. ticket_limit is copied from Sheets only through sync_entry_slot_limit. sold_qty is not seeded from the sheet.';

create or replace function public.expire_entry_slot_holds(p_slot_id text default null)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_slot_id text;
  v_released_qty integer;
  v_released_count integer;
  v_total integer := 0;
begin
  if p_slot_id is null then
    for v_slot_id in
      select slot_id
      from public.entry_slot_inventory
      order by slot_id
      for update
    loop
      v_total := v_total + public.expire_entry_slot_holds(v_slot_id);
    end loop;

    return v_total;
  end if;

  if btrim(p_slot_id) = '' then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  perform 1
  from public.entry_slot_inventory
  where slot_id = p_slot_id
  for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND: %', p_slot_id;
  end if;

  with expired as (
    update public.entry_slot_holds
    set
      status = 'expired',
      released_at = pg_catalog.now()
    where slot_id = p_slot_id
      and status = 'held'
      and expires_at <= pg_catalog.now()
    returning qty
  )
  select
    coalesce(sum(qty), 0)::integer,
    count(*)::integer
  into v_released_qty, v_released_count
  from expired;

  if v_released_qty > 0 then
    update public.entry_slot_inventory
    set held_qty = held_qty - v_released_qty
    where slot_id = p_slot_id
      and held_qty >= v_released_qty;

    if not found then
      raise exception 'INVENTORY_MISMATCH';
    end if;
  end if;

  return v_released_count;
end;
$$;

create or replace function public.reserve_entry_slot(
  p_slot_id text,
  p_order_id uuid,
  p_qty integer,
  p_ttl_seconds integer default 900
)
returns public.entry_slot_holds
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inventory public.entry_slot_inventory;
  v_existing public.entry_slot_holds;
  v_hold public.entry_slot_holds;
  v_available integer;
begin
  if p_slot_id is null or btrim(p_slot_id) = '' then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if p_order_id is null
    or p_qty is null
    or p_qty <= 0
    or p_ttl_seconds is null
    or p_ttl_seconds <= 0 then
    raise exception 'INVALID_QTY';
  end if;

  select *
  into v_inventory
  from public.entry_slot_inventory
  where slot_id = p_slot_id
  for update;

  if not found then
    raise exception 'SLOT_NOT_FOUND: %', p_slot_id;
  end if;

  perform public.expire_entry_slot_holds(p_slot_id);

  select *
  into v_inventory
  from public.entry_slot_inventory
  where slot_id = p_slot_id
  for update;

  select *
  into v_existing
  from public.entry_slot_holds
  where order_id = p_order_id
  for update;

  if found then
    if v_existing.slot_id = p_slot_id
      and v_existing.qty = p_qty
      and v_existing.status in ('held', 'confirmed') then
      return v_existing;
    end if;

    if v_existing.status in ('released', 'expired') then
      raise exception 'HOLD_INACTIVE';
    end if;

    raise exception 'HOLD_CONFLICT';
  end if;

  if not v_inventory.active then
    raise exception 'SLOT_INACTIVE';
  end if;

  v_available := v_inventory.ticket_limit - v_inventory.held_qty - v_inventory.sold_qty;

  if p_qty > v_available then
    raise exception 'INSUFFICIENT_CAPACITY';
  end if;

  insert into public.entry_slot_holds (
    slot_id,
    order_id,
    qty,
    status,
    expires_at
  )
  values (
    p_slot_id,
    p_order_id,
    p_qty,
    'held',
    pg_catalog.now() + make_interval(secs => p_ttl_seconds)
  )
  returning * into v_hold;

  update public.entry_slot_inventory
  set held_qty = held_qty + p_qty
  where slot_id = p_slot_id
    and active
    and held_qty + sold_qty + p_qty <= ticket_limit;

  if not found then
    raise exception 'INSUFFICIENT_CAPACITY';
  end if;

  return v_hold;
end;
$$;

create or replace function public.confirm_entry_slot_hold(
  p_order_id uuid,
  p_slot_id text,
  p_qty integer
)
returns public.entry_slot_holds
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_slot_id text;
  v_hold public.entry_slot_holds;
begin
  if p_order_id is null
    or p_slot_id is null
    or btrim(p_slot_id) = ''
    or p_qty is null
    or p_qty <= 0 then
    raise exception 'INVALID_QTY';
  end if;

  select slot_id
  into v_slot_id
  from public.entry_slot_holds
  where order_id = p_order_id;

  if not found then
    raise exception 'HOLD_NOT_FOUND';
  end if;

  perform 1
  from public.entry_slot_inventory
  where slot_id = v_slot_id
  for update;

  select *
  into v_hold
  from public.entry_slot_holds
  where order_id = p_order_id
  for update;

  if v_hold.slot_id <> p_slot_id or v_hold.qty <> p_qty then
    raise exception 'HOLD_CONFLICT';
  end if;

  if v_hold.status = 'confirmed' then
    return v_hold;
  end if;

  if v_hold.status <> 'held' then
    raise exception 'HOLD_INACTIVE';
  end if;

  update public.entry_slot_holds
  set status = 'confirmed'
  where id = v_hold.id
    and status = 'held'
  returning * into v_hold;

  if not found then
    raise exception 'HOLD_INACTIVE';
  end if;

  update public.entry_slot_inventory
  set
    held_qty = held_qty - v_hold.qty,
    sold_qty = sold_qty + v_hold.qty
  where slot_id = v_hold.slot_id
    and held_qty >= v_hold.qty
    and held_qty - v_hold.qty + sold_qty + v_hold.qty <= ticket_limit;

  if not found then
    raise exception 'INVENTORY_MISMATCH';
  end if;

  return v_hold;
end;
$$;

-- Unpaid cancel releases held_qty. Refund of a confirmed hold releases sold_qty.
-- A second call for the same order, slot, and quantity is a no-op.
create or replace function public.release_entry_slot_hold(
  p_order_id uuid,
  p_slot_id text,
  p_qty integer
)
returns public.entry_slot_holds
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_slot_id text;
  v_hold public.entry_slot_holds;
begin
  if p_order_id is null
    or p_slot_id is null
    or btrim(p_slot_id) = ''
    or p_qty is null
    or p_qty <= 0 then
    raise exception 'INVALID_QTY';
  end if;

  select slot_id
  into v_slot_id
  from public.entry_slot_holds
  where order_id = p_order_id;

  if not found then
    raise exception 'HOLD_NOT_FOUND';
  end if;

  perform 1
  from public.entry_slot_inventory
  where slot_id = v_slot_id
  for update;

  select *
  into v_hold
  from public.entry_slot_holds
  where order_id = p_order_id
  for update;

  if v_hold.slot_id <> p_slot_id or v_hold.qty <> p_qty then
    raise exception 'HOLD_CONFLICT';
  end if;

  if v_hold.status in ('released', 'expired') then
    return v_hold;
  end if;

  if v_hold.status = 'held' then
    update public.entry_slot_inventory
    set held_qty = held_qty - v_hold.qty
    where slot_id = v_hold.slot_id
      and held_qty >= v_hold.qty;

    if not found then
      raise exception 'INVENTORY_MISMATCH';
    end if;
  elsif v_hold.status = 'confirmed' then
    update public.entry_slot_inventory
    set sold_qty = sold_qty - v_hold.qty
    where slot_id = v_hold.slot_id
      and sold_qty >= v_hold.qty;

    if not found then
      raise exception 'INVENTORY_MISMATCH';
    end if;
  else
    raise exception 'HOLD_INACTIVE';
  end if;

  update public.entry_slot_holds
  set
    status = 'released',
    released_at = pg_catalog.now()
  where id = v_hold.id
    and status = v_hold.status
  returning * into v_hold;

  if not found then
    raise exception 'HOLD_INACTIVE';
  end if;

  return v_hold;
end;
$$;

-- Applies a limit and active flag edited outside the database.
-- Refuses to shrink the limit below seats already held or sold.
-- Never writes a sheet sold_count into sold_qty. A new slot starts at zero.
create or replace function public.sync_entry_slot_limit(
  p_slot_id text,
  p_ticket_limit integer,
  p_active boolean
)
returns public.entry_slot_inventory
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.entry_slot_inventory;
begin
  if p_slot_id is null or btrim(p_slot_id) = '' then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if p_ticket_limit is null or p_ticket_limit < 0 or p_active is null then
    raise exception 'INVALID_LIMIT';
  end if;

  select *
  into v_row
  from public.entry_slot_inventory
  where slot_id = p_slot_id
  for update;

  if not found then
    insert into public.entry_slot_inventory (
      slot_id,
      ticket_limit,
      held_qty,
      sold_qty,
      active
    )
    values (p_slot_id, p_ticket_limit, 0, 0, p_active)
    returning * into v_row;

    return v_row;
  end if;

  if p_ticket_limit < v_row.held_qty + v_row.sold_qty then
    raise exception
      'LIMIT_BELOW_COMMITTED: committed % exceeds requested limit %',
      v_row.held_qty + v_row.sold_qty,
      p_ticket_limit;
  end if;

  update public.entry_slot_inventory
  set
    ticket_limit = p_ticket_limit,
    active = p_active
  where slot_id = p_slot_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.expire_entry_slot_holds(text) is
  'Frees overdue held seats. expires_at alone does not change counters. Schedule select public.expire_entry_slot_holds(null) from a trusted server job.';

alter table public.entry_slot_inventory enable row level security;
alter table public.entry_slot_holds enable row level security;

revoke all on table public.entry_slot_inventory from public, anon, authenticated;
revoke all on table public.entry_slot_holds from public, anon, authenticated;

grant select on table public.entry_slot_inventory to service_role;
grant select on table public.entry_slot_holds to service_role;

revoke all on function public.expire_entry_slot_holds(text) from public, anon, authenticated;
revoke all on function public.reserve_entry_slot(text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.confirm_entry_slot_hold(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_entry_slot_hold(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.sync_entry_slot_limit(text, integer, boolean) from public, anon, authenticated;

grant execute on function public.expire_entry_slot_holds(text) to service_role;
grant execute on function public.reserve_entry_slot(text, uuid, integer, integer) to service_role;
grant execute on function public.confirm_entry_slot_hold(uuid, text, integer) to service_role;
grant execute on function public.release_entry_slot_hold(uuid, text, integer) to service_role;
grant execute on function public.sync_entry_slot_limit(text, integer, boolean) to service_role;
