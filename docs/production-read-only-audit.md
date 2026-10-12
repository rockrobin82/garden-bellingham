# Audyt tylko do odczytu przed wdrożeniem

Ten dokument przygotowuje odczyt produkcyjnej bazy przed migracjami od `20261011160000` do `20261012001000`. Nie jest wynikiem takiego odczytu. Pola wyników są puste, dopóki operator nie wpisze ich sam.

Potwierdzona luka historii (`create_orders`, `add_orders_p24_token`, `create_tickets` oraz cztery późniejsze pliki historyczne bez wpisu) jest obsłużona w `docs/production-rollout-checklist.md`. Tego audytu nie uruchamia się ponownie.

Lokalna składnia skryptu została sprawdzona na bazie `127.0.0.1`. Ten przebieg nie jest stanem produkcji i nie wypełnia tabel wyników.

## 1. Projekt docelowy

Identyfikator projektu operator wpisuje ręcznie z adresu projektu w panelu Supabase, po tym jak sam potwierdzi, że to właściwa baza. Powiązanie CLI i plik `.env.local` nie są tym potwierdzeniem.

| Pole | Wartość |
|---|---|
| Identyfikator projektu | |
| Kto potwierdził | |
| Data potwierdzenia | |
| Baza z części A (`current_database()`) | |
| Rola sesji (`current_user`) | |

`project_id` w `supabase/config.toml` to lokalna nazwa `garden-bellingham`, a nie identyfikator projektu w usłudze Supabase.

## 2. Sposób połączenia

Repozytorium nie zawiera roli ani adresu ograniczonego do odczytu.

- `NEXT_PUBLIC_SUPABASE_URL` i klucz anon otwierają Data API. To nie jest sesja SQL tylko do odczytu.
- `SUPABASE_SERVICE_ROLE_KEY` omija RLS i może zapisywać. Do tego audytu nie służy.
- `npm run db:push` i `supabase db reset` zmieniają bazę. W tym kroku są zabronione.
- Skrypt nie może być uruchomiony „na tym, co jest aktualnie podlinkowane”, dopóki identyfikator z sekcji 1 nie jest wpisany.

SQL Editor Supabase pokazuje tylko ostatni zestaw wyników skryptu złożonego z wielu poleceń. Dlatego każdy odczyt jest osobnym plikiem z jednym `SELECT` w `scripts/diagnostics/production-read-only-audit/`. Plik `scripts/diagnostics/production-read-only-audit.sql` jest tylko spisem i nie należy go uruchamiać.

Operator wkleja do edytora i uruchamia po jednym pliku, w kolejności numerów. Zatrzymuje się przed `06_migration_history.sql`, gdy `03` nie pokazuje kolumn `version` i `name`; wtedy zamiast `06` uruchamia `06b_migration_history_version_only.sql`. Plik `13_day_sold_count_sync.sql` uruchamia tylko wtedy, gdy `02` pokazuje tę tabelę. Każdy plik jest wyłącznie `SELECT`.

## 3. Część A — wykrycie schematu

```sql
select
  current_database() as database_name,
  current_user as session_user,
  current_setting('server_version_num') as server_version_num;

select
  to_regclass('supabase_migrations.schema_migrations') as schema_migrations,
  to_regtype('public.payment_status') as payment_status,
  to_regclass('public.orders') as orders,
  to_regclass('public.tickets') as tickets,
  to_regclass('public.day_sold_count_sync') as day_sold_count_sync,
  to_regclass('public.entry_slot_inventory') as entry_slot_inventory,
  to_regclass('public.entry_slot_holds') as entry_slot_holds;

select
  column_name,
  data_type,
  ordinal_position
from information_schema.columns
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations'
order by ordinal_position;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name in (
    'payment_status',
    'sheet_synced_at',
    'payment_metadata',
    'ticket_qty',
    'entry_slot_id',
    'entry_time_start',
    'entry_time_end',
    'day_sheet_qty'
  )
order by column_name;

select
  c.relname,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('orders', 'tickets')
order by c.relname;
```

Oczekiwany stan przed wdrożeniem jedenastu migracji:

