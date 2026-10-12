-- Two new orders for the same unseen slot can both observe "no inventory row"
-- and insert. The loser waits on the primary key, then applies the limit to the
-- row the winner committed. sold_qty and held_qty stay untouched.
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
    begin
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
    exception
      when unique_violation then
        select *
        into v_row
        from public.entry_slot_inventory
        where slot_id = p_slot_id
        for update;

        if not found then
          raise exception 'SLOT_NOT_FOUND';
        end if;
    end;
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
