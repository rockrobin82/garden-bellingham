-- Read-only. Run this file alone only when 03 lists version and does not list name.
-- Do not run it together with 06.

with expected(version, rollout_group) as (
  values
    ('20260709120000', 'historical'),
    ('20260710133000', 'historical'),
    ('20260710140000', 'historical'),
    ('20260710210000', 'historical'),
    ('20260715100000', 'historical'),
    ('20260726220000', 'historical'),
    ('20260727100000', 'historical'),
    ('20261011160000', 'rollout'),
    ('20261011170000', 'rollout'),
    ('20261011171000', 'rollout'),
    ('20261011180000', 'rollout'),
    ('20261011181000', 'rollout'),
    ('20261011190000', 'rollout'),
    ('20261011200000', 'rollout'),
    ('20261011210000', 'rollout'),
    ('20261011220000', 'rollout'),
    ('20261011230000', 'rollout'),
    ('20261012001000', 'rollout')
),
applied as (
  select version
  from supabase_migrations.schema_migrations
),
compared as (
  select
    coalesce(e.version, a.version) as version,
    e.rollout_group,
    case
      when e.version is null then 'unexpected'
      when a.version is null and e.rollout_group = 'rollout' then 'missing_rollout'
      when a.version is null then 'missing_historical'
      else 'present'
    end as finding
  from expected e
  full outer join applied a on a.version = e.version
)
select version, rollout_group, finding
from compared
order by version;
