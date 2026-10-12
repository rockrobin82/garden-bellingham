-- One short transaction decides which refund attempt may move this order forward.
-- The row lock ends when the function returns, before any call to Przelewy24.
-- Other payment_metadata keys are left in place.

create or replace function public.claim_order_refund(
  p_order_id uuid,
  p_recovery jsonb,
  p_expected_states text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_metadata jsonb;
  v_status text;
  v_state text;
  v_updated jsonb;
begin
  if p_order_id is null
    or p_recovery is null
    or jsonb_typeof(p_recovery) <> 'object'
    or coalesce(p_recovery->>'state', '') = ''
    or coalesce(p_recovery->>'requestId', '') = ''
    or p_expected_states is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select payment_metadata, payment_status::text
  into v_metadata, v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_status not in ('paid', 'review') then
    return jsonb_build_object(
      'claimed', false,
      'payment_status', v_status,
      'payment_metadata', coalesce(v_metadata, '{}'::jsonb)
    );
  end if;

  v_state := coalesce(v_metadata #>> '{refund_recovery,state}', 'none');

  if not (v_state = any (p_expected_states)) then
    return jsonb_build_object(
      'claimed', false,
      'payment_status', v_status,
      'payment_metadata', coalesce(v_metadata, '{}'::jsonb)
    );
  end if;

  v_updated := jsonb_set(
    coalesce(v_metadata, '{}'::jsonb),
    '{refund_recovery}',
    p_recovery,
    true
  );

  update public.orders
  set payment_metadata = v_updated
  where id = p_order_id;

  return jsonb_build_object(
    'claimed', true,
    'payment_status', v_status,
    'payment_metadata', v_updated
  );
end;
$$;

revoke all on function public.claim_order_refund(uuid, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_order_refund(uuid, jsonb, text[]) to service_role;

comment on function public.claim_order_refund(uuid, jsonb, text[]) is
  'Atomically replaces refund_recovery when the current state is expected. Does not call a payment provider.';
