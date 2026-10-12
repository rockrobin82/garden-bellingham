-- Run only after the eleven rollout migrations are applied.
-- Run this whole file once. Success is the error SLOT_CAPACITY_CHECK_OK.
-- That error aborts the block, so the inserted orders, inventory row and hold
-- are rolled back. A different error is a failure and is also rolled back.
-- Do not commit this script. Do not point it at a customer's order.

do $check$
declare
  v_order_a uuid;
  v_order_b uuid;
  v_limit_rejected boolean := false;
begin
  insert into public.orders (
    booking_date,
    customer_email,
    ticket_qty,
    unit_price_minor,
    total_amount_minor
  )
  values ('1900-01-01', 'deploy-check-a@invalid.test', 1, 0, 0)
  returning id into v_order_a;

  insert into public.orders (
    booking_date,
    customer_email,
    ticket_qty,
    unit_price_minor,
    total_amount_minor
  )
  values ('1900-01-01', 'deploy-check-b@invalid.test', 1, 0, 0)
  returning id into v_order_b;

  insert into public.entry_slot_inventory (slot_id, ticket_limit)
  values ('deploy-check-1000-1100', 1);

  perform public.reserve_entry_slot('deploy-check-1000-1100', v_order_a, 1, 60);

  begin
    perform public.reserve_entry_slot('deploy-check-1000-1100', v_order_b, 1, 60);
  exception
    when others then
      if sqlerrm ilike '%INSUFFICIENT_CAPACITY%' then
        v_limit_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_limit_rejected then
    raise exception 'SLOT_CAPACITY_CHECK_FAILED: second reserve was accepted';
  end if;

  perform public.release_entry_slot_hold(v_order_a, 'deploy-check-1000-1100', 1);
  perform public.reserve_entry_slot('deploy-check-1000-1100', v_order_b, 1, 60);

  raise exception 'SLOT_CAPACITY_CHECK_OK';
end
$check$;
