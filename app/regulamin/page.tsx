import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";

const title = "Regulamin | Ogród Bellingham Bilety";
const description =
  "Regulamin aplikacji do rezerwacji biletów Ogród Bellingham.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/regulamin",
  },
  openGraph: {
    title,
    description,
    url: "/regulamin",
    siteName: "Ogród Bellingham Bilety",
    type: "article",
  },
};

const sections = [
  "Seller Information",
  "Definitions",
  "Scope of Services",
  "Booking Process",
  "Ticket Purchase",
  "Prices",
  "Payment Methods",
  "Ticket Delivery",
  "Refunds",
  "Complaints",
  "Consumer Rights",
  "Liability",
  "Contact",
  "Final Provisions",
] as const;

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Dokumenty prawne"
      title="Regulamin"
      description="Struktura regulaminu aplikacji biletowej. Treść prawna zostanie dodana później."
      sections={sections}
      placeholderPrefix="TODO: Regulamin"
    >
      <LegalSection title="§1. Postanowienia ogólne">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Niniejszy Regulamin określa zasady sprzedaży biletów elektronicznych za
            pośrednictwem serwisu internetowego dostępnego pod adresem{" "}
            <strong>https://bilety.katarzynabellingham.pl</strong>.
          </li>
          <li>
            <p>Sprzedawcą biletów jest:</p>
            <p className="mt-3">
              <strong>Ogród Bellingham &quot;the Garden&quot; Katarzyna Bellingham</strong>
            </p>
            <p className="mt-3">
              NIP: <strong>9570775872</strong>
            </p>
            <p className="mt-3">
              REGON: <strong>222091433</strong>
            </p>
            <p className="mt-3">Adres prowadzenia działalności:</p>
            <p className="mt-3">
              ul. Zamkowa 2A
              <br />
              83-322 Zgorzałe
            </p>
            <p className="mt-3">Adres do korespondencji:</p>
            <p className="mt-3">
              ul. Manifestu Połanieckiego 6/3
              <br />
              80-406 Gdańsk
            </p>
            <p className="mt-3">Adres e-mail:</p>
            <p className="mt-3">
              <strong>
                <a
                  href="mailto:biuro@angielskieogrody.com"
                  className="text-[#1f4d35] underline-offset-4 hover:underline"
                >
                  biuro@angielskieogrody.com
                </a>
              </strong>
            </p>
          </li>
          <li>
            Regulamin stanowi regulamin świadczenia usług drogą elektroniczną w
            rozumieniu obowiązujących przepisów prawa.
          </li>
          <li>Zakup biletu oznacza akceptację niniejszego Regulaminu.</li>
        </ol>
      </LegalSection>

      <LegalSection title="§2. Definicje">
        <p className="mt-3 text-sm leading-6 text-[#666]">
          Na potrzeby Regulaminu przyjmuje się następujące definicje:
        </p>
        <dl className="mt-4 space-y-3 text-sm leading-6 text-[#666]">
          <div>
            <dt className="font-semibold text-[#1f4d35]">Serwis</dt>
            <dd>
              strona internetowa służąca do sprzedaży biletów pod adresem
              https://bilety.katarzynabellingham.pl.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#1f4d35]">Sprzedawca</dt>
            <dd>Ogród Bellingham &quot;the Garden&quot; Katarzyna Bellingham.</dd>
          </div>
          <div>
            <dt className="font-semibold text-[#1f4d35]">Kupujący</dt>
            <dd>
              osoba fizyczna, osoba prawna lub jednostka organizacyjna dokonująca
              zakupu biletu.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#1f4d35]">Bilet elektroniczny</dt>
            <dd>
              dokument uprawniający do jednorazowego wejścia do Ogrodu Bellingham
              w określonym terminie.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#1f4d35]">Termin zwiedzania</dt>
            <dd>dzień wskazany podczas zakupu biletu.</dd>
          </div>
        </dl>
      </LegalSection>

      <LegalSection title="§3. Zakup biletów">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>Zakupu biletów można dokonać wyłącznie poprzez Serwis.</li>
          <li>
            <p>Kupujący wybiera:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>termin zwiedzania,</li>
              <li>rodzaj biletu,</li>
              <li>liczbę biletów.</li>
            </ul>
          </li>
          <li>Liczba dostępnych miejsc na poszczególne terminy jest ograniczona.</li>
          <li>
            Umowa sprzedaży zostaje zawarta z chwilą otrzymania przez Sprzedawcę
            potwierdzenia poprawnego dokonania płatności.
          </li>
          <li>
            Po zaksięgowaniu płatności Kupujący otrzymuje bilet elektroniczny na
            wskazany adres e-mail.
          </li>
          <li>
            Sprzedawca zastrzega możliwość zakończenia sprzedaży biletów na dany
            termin po wyczerpaniu dostępnej puli.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§4. Ceny i płatności">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>Wszystkie ceny podawane są w złotych polskich (PLN).</li>
          <li>Ceny zawierają wszystkie należne podatki.</li>
          <li>
            Płatności realizowane są za pośrednictwem operatora płatności{" "}
            <strong>Przelewy24</strong>.
          </li>
          <li>
            Dostępne metody płatności zależą od aktualnej oferty operatora płatności.
          </li>
          <li>
            Sprzedawca nie ponosi odpowiedzialności za przerwy w funkcjonowaniu
            systemów płatniczych pozostających po stronie operatora płatności.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§5. Dostarczenie biletu">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>Bilet dostarczany jest wyłącznie w formie elektronicznej.</li>
          <li>
            Bilet elektroniczny zostanie przesłany na adres e-mail podany podczas
            składania zamówienia nie później niż w ciągu 24 godzin od otrzymania
            potwierdzenia dokonania płatności.
          </li>
          <li>
            W większości przypadków bilet dostarczany jest w ciągu kilku minut od
            zaksięgowania płatności.
          </li>
          <li>Kupujący zobowiązany jest do podania prawidłowego adresu e-mail.</li>
          <li>
            W przypadku nieotrzymania biletu Kupujący powinien sprawdzić folder SPAM
            lub Oferty, a następnie skontaktować się ze Sprzedawcą.
          </li>
          <li>
            Bilet należy okazać podczas wejścia do Ogrodu w formie elektronicznej
            lub wydrukowanej.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§6. Zasady korzystania z biletów">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Bilet uprawnia do jednorazowego wejścia do Ogrodu Bellingham w terminie
            wskazanym podczas zakupu.
          </li>
          <li>Bilet może zostać wykorzystany wyłącznie w dacie, na którą został zakupiony.</li>
          <li>
            Sprzedawca może odmówić wejścia osobie posługującej się nieważnym,
            podrobionym lub wykorzystanym wcześniej biletem.
          </li>
          <li>
            Kupujący zobowiązany jest do przestrzegania zasad obowiązujących na
            terenie Ogrodu.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§7. Odstąpienie od umowy">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Zgodnie z art. 38 pkt 12 ustawy z dnia 30 maja 2014 r. o prawach
            konsumenta, Konsumentowi nie przysługuje prawo odstąpienia od umowy
            zawartej na odległość dotyczącej usług związanych z wydarzeniami
            rekreacyjnymi, jeżeli umowa przewiduje oznaczony dzień lub okres
            świadczenia usługi.
          </li>
          <li>
            Zakup biletu na określony termin nie podlega odstąpieniu od umowy po
            dokonaniu płatności.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§8. Reklamacje">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            <p>
              Reklamacje dotyczące działania Serwisu lub procesu zakupu można
              zgłaszać drogą elektroniczną na adres:
            </p>
            <p className="mt-3">
              <strong>
                <a
                  href="mailto:biuro@angielskieogrody.com"
                  className="text-[#1f4d35] underline-offset-4 hover:underline"
                >
                  biuro@angielskieogrody.com
                </a>
              </strong>
            </p>
          </li>
          <li>
            <p>Reklamacja powinna zawierać:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>imię i nazwisko,</li>
              <li>adres e-mail,</li>
              <li>opis problemu,</li>
              <li>numer zamówienia (jeżeli został nadany).</li>
            </ul>
          </li>
          <li>Reklamacje rozpatrywane są w terminie do 14 dni od dnia ich otrzymania.</li>
        </ol>
      </LegalSection>

      <LegalSection title="§9. Dane osobowe">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>Administratorem danych osobowych jest Sprzedawca.</li>
          <li>
            <p>Dane osobowe przetwarzane są wyłącznie w celu:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>realizacji sprzedaży biletów,</li>
              <li>obsługi płatności,</li>
              <li>wystawienia dokumentów sprzedaży,</li>
              <li>rozpatrywania reklamacji,</li>
              <li>
                kontaktu z Kupującym w sprawach związanych z realizacją zamówienia.
              </li>
            </ul>
          </li>
          <li>
            Szczegółowe informacje dotyczące przetwarzania danych osobowych znajdują
            się w Polityce Prywatności.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§10. Odwołanie terminu zwiedzania i siła wyższa">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Sprzedawca dokłada wszelkich starań, aby zwiedzanie Ogrodu odbywało
            się zgodnie z opublikowanym harmonogramem.
          </li>
          <li>
            <p>
              W wyjątkowych sytuacjach, niezależnych od Sprzedawcy, termin
              zwiedzania może zostać odwołany lub przeniesiony. Dotyczy to w
              szczególności:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>ekstremalnych warunków pogodowych,</li>
              <li>zagrożeń dla bezpieczeństwa odwiedzających,</li>
              <li>decyzji właściwych organów administracji publicznej,</li>
              <li>awarii technicznych uniemożliwiających udostępnienie Ogrodu,</li>
              <li>innych zdarzeń noszących znamiona siły wyższej.</li>
            </ul>
          </li>
          <li>
            W przypadku odwołania terminu z przyczyn leżących po stronie
            Sprzedawcy Kupujący zostanie niezwłocznie poinformowany drogą
            elektroniczną.
          </li>
          <li>
            <p>W takiej sytuacji Kupującemu przysługuje wybór:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>zmiany terminu zwiedzania na inny dostępny,</li>
              <li>otrzymania zwrotu pełnej kwoty zapłaconej za bilety.</li>
            </ul>
          </li>
          <li>
            Zwrot środków nastąpi tą samą metodą płatności, którą dokonano zakupu,
            chyba że Kupujący wyrazi zgodę na inne rozwiązanie.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§11. Zasady zwiedzania Ogrodu">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Zakup biletu oznacza akceptację zasad obowiązujących na terenie Ogrodu
            Bellingham &quot;the Garden&quot;.
          </li>
          <li>
            Zwiedzający zobowiązani są do zachowania szczególnej ostrożności oraz
            stosowania się do poleceń obsługi.
          </li>
          <li>
            <p>Na terenie Ogrodu zabrania się w szczególności:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>niszczenia roślin i elementów infrastruktury,</li>
              <li>zrywania kwiatów, owoców oraz innych części roślin,</li>
              <li>
                wchodzenia na rabaty i miejsca oznaczone jako niedostępne dla
                zwiedzających,
              </li>
              <li>pozostawiania odpadów poza wyznaczonymi miejscami,</li>
              <li>zachowań mogących zagrażać bezpieczeństwu innych osób.</li>
            </ul>
          </li>
          <li>
            Dzieci do ukończenia 13. roku życia mogą przebywać na terenie Ogrodu
            wyłącznie pod opieką osoby dorosłej.
          </li>
          <li>
            Zwierzęta mogą przebywać na terenie Ogrodu wyłącznie zgodnie z aktualnymi
            zasadami obowiązującymi u Sprzedawcy. Właściciel zwierzęcia ponosi pełną
            odpowiedzialność za jego zachowanie.
          </li>
          <li>
            Wykonywanie zdjęć i nagrań na użytek prywatny jest dozwolone, o ile nie
            narusza prywatności innych osób oraz nie utrudnia zwiedzania.
          </li>
          <li>
            Fotografowanie lub filmowanie w celach komercyjnych wymaga wcześniejszej
            zgody Sprzedawcy.
          </li>
          <li>
            Sprzedawca nie ponosi odpowiedzialności za rzeczy pozostawione bez nadzoru
            na terenie Ogrodu.
          </li>
          <li>
            Osoby naruszające niniejszy Regulamin lub zasady bezpieczeństwa mogą
            zostać wyproszone z terenu Ogrodu bez prawa do zwrotu ceny biletu.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§12. Faktury VAT">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>Sprzedawca umożliwia wystawienie faktury VAT dokumentującej zakup biletów.</li>
          <li>
            W celu otrzymania faktury Kupujący powinien podać dane niezbędne do jej
            wystawienia podczas składania zamówienia lub zgłosić taką potrzebę drogą
            elektroniczną nie później niż w terminie wynikającym z obowiązujących
            przepisów prawa podatkowego.
          </li>
          <li>
            Faktura VAT zostanie wystawiona zgodnie z obowiązującymi przepisami prawa
            i przesłana w formie elektronicznej na adres e-mail wskazany przez
            Kupującego, chyba że strony uzgodnią inny sposób jej przekazania.
          </li>
          <li>
            Podanie numeru NIP po dokonaniu zakupu może uniemożliwić wystawienie
            faktury, jeżeli obowiązujące przepisy wymagają przekazania tych danych na
            wcześniejszym etapie zawierania transakcji.
          </li>
          <li>
            Kupujący ponosi odpowiedzialność za poprawność danych przekazanych do
            wystawienia faktury.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§13. Postanowienia końcowe">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Sprzedawca zastrzega sobie prawo do zmiany niniejszego Regulaminu z
            ważnych przyczyn prawnych, organizacyjnych lub technicznych.
          </li>
          <li>
            Zmiany Regulaminu nie wpływają na prawa Kupujących wynikające z umów
            zawartych przed ich wejściem w życie.
          </li>
          <li>
            <p>
              W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają
              przepisy prawa polskiego, w szczególności:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Kodeks cywilny,</li>
              <li>ustawa o prawach konsumenta,</li>
              <li>ustawa o świadczeniu usług drogą elektroniczną,</li>
              <li>
                Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679
                (RODO).
              </li>
            </ul>
          </li>
          <li>Regulamin obowiązuje od dnia jego opublikowania w Serwisie.</li>
          <li>
            <p>Aktualna wersja Regulaminu jest dostępna nieprzerwanie pod adresem:</p>
            <p className="mt-3">
              <strong>https://bilety.katarzynabellingham.pl/regulamin</strong>
            </p>
          </li>
        </ol>
      </LegalSection>
    </LegalLayout>
  );
}
