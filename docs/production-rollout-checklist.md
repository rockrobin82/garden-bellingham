# Wdrożenie rezerwacji przedziałów wejścia

Pakiet dla produkcji, w której klient ma później wybierać godzinę od–do, a każdy przedział ma własny limit. Ten przebieg tworzy schemat i zostawia dzienną sprzedaż. Publiczne `POST /api/orders` z polem `entrySlotId` nadal zwraca 409 do końca testów z sekcji 7. Nagłówek arkusza `dates` zostaje dzienny.

Nie jest to oświadczenie gotowości produkcyjnej. Lokalne 144 testy, typecheck i build nie opisują produkcji.

Polecenia uruchamia operator z katalogu repozytorium, na projekcie, który sam porównał z identyfikatorem wpisanym przy audycie. `project_id` w `supabase/config.toml` to lokalna nazwa `garden-bellingham`. Tego pakietu nie wykonano na produkcji: bez `db push`, bez wdrożenia aplikacji, bez zapisu do arkusza i bez płatności.

## 1. Co już jest w historii

W `schema_migrations` są tylko:

| Wersja | Nazwa pliku | Skutek, który historia już potwierdza |
|---|---|---|
| `20260709120000` | `create_orders` | Tabela `orders`, enum `payment_status` (`pending`, `paid`, `failed`, `cancelled`), `payment_metadata`, funkcja `set_updated_at()`, trigger `orders_set_updated_at` |
| `20260710133000` | `add_orders_p24_token` | Kolumna `orders.p24_token` |
| `20260710140000` | `create_tickets` | Tabela `tickets`, unikat `ticket_code`, indeks `tickets_order_id_idx`, klucz obcy do `orders` |

Tych trzech plików nie uruchamia się ponownie i nie naprawia.

## 2. Cztery migracje historyczne bez wpisu

Kolumny z tych plików w większości już są. Samo istnienie części kolumn nie uprawnia do oznaczenia pliku jako wykonanego. `supabase db push` zastosowałby je po kolei, zanim dojdzie do jedenastu nowych plików. Plik `20260715100000` zawiera `UPDATE`, który ustawia `normal_qty = ticket_qty` i `reduced_qty = 0` dla każdego zamówienia z biletami. Przy żywej sprzedaży biletów ulgowych tego pliku nie wolno wykonać drugi raz.

Dlatego żaden z tych czterech plików nie wchodzi do `db push`. Po potwierdzeniu wszystkich obiektów operator oznacza wersję jako zastosowaną mechanizmem CLI, bez wykonywania SQL i bez dopisywania wiersza ręcznie do `schema_migrations`.

### `20260710210000_add_orders_sheet_synced_at`

- kolumna `orders.sheet_synced_at timestamptz`, dopuszcza NULL
- brak indeksu, constraintu i aktualizacji wierszy

### `20260715100000_add_orders_ticket_breakdown`

- `orders.normal_qty integer not null default 0`
- `orders.reduced_qty integer not null default 0`
- constraint `orders_normal_qty_non_negative`: `normal_qty >= 0`
- constraint `orders_reduced_qty_non_negative`: `reduced_qty >= 0`
- jednorazowy `UPDATE` backfillu; nie zostawia osobnego obiektu. Gdy kolumny i constrainty są, backfillu nie powtarzać

### `20260726220000_add_orders_refund_fields`

- wartość enum `payment_status`: `refunded`
- kolumny dopuszczające NULL: `refunded_at timestamptz`, `refund_id text`, `refund_amount_minor integer`, `refund_reason text`

### `20260727100000_add_orders_invoice_fields`

- `invoice_requested boolean not null default false`
- `invoice_issued boolean not null default false`
- kolumny dopuszczające NULL: `invoice_company_name`, `invoice_nip`, `invoice_street`, `invoice_postal_code`, `invoice_city`, `invoice_issued_at`
- częściowy indeks `orders_invoice_pending_idx` po `(invoice_requested, invoice_issued)` dla wierszy z fakturą niewystawioną

Plik `scripts/deploy/historical-objects.sql` sprawdza każdy z tych obiektów i zwraca jedną tabelę. Wersję wolno oznaczyć jako zastosowaną tylko wtedy, gdy każdy wiersz ma `state = present` i `repair_decision = all_four_complete`.