- `schema_migrations`, `payment_status`, `orders` i `tickets` mają wartość inną niż puste.
- `day_sold_count_sync`, `entry_slot_inventory` i `entry_slot_holds` są puste. Pusta wartość oznacza brak obiektu i nie jest błędem zapytania.
- Kolumny historii zawierają co najmniej `version` i `name`. W lokalnym CLI 2.109.1 występuje też `statements`. Brak `name` zatrzymuje porównanie z części B; wtedy obowiązuje zapytanie samo po `version` z sekcji 4.
- Na `orders` widać `payment_status`, `sheet_synced_at`, `payment_metadata` i `ticket_qty`.
- Brak `entry_slot_id`, `entry_time_start`, `entry_time_end` i `day_sheet_qty` jest oczekiwanym stanem przed migracją. W późniejszych licznikach taki brak daje `null`, nie zero.
- Zapytanie o kolumny historii zwraca zero wierszy, gdy tabeli nie ma. Wtedy część B się nie uruchamia.

| Kontrola | Oczekiwane przed wdrożeniem | Wynik operatora |
|---|---|---|
| `server_version_num` | wpisać liczbę | |
| `schema_migrations` | obecna | |
| `orders`, `tickets`, `payment_status` | obecne | |
| tabele wdrożenia (`day_sold_count_sync`, `entry_slot_*`) | brak | |
| kolumny `schema_migrations` | jest `version` i `name` | |
| kolumny `orders` obecne | cztery historyczne wymienione wyżej | |
| kolumny `orders` nieobecne | cztery kolumny wdrożenia | |
| RLS `orders` i `tickets` | wpisać obie flagi | |

## 4. Część B — historia migracji

Porównanie historii jest w pliku `06_migration_history.sql` i uruchamia się osobno. Nazwa oczekiwana to fragment nazwy pliku po znaczniku czasu, bez `.sql`. Tak zapisuje ją CLI użyte w tym repozytorium. Zapytanie czyta `version` i `name`. Nie czyta `statements` i nie zmienia historii.

```sql
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
```

Oczekiwany wynik przed wdrożeniem: siedem wierszy historycznych ma `present`, jedenaście wierszy `rollout` ma `missing_rollout`, nie ma wierszy `unexpected`, `missing_historical` ani `name_mismatch`.

Gdy część A nie pokazuje kolumny `name`, tego porównania się nie uruchamia. Zastępuje je odczyt samych wersji:

```sql
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
```

| Finding | Oczekiwana liczba przed wdrożeniem | Liczba wpisana przez operatora |
|---|---|---|
| `present` historyczne | 7 | |
| `missing_rollout` | 11 | |
| `missing_historical` | 0 | |
| `unexpected` | 0 | |
| `name_mismatch` | 0 | |

Wersje nieoczekiwane i niezgodne nazwy operator wpisuje tutaj, bez wklejania zawartości kolumny `statements`:

| version | finding | applied_name |
|---|---|---|
| | | |

## 5. Uprawnienia

Litery ACL tabel: `a` INSERT, `r` SELECT, `w` UPDATE, `d` DELETE, `D` TRUNCATE, `x` REFERENCES, `t` TRIGGER. Na PostgreSQL 17 dochodzi `m` MAINTAIN. Zapytanie nie wywołuje `MAINTAIN` na starszym serwerze. Nie wywołuje funkcji aplikacji.

```sql
with tables as (
  select c.oid, c.relname, c.relacl::text as acl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('orders', 'tickets')
),
roles as (
  select oid, rolname
  from pg_roles
  where rolname in ('anon', 'authenticated', 'service_role', 'postgres')
)
select
  t.relname,
  r.rolname,
  t.acl,
  has_table_privilege(r.oid, t.oid, 'SELECT') as can_select,
  has_table_privilege(r.oid, t.oid, 'INSERT') as can_insert,
  has_table_privilege(r.oid, t.oid, 'UPDATE') as can_update,
  has_table_privilege(r.oid, t.oid, 'DELETE') as can_delete,
  has_table_privilege(r.oid, t.oid, 'TRUNCATE') as can_truncate,
  has_table_privilege(r.oid, t.oid, 'REFERENCES') as can_reference,
  has_table_privilege(r.oid, t.oid, 'TRIGGER') as can_trigger,
  case
    when current_setting('server_version_num')::integer >= 170000
      then has_table_privilege(r.oid, t.oid, 'MAINTAIN')
    else null
  end as can_maintain
from tables t
cross join roles r
order by t.relname, r.rolname;
```

