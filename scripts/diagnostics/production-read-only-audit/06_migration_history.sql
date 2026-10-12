-- Read-only. Run this file alone, and only when 03 lists both version and name.
-- Reads version and name. Does not read or change statements.

with expected(version, name, rollout_group) as (
  values
    ('20260709120000', 'create_orders', 'historical'),
    ('20260710133000', 'add_orders_p24_token', 'historical'),
    ('20260710140000', 'create_tickets', 'historical'),
    ('20260710210000', 'add_orders_sheet_synced_at', 'historical'),
    ('20260715100000', 'add_orders_ticket_breakdown', 'historical'),
    ('20260726220000', 'add_orders_refund_fields', 'historical'),
    ('20260727100000', 'add_orders_invoice_fields', 'historical'),
    ('20261011160000', 'entry_slot_reservations', 'rollout'),
    ('20261011170000', 'orders_entry_slot_idempotency_key', 'rollout'),
    ('20261011171000', 'grant_orders_to_service_role', 'rollout'),
    ('20261011180000', 'entry_slot_payment_review', 'rollout'),
    ('20261011181000', 'sync_entry_slot_limit_insert_race', 'rollout'),
    ('20261011190000', 'claim_order_refund', 'rollout'),
    ('20261011200000', 'day_sold_count_sync', 'rollout'),
    ('20261011210000', 'day_sold_count_sync_attempt', 'rollout'),
    ('20261011220000', 'insert_order_tickets_complete_set', 'rollout'),
    ('20261011230000', 'revoke_client_truncate_orders_tickets', 'rollout'),
    ('20261012001000', 'limit_postgres_public_default_privileges', 'rollout')
),
applied as (
  select version, name
  from supabase_migrations.schema_migrations
),
compared as (
  select
    coalesce(e.version, a.version) as version,
    e.name as expected_name,
    a.name as applied_name,
    e.rollout_group,
    case
      when e.version is null then 'unexpected'
      when a.version is null and e.rollout_group = 'rollout' then 'missing_rollout'
      when a.version is null then 'missing_historical'
      when e.name is distinct from a.name then 'name_mismatch'
      else 'present'
    end as finding
  from expected e
  full outer join applied a on a.version = e.version
)
select version, expected_name, applied_name, rollout_group, finding
from compared
order by version;