Produkcyjny odczyt zostawił trzy braki: `orders_normal_qty_non_negative`, `orders_reduced_qty_non_negative` i `orders_invoice_pending_idx`. Uzupełnia je `scripts/deploy/historical-gap-repair.sql` po odczycie `scripts/deploy/historical-gap-precheck.sql`. Skrypt nie zmienia wartości zamówień i nie zapisuje `schema_migrations`. Potem `historical-objects.sql` uruchamia się ponownie. Inny brak niż te trzy, albo `decision` inne niż `repair_allowed`, zatrzymuje naprawę i `db push`. Starych plików migracji się nie edytuje.

## 3. Jedenaście nowych migracji

Dopiero po naprawie historii. Kolejność jest kolejnością plików. Istniejące zamówienia dzienne zostają. Nowe kolumny godzin i przedziału dopuszczają NULL i dla dotychczasowych wierszy pozostają NULL.

| Kolejność | Wersja | Skutek dla istniejących danych | Blokada |
|---|---|---|---|
| 1 | `20261011160000_entry_slot_reservations` | Nowe tabele `entry_slot_inventory` i `entry_slot_holds`, enum statusu holda, pięć funkcji. Na `orders` trzy kolumny NULL: `entry_slot_id`, `entry_time_start`, `entry_time_end`. Wierszy nie aktualizuje. Klucz obcy i check wymagają albo trzech NULL, albo kompletu z `entry_time_start < entry_time_end`. | `ALTER TABLE` trzyma blokadę `orders` do końca pliku, łącznie ze skanem constraintu i indeksem. |
| 2 | `20261011170000_orders_entry_slot_idempotency_key` | Kolumna `entry_slot_idempotency_key` NULL i częściowy unikat. Wiele NULL jest dozwolonych. Zamówienia dzienne zostają z NULL. | Blokada `orders` na dodanie kolumny i budowę indeksu. |
| 3 | `20261011171000_grant_orders_to_service_role` | `GRANT SELECT, INSERT, UPDATE` na `orders` dla `service_role`. Niczego nie odbiera. | Krótka blokada katalogu. |
| 4 | `20261011180000_entry_slot_payment_review` | Wartość enum `review`. Funkcja `insert_order_tickets`. `GRANT SELECT, UPDATE` na `tickets` dla `service_role`. Wierszy nie zmienia. Status `review` nie jest używany przez zamówienia dzienne. | Krótka blokada typu enum i tabeli `tickets`. |
| 5 | `20261011181000_sync_entry_slot_limit_insert_race` | Podmienia ciało `sync_entry_slot_limit` przy tej samej sygnaturze. ACL zostaje z pliku 1. | Brak przepisywania tabel. |
| 6 | `20261011190000_claim_order_refund` | Nowa funkcja. Czyta i później, przy zwrocie z aplikacji, zapisuje `payment_metadata`. W trakcie migracji zamówień nie zmienia. | Brak przepisywania tabel. |
| 7 | `20261011200000_day_sold_count_sync` | Dodaje `day_sheet_qty`. Dla opłaconych zamówień dziennych z ustawionym `sheet_synced_at` wpisuje `day_sheet_qty = ticket_qty`. Zwroty zostawia z NULL. Tworzy pustą tabelę `day_sold_count_sync`. Nie zmienia `payment_status`, biletów ani arkusza. | Blokada `orders` przez cały plik, w tym przez aktualizację dopasowanych wierszy. |
| 8 | `20261011210000_day_sold_count_sync_attempt` | Przy pierwszym wdrożeniu tabela z pliku 7 jest pusta, więc aktualizacja statusu `pending` dotyka zera wierszy. Dodaje `mark_day_sold_count_submitted` i podmienia plan oraz domknięcie. | Blokada tylko `day_sold_count_sync`. |
| 9 | `20261011220000_insert_order_tickets_complete_set` | Podmienia funkcję biletów. Nie wstawia, nie zmienia i nie usuwa biletów. | Brak przepisywania tabel. |
| 10 | `20261011230000_revoke_client_truncate_orders_tickets` | Odbiera `TRUNCATE` rolom `anon` i `authenticated` na `orders` i `tickets`. Zostawia ich pozostałe uprawnienia i cały dostęp `service_role`. | Krótka blokada obu tabel. |
| 11 | `20261012001000_limit_postgres_public_default_privileges` | Odbiera przyszłym tabelom i sekwencjom tworzonym przez `postgres` część uprawnień `anon` i `authenticated`. Istniejących ACL nie przepisuje. | Brak blokady danych. |