Oczekiwane przed decyzją o wdrożeniu: osiem wierszy, po cztery role na `orders` i `tickets`. Dla `anon` i `authenticated` wartości `can_select`, `can_insert`, `can_update`, `can_delete` i `can_truncate` są fałszem. Jeżeli któraś jest prawdą, planowane migracje odbierają co najwyżej `TRUNCATE`. DML zostaje i wdrożenie się zatrzymuje do osobnej poprawki.

Brak wiersza roli oznacza, że roli nie ma. To też zatrzymuje wdrożenie.

`postgres` jako właściciel ma uprawnienia prawdziwe. `service_role` może jeszcze nie mieć `SELECT`, `INSERT` albo `UPDATE`: dodają je migracje `20261011171000` i `20261011180000`. Ten brak nie zatrzymuje odczytu. Zatrzymuje go brak samej roli.

```sql
select
  d.defaclobjtype as object_kind,
  d.defaclacl::text as default_acl
from pg_default_acl d
join pg_roles r on r.oid = d.defaclrole
join pg_namespace n on n.oid = d.defaclnamespace
where r.rolname = 'postgres'
  and n.nspname = 'public'
order by d.defaclobjtype;
```

`r` to tabele, `S` sekwencje, `f` funkcje. Przed migracją `20261012001000` wynik trzeba zapisać. Zatrzymanie dotyczy wpisu tabel, w którym `anon` albo `authenticated` ma literę `a`, `r`, `w` lub `d`: migracja domyślnych uprawnień tych liter nie odbiera, jeśli już tam są.

```sql
with expected(proname) as (
  values
    ('insert_order_tickets'),
    ('claim_order_refund'),
    ('plan_day_sold_count_sync'),
    ('mark_day_sold_count_submitted'),
    ('complete_day_sold_count_sync'),
    ('reserve_entry_slot'),
    ('confirm_entry_slot_hold'),
    ('release_entry_slot_hold'),
    ('sync_entry_slot_limit'),
    ('expire_entry_slot_holds')
),
found as (
  select p.proname, p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select
  e.proname,
  count(f.oid) as overload_count,
  bool_or(f.oid is not null) as present,
  bool_or(
    case
      when f.oid is null then false
      else has_function_privilege('anon', f.oid, 'EXECUTE')
    end
  ) as anon_execute,
  bool_or(
    case
      when f.oid is null then false
      else has_function_privilege('authenticated', f.oid, 'EXECUTE')
    end
  ) as authenticated_execute,
  bool_or(
    case
      when f.oid is null then false
      else has_function_privilege('service_role', f.oid, 'EXECUTE')
    end
  ) as service_role_execute,
  bool_or(
    case
      when f.oid is null then false
      else has_function_privilege('postgres', f.oid, 'EXECUTE')
    end
  ) as postgres_execute
from expected e
left join found f on f.proname = e.proname
group by e.proname
order by e.proname;
```

Przed wdrożeniem każda z tych funkcji ma `present = false`. Funkcja już obecna oznacza częściowo zastosowane migracje. Zapytanie sprawdza tylko przywilej `EXECUTE` i funkcji nie uruchamia.

| Kontrola | Oczekiwane przed wdrożeniem | Wynik operatora |
|---|---|---|
| wiersze uprawnień tabel | 8 | |
| DML albo `TRUNCATE` dla `anon` lub `authenticated` | fałsz | |
| rola `service_role` | obecna | |
| domyślne ACL tabel dla `anon` i `authenticated` | brak liter `a`, `r`, `w`, `d`; wpisać surowy ACL | |
| dziesięć funkcji | `present = false` | |

## 6. Liczniki danych

Zapytania zwracają liczby i etykiety typów. Nie zwracają e-maili, danych faktury, kodów QR, kodów biletów ani identyfikatorów płatności. Brak kolumny daje w liczniku `null`: to sygnał, że migracja jeszcze nie doszła, a nie błąd zapytania.

```sql
select
  e.enumlabel,
  count(o.id) as orders
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
left join public.orders o
  on o.payment_status = e.enumlabel::public.payment_status
where n.nspname = 'public'
  and t.typname = 'payment_status'
group by e.enumsortorder, e.enumlabel
order by e.enumsortorder;
```

Oczekiwane etykiety przed wdrożeniem: `pending`, `paid`, `failed`, `cancelled`, `refunded`. Etykieta `review` albo inna dodatkowa etykieta oznacza, że migracja statusu jest już na bazie.