Pliki 1, 2 i 7 blokują zapisy do `orders` do końca swojej transakcji. Webhook i checkout poczekają albo dostaną błąd limitu czasu. Okno to spokojny ruch, nie osobna przerwa liczona z rozmiaru plików. Czasu blokady nie da się odczytać z repozytorium; rośnie z liczbą zamówień, którym plik 7 uzupełnia `day_sheet_qty`.

Plik 7 jest jedynym zapisem do istniejących zamówień. Warunek zapisu: `entry_slot_id is null`, `payment_status = paid`, `sheet_synced_at is not null`, `day_sheet_qty is null`. Przed pushem operator potwierdza, że produkcyjne `sheet_synced_at` oznacza już wykonane zwiększenie `sold_count` w arkuszu. Inne znaczenie zatrzymuje push.

Funkcje `SECURITY DEFINER` z tej listy mają `search_path = pg_catalog, public`, a po utworzeniu tracą `EXECUTE` dla `public`, `anon` i `authenticated`. Dostaje je `service_role`. Plik 5 zachowuje ACL z pliku 1.

`orders` i `tickets` pozostają bez RLS. Nowe tabele rezerwacji i `day_sold_count_sync` mają RLS bez polityk. `service_role` omija RLS.

## 4. Kolejność bazy i kodu

Najpierw historia, potem jedenaście migracji, potem aplikacja. Nowy kod na ścieżce dziennej woła `insert_order_tickets`, `claim_order_refund`, `plan_day_sold_count_sync`, `mark_day_sold_count_submitted` i `complete_day_sold_count_sync` oraz odczytuje `entry_slot_id` i `day_sheet_qty`. Wdrożenie aplikacji przed tymi obiektami przerywa płatność, webhook, bilety QR i synchronizację dzienną.

Odwrotnie: sam schemat, zanim nowa aplikacja przejmie ruch, zostawia dotychczasową sprzedaż. Nowe kolumny dopuszczają NULL. Stara aplikacja może dalej składać zamówienia dzienne, o ile jej rewizja nie wymaga kolumn spoza swojego kodu i nie woła nowych RPC. Rewizja obecnie wdrożona nie jest zapisana w repozytorium; operator potwierdza ją u siebie.

Bramka zostaje w `app/api/orders/route.ts`: body z `entrySlotId` dostaje 409 i tekst `Entry slot checkout is not available`, zanim powstanie zamówienie. W tym oknie nie zmienia się nagłówka `dates`. Produkcyjny nagłówek zostaje: `date`, `active`, `ticket_limit`, `sold_count`, `price_normal`, `price_reduced`, `note`, `max_tickets_per_order`. Nagłówek przedziałów (`slot_id`, `date`, `time_start`, `time_end`, …) włączyłby się kosztem dzisiejszego checkoutu. Nie jest częścią tego wdrożenia.

Sekret wygasania rezerwacji i harmonogram `expire_entry_slot_holds` też nie są częścią tego okna. Publiczna ścieżka nie tworzy holdów.

## 5. Komendy

Z katalogu repozytorium. Nie używać `npm run db:push` ani `npm run db:reset`.

1. Potwierdzić powiązany projekt:

```bash
npx supabase migration list --linked
```

Remote ma zawierać dokładnie `20260709120000`, `20260710133000` i `20260710140000`. Inny zestaw jest warunkiem STOP.

2. W SQL Editorze, osobno, uruchomić `scripts/deploy/historical-objects.sql`. To jedno zapytanie, tylko odczyt. Gdy jedyne braki to dwa constrainty ilości i indeks faktur, najpierw `scripts/deploy/historical-gap-precheck.sql`. Przy `repair_allowed` uruchomić `scripts/deploy/historical-gap-repair.sql`, a potem powtórzyć `historical-objects.sql`.

3. Przed jakimkolwiek pushem potwierdzić znaczenie `sheet_synced_at` z sekcji 3. Gdy operator nie ma tej pewności, push się nie odbywa.

4. Gdy powtórzony odczyt dał `all_four_complete` w każdym wierszu, oznaczyć cztery wersje jako zastosowane. To zapisuje historię i nie wykonuje SQL tych plików:

```bash
npx supabase migration repair --linked --yes --status applied \
  20260710210000 \
  20260715100000 \
  20260726220000 \
  20260727100000
```