```sql
with flags as (
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'sheet_synced_at'
    ) as has_sheet_synced_at,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'entry_slot_id'
    ) as has_entry_slot_id,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'entry_time_start'
    ) as has_entry_time_start,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'entry_time_end'
    ) as has_entry_time_end,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'day_sheet_qty'
    ) as has_day_sheet_qty,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'payment_metadata'
    ) as has_payment_metadata
)
select
  has_sheet_synced_at,
  has_entry_slot_id,
  has_entry_time_start,
  has_entry_time_end,
  has_day_sheet_qty,
  has_payment_metadata,
  case
    when not has_sheet_synced_at then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o)->>'payment_status') = 'paid'
        and (to_jsonb(o)->>'sheet_synced_at') is not null
        and (
          not flags.has_entry_slot_id
          or (to_jsonb(o)->>'entry_slot_id') is null
        )
    )
  end as paid_day_orders_with_sheet_synced_at,
  case
    when not has_day_sheet_qty then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o)->>'payment_status') = 'paid'
        and (
          not flags.has_entry_slot_id
          or (to_jsonb(o)->>'entry_slot_id') is null
        )
        and (to_jsonb(o)->>'day_sheet_qty') is null
    )
  end as paid_day_orders_with_null_day_sheet_qty,
  case
    when not (has_sheet_synced_at and has_day_sheet_qty) then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o)->>'payment_status') = 'refunded'
        and (to_jsonb(o)->>'sheet_synced_at') is not null
        and (
          not flags.has_entry_slot_id
          or (to_jsonb(o)->>'entry_slot_id') is null
        )
        and (to_jsonb(o)->>'day_sheet_qty') is null
    )
  end as refunded_day_orders_with_sheet_synced_at_and_null_day_sheet_qty,
  case
    when not has_entry_slot_id then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o)->>'entry_slot_id') is not null
    )
  end as orders_with_entry_slot_id,
  case
    when not (has_entry_slot_id and has_entry_time_start and has_entry_time_end) then null
    else (
      select count(*)
      from public.orders o
      where (
        ((to_jsonb(o)->>'entry_slot_id') is not null)::integer
        + ((to_jsonb(o)->>'entry_time_start') is not null)::integer
        + ((to_jsonb(o)->>'entry_time_end') is not null)::integer
      ) not in (0, 3)
      or (
        (to_jsonb(o)->>'entry_time_start') is not null
        and (to_jsonb(o)->>'entry_time_end') is not null
        and (to_jsonb(o)->>'entry_time_start') >= (to_jsonb(o)->>'entry_time_end')
      )
    )
  end as orders_with_incomplete_entry_window,
  case
    when not has_payment_metadata then null
    else (
      select count(*)
      from public.orders o
      where (to_jsonb(o) #>> '{payment_metadata,refund_recovery,state}')
        in ('unknown', 'submitted', 'manual_review')
    )
  end as orders_with_unresolved_refund_recovery
from flags;
```

`paid_day_orders_with_sheet_synced_at` jest liczbą wierszy, którym migracja `20261011200000` wpisze `day_sheet_qty = ticket_qty`, o ile `sheet_synced_at` naprawdę oznacza już wykonane zwiększenie arkusza. Sam licznik tego nie dowodzi. Operator potwierdza znaczenie kolumny osobno.

`null` przy `day_sheet_qty` i polach przedziału jest oczekiwany przed migracją. Zero w tych kolumnach wyniku pojawia się dopiero wtedy, gdy kolumna istnieje i żaden wiersz nie spełnia warunku.

```sql
with order_rows as (
  select
    (to_jsonb(o)->>'id') as order_id,
    (to_jsonb(o)->>'payment_status') as payment_status,
    (to_jsonb(o)->>'ticket_qty')::integer as ticket_qty
  from public.orders o
),
ticket_rows as (
  select
    (to_jsonb(t)->>'order_id') as order_id,
    (to_jsonb(t)->>'status') as status
  from public.tickets t
),
per_order as (
  select
    o.order_id,
    o.payment_status,
    o.ticket_qty,
    count(t.order_id)::integer as ticket_count,
    count(t.order_id) filter (where t.status = 'valid')::integer as valid_count,
    count(t.order_id) filter (where t.status = 'used')::integer as used_count,
    count(t.order_id) filter (where t.status = 'cancelled')::integer as cancelled_count,
    count(t.order_id) filter (
      where t.status is null or t.status not in ('valid', 'used', 'cancelled')
    )::integer as other_status_count
  from order_rows o
  left join ticket_rows t on t.order_id = o.order_id
  group by o.order_id, o.payment_status, o.ticket_qty
)
select
  count(*) filter (where ticket_count > ticket_qty) as orders_with_excess_tickets,
  count(*) filter (
    where payment_status = 'paid' and ticket_count < ticket_qty
  ) as paid_orders_missing_tickets,
  count(*) filter (
    where payment_status is distinct from 'paid'
      and (valid_count > 0 or used_count > 0)
  ) as non_paid_orders_with_live_tickets,
  count(*) filter (
    where payment_status = 'paid' and cancelled_count > 0
  ) as paid_orders_with_cancelled_tickets,
  count(*) filter (where other_status_count > 0) as orders_with_unlisted_ticket_status,
  coalesce(sum(other_status_count), 0) as tickets_with_unlisted_status
from per_order;
```