5. Powtórzyć `npx supabase migration list --linked`. Cztery wersje są po stronie remote. Jedenastu nowych jeszcze nie ma.

6. Podgląd pusha, nadal bez zapisu schematu biznesowego:

```bash
npx supabase db push --linked --dry-run
```

Lista ma zawierać dokładnie jedenaście wersji z sekcji 3, od `20261011160000` do `20261012001000`, i żadnego pliku `202607`. Inna lista jest warunkiem STOP.

7. W oknie spokojnego ruchu:

```bash
npx supabase db push --linked
```

8. Powtórzyć `npx supabase migration list --linked`. Remote zawiera trzy wersje z sekcji 1, cztery naprawione i jedenaście z sekcji 3. Brak obcej wersji pomiędzy nimi.

9. Wdrożyć aplikację z tej rewizji, sposobem operatora. Publikowana rewizja ma nadal zwracać 409 dla `entrySlotId`.

10. Wykonać testy z sekcji 7. Do ich końca nie ogłaszać wdrożenia i nie przełączać arkusza na przedziały.

Korekta uprawnień z sekcji 6 nie jest krokiem tego pusha. Plik nie leży w `supabase/migrations`, więc `db push` go nie zastosuje.

## 6. Uprawnienia anon i authenticated

Audyt pokazał szerokie uprawnienia tych ról do `orders` i `tickets`. Migracje 10 i 11 odbierają tylko `TRUNCATE` istniejącym tabelom i część uprawnień przyszłych obiektów roli `postgres`. Nie odbierają istniejącego `SELECT`, `INSERT`, `UPDATE` ani `DELETE`.

Przygotowany skrypt: `scripts/deploy/revoke-client-dml-orders-tickets.sql`. Odbiera `anon` i `authenticated` na tych dwóch tabelach: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, a na PostgreSQL 17 także `MAINTAIN`. Nie rusza `service_role`.

Wpływ w tym repozytorium: zamówienia, płatności, webhook, bilety QR, odprawa i arkusz idą przez `getSupabaseAdminClient()`, czyli service role. Pliki `lib/supabase/client.ts` i `lib/supabase/server.ts` nie mają wywołań. Dlatego sam kod tej aplikacji po odbiorze DML nadal zapisuje sprzedaż.

Tego skryptu nie uruchamia się w tym oknie. Najpierw operator potwierdza, że wdrożona rewizja też używa service role do `orders` i `tickets` oraz że żaden zewnętrzny klient nie korzysta z klucza anon wobec tych tabel. Po tym potwierdzeniu skrypt staje się osobną migracją z nową wersją, późniejszą niż `20261012001000`, i osobnym `db push`. Do tej decyzji plik zostaje poza katalogiem migracji.

## 7. Testy po migracji

Na produkcji, po wdrożeniu aplikacji, przy dziennym nagłówku arkusza:

1. Sprzedaż dzienna. Jedno zamówienie operatora, jedna sztuka, własny adres. `POST /api/orders` bez `entrySlotId` tworzy zamówienie `pending`. To zamówienie zwiększy `sold_count` po opłaceniu.
2. Płatność i webhook. Dokończyć płatność Przelewy24. Webhook ustawia `paid`, jeden komplet biletów i jeden zapis `sold_count`. Powtórzenie tego samego webhooka nie dodaje drugiego kompletu i nie zwiększa licznika drugi raz.
3. Bilety QR. Odprawa oznacza bilet jako `used`. Drugie skanowanie tego kodu jest odrzucone. Wiersz zostaje.
4. Zwrot. Pełny zwrot tego zamówienia z panelu admina. Status zwrotu, bilety unieważnione bez usuwania, `sold_count` uzgodniony z księgi. Przy `unknown` albo `submitted` w `payment_metadata.refund_recovery` odpowiedź 404 dostawcy nie wysyła drugiego zwrotu.
5. Bramka przedziału. `POST /api/orders` z `entrySlotId` zwraca 409 i `Entry slot checkout is not available`. `GET /api/availability/slots` przy dziennym nagłówku zwraca 409.
6. Limit przedziału i zwolnienie holda. Po jedenastu migracjach, przed testami dziennymi albo po nich, uruchomić w SQL Editorze cały plik `scripts/deploy/slot-capacity-rollback-check.sql`. Sukces to błąd `SLOT_CAPACITY_CHECK_OK`. Ten błąd wycofuje wstawione zamówienia, wiersz magazynu i hold. Inny błąd jest porażką i też wycofuje zapis. Plik nie commituje.
7. Równoległe rezerwacje. Dwie jednoczesne sesje na produkcji tworzyłyby zamówienia i holdy powiązane kluczem obcym. W tym oknie się ich nie zostawia. Wyścig limitu pokrywają lokalne testy `lib/reservations/entry-slot-reservation.integration.test.ts`. Na produkcji krok 6 sprawdza odmowę drugiego biletu przy limicie 1 i przyjęcie go po zwolnieniu pierwszego holda.

Nie zmieniać nagłówka arkusza. Nie usuwać zamówień ani biletów klienta. Jedno zamówienie testowe z punktów 1–4 zostaje w historii razem ze zwrotem.

Gdy po teście w bazie został wiersz `customer_email` równy `deploy-check-a@invalid.test` albo `deploy-check-b@invalid.test`, wycofanie skryptu limitu nie zadziałało. Zatrzymać się. Usunąć wolno tylko te dwa wiersze, i tylko gdy nie mają płatności ani biletów. Innych zamówień nie ruszać.

## 8. STOP

Zatrzymać się przed `migration repair` i przed `db push`, gdy:

- powiązany projekt CLI nie jest potwierdzoną bazą;
- `migration list` pokazuje inny zestaw niż trzy wersje z sekcji 1;
- `historical-gap-precheck.sql` ma `decision` inne niż `repair_allowed`, albo po skrypcie naprawczym `historical-objects.sql` nadal ma `missing`;
- znaczenie `sheet_synced_at` nie jest potwierdzone;
- suchy przebieg `db push` wymienia jakikolwiek plik `202607` albo inną listę niż jedenaście wersji z sekcji 3.

Zatrzymać się w trakcie pusha, gdy którakolwiek migracja kończy się błędem. Plik idzie jedną transakcją: nieudany plik się wycofuje, wcześniejsze zostają. Nie uruchamiać `db reset`. Nie kasować tabel, kolumn, zamówień ani biletów. Nie oznaczać nieudanej wersji jako zastosowanej. Usunąć przyczynę i puścić `db push` ponownie; zastosuje tylko brakujący ogon.

Zatrzymać się przed wdrożeniem aplikacji, gdy po pushu lista migracji różni się od sekcji 1–3 albo `service_role` nie ma `SELECT`, `INSERT`, `UPDATE` na `orders` oraz `SELECT` i `UPDATE` na `tickets`.

Zatrzymać się po wdrożeniu aplikacji, gdy:

- dzienne zamówienie kontrolne nie dostaje biletów, drugi webhook dodaje bilety albo `sold_count` rośnie drugi raz;
- `entrySlotId` dostaje inny status niż 409;
- zwrot wysyła drugie żądanie po stanie `unknown`, `submitted` albo `manual_review`;
- skrypt limitu kończy się czymś innym niż `SLOT_CAPACITY_CHECK_OK`;
- arkusz dostał nagłówek przedziałów.

Przerwanie oznacza zatrzymanie dalszych zmian. Cofanie przez `DROP` nie jest procedurą tego wdrożenia.

Gdy migracje są zastosowane, a nowy kod jeszcze nie obsługuje ruchu, schemat zostaje. Nie wdrażać części plików i kodu naprzemiennie. Nowy kod wymaga plików 4–9 jednocześnie.

Nie wracać do poprzedniej aplikacji, jeżeli `day_sold_count_sync` ma wiersz `submitted`, `planned` albo `manual_review`, albo komórka `sold_count` została już zapisana przez nowe uzgadnianie. Poprzednia wersja, która dodaje deltę, dopisałaby sprzedaż drugi raz.

## 9. Poza tym oknem

Publiczny wybór godziny od–do wymaga późniejszej zmiany nagłówka arkusza, zdjęcia bramki 409 i harmonogramu wygaszania holdów. To osobna decyzja po testach z sekcji 7.

Korekta DML dla `anon` i `authenticated` czeka na potwierdzenie z sekcji 6. Do tego czasu szerokie uprawnienia pozostają takie, jakie pokazał audyt, z jednym wyjątkiem: migracja 10 odbiera im `TRUNCATE` na `orders` i `tickets`.