Niezerowa anomalia nie uprawnia do usuwania biletów. Wdrożenie nie naprawia tych wierszy.

Gdy część A pokazuje `day_sold_count_sync`, operator uruchamia dodatkowo tylko ten `SELECT`. Gdy regclass jest pusty, zapytania nie uruchamia i wpisuje „tabela nie istnieje”.

```sql
select status, count(*) as rows
from public.day_sold_count_sync
group by status
order by status;
```

| Licznik | Oczekiwane przed wdrożeniem | Wynik operatora |
|---|---|---|
| etykiety `payment_status` | pięć historycznych, bez `review` | |
| `paid_day_orders_with_sheet_synced_at` | liczba; znaczenie `sheet_synced_at` potwierdzone osobno | |
| `paid_day_orders_with_null_day_sheet_qty` | `null`, bo kolumny jeszcze nie ma | |
| `refunded_day_orders_with_sheet_synced_at_and_null_day_sheet_qty` | `null`, bo kolumny jeszcze nie ma | |
| `orders_with_entry_slot_id` | `null` | |
| `orders_with_incomplete_entry_window` | `null` | |
| `orders_with_unresolved_refund_recovery` | liczba do wpisania | |
| pięć liczników anomalii biletów | liczby do wpisania; nie usuwać wierszy | |
| statusy `day_sold_count_sync` | tabela nie istnieje | |
| potwierdzenie, że `sheet_synced_at` oznacza już zrobione zwiększenie arkusza | tak albo nie | |

## 7. Kryteria zatrzymania

Wdrożenie migracji zatrzymać, gdy:

- identyfikator projektu nie jest wpisany w sekcji 1 albo `current_database()` nie pasuje do sesji, którą operator sam otworzył;
- brakuje `schema_migrations`, `orders`, `tickets` albo `payment_status`;
- historia nie ma dokładnie siedmiu obecnych migracji historycznych albo ma wersję spoza listy, niezgodną nazwę albo którąkolwiek z jedenastu migracji wdrożenia;
- `anon` lub `authenticated` ma DML albo `TRUNCATE` na `orders` lub `tickets`;
- domyślne ACL tabel roli `postgres` daje `anon` albo `authenticated` literę `a`, `r`, `w` lub `d`;
- któraś z dziesięciu funkcji już istnieje;
- enum zawiera `review` albo inną etykietę spoza pięciu historycznych;
- istnieje `entry_slot_id`, `day_sheet_qty`, `day_sold_count_sync` albo tabela rezerwacji, mimo że odpowiadającej migracji nie ma w historii;
- niekompletne pola przedziału mają liczbę większą od zera, bo ograniczenie migracji `20261011160000` wtedy nie przejdzie;
- operator nie potwierdził znaczenia `sheet_synced_at` dla licznika opłaconych zamówień dziennych;
- anomalie biletów są niezerowe i nikt nie zapisał, że zostają bez usuwania.

Liczba zamówień ze stanem zwrotu `unknown`, `submitted` albo `manual_review` nie blokuje samej migracji, bo te migracje nie zmieniają `payment_metadata`. Blokuje przełączenie aplikacji, dopóki wskazana osoba nie pilnuje, że dla tych zamówień nie pójdzie drugi zwrot do Przelewy24.

## 8. Lokalne i produkcyjne

Wynik z bazy lokalnej, w tym zerowe anomalie i zielone testy aplikacji, nie opisuje produkcji. Ten dokument nie zawiera wyniku produkcyjnego, bo odczyt produkcyjny wykonuje operator po wpisaniu identyfikatora projektu.
