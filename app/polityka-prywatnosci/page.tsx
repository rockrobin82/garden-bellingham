import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";

const title = "Polityka prywatności | Ogród Bellingham Bilety";
const description =
  "Polityka prywatności aplikacji do rezerwacji biletów Ogród Bellingham.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/polityka-prywatnosci",
  },
  openGraph: {
    title,
    description,
    url: "/polityka-prywatnosci",
    siteName: "Ogród Bellingham Bilety",
    type: "article",
  },
};

const sections = [
  "Data Controller",
  "GDPR Information",
  "Personal Data",
  "Purpose of Processing",
  "Legal Basis",
  "Data Retention",
  "User Rights",
  "Google Sheets",
  "Przelewy24",
  "Cookies",
  "Contact",
] as const;

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      eyebrow="Dokumenty prawne"
      title="Polityka prywatności"
      description="Struktura polityki prywatności dla aplikacji biletowej. Treść prawna zostanie dodana później."
      sections={sections}
      placeholderPrefix="TODO: Polityka prywatności"
    >
      <LegalSection title="§1. Postanowienia ogólne">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Niniejsza Polityka Prywatności określa zasady przetwarzania danych
            osobowych osób korzystających z serwisu internetowego
            https://bilety.katarzynabellingham.pl.
          </li>
          <li>
            Dokument został przygotowany zgodnie z Rozporządzeniem Parlamentu
            Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO)
            oraz obowiązującymi przepisami prawa polskiego.
          </li>
          <li>
            Korzystanie z Serwisu oznacza akceptację zasad opisanych w niniejszej
            Polityce Prywatności.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§2. Administrator danych">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            <p>Administratorem danych osobowych jest:</p>
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
            Administrator odpowiada za zgodne z prawem przetwarzanie danych osobowych
            oraz ich odpowiednie zabezpieczenie.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§3. Zakres zbieranych danych">
        <div className="mt-3 text-sm leading-6 text-[#666]">
          <p>Administrator może przetwarzać następujące dane osobowe:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>imię i nazwisko,</li>
            <li>adres e-mail,</li>
            <li>
              dane niezbędne do wystawienia faktury VAT (jeżeli Kupujący zażąda
              jej wystawienia),
            </li>
            <li>informacje dotyczące zakupionych biletów,</li>
            <li>
              informacje o dokonanej płatności przekazywane przez operatora płatności.
            </li>
          </ul>
          <p className="mt-4">
            Administrator nie przetwarza szczególnych kategorii danych osobowych ani
            danych wykraczających poza zakres niezbędny do realizacji sprzedaży biletów.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="§4. Cele i podstawy przetwarzania danych osobowych">
        <div className="mt-3 text-sm leading-6 text-[#666]">
          <p>
            Administrator przetwarza dane osobowe wyłącznie w zakresie niezbędnym
            do realizacji swoich obowiązków oraz świadczenia usług związanych ze
            sprzedażą biletów.
          </p>
          <p className="mt-4">Dane osobowe przetwarzane są w następujących celach:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>realizacja zamówienia i zawarcie umowy sprzedaży biletów,</li>
            <li>obsługa płatności elektronicznych,</li>
            <li>dostarczenie biletu elektronicznego,</li>
            <li>wystawienie faktury VAT (jeżeli została zamówiona),</li>
            <li>rozpatrywanie reklamacji,</li>
            <li>kontakt z Kupującym w sprawach dotyczących zamówienia,</li>
            <li>realizacja obowiązków wynikających z przepisów prawa.</li>
          </ul>
          <p className="mt-4">
            Podstawą prawną przetwarzania danych jest w szczególności:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>art. 6 ust. 1 lit. b RODO – wykonanie umowy,</li>
            <li>art. 6 ust. 1 lit. c RODO – obowiązek prawny,</li>
            <li>
              art. 6 ust. 1 lit. f RODO – prawnie uzasadniony interes Administratora,
              polegający na zapewnieniu bezpieczeństwa oraz dochodzeniu lub obronie
              ewentualnych roszczeń.
            </li>
          </ul>
        </div>
      </LegalSection>

      <LegalSection title="§5. Odbiorcy danych osobowych">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Dane osobowe mogą być przekazywane wyłącznie podmiotom, które uczestniczą
            w realizacji zamówienia lub świadczą usługi na rzecz Administratora.
          </li>
          <li>
            <p>Odbiorcami danych mogą być w szczególności:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                operator płatności <strong>Przelewy24</strong>,
              </li>
              <li>dostawca hostingu oraz infrastruktury serwera,</li>
              <li>
                dostawcy usług poczty elektronicznej wykorzystywanych do wysyłki
                biletów i korespondencji,
              </li>
              <li>
                biuro rachunkowe lub podmioty świadczące usługi księgowe – wyłącznie
                w zakresie wymaganym przepisami prawa.
              </li>
            </ul>
          </li>
          <li>
            Administrator nie sprzedaje danych osobowych oraz nie udostępnia ich
            podmiotom trzecim w celach marketingowych.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§6. Okres przechowywania danych">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Dane osobowe przechowywane są wyłącznie przez okres niezbędny do
            realizacji celu, dla którego zostały zebrane.
          </li>
          <li>
            Dane związane z realizacją zamówienia oraz dokumentacją księgową
            przechowywane są przez okres wymagany obowiązującymi przepisami prawa
            podatkowego i rachunkowego.
          </li>
          <li>
            Dane przetwarzane w związku z reklamacjami przechowywane są do czasu
            zakończenia postępowania reklamacyjnego oraz przez okres niezbędny do
            dochodzenia lub obrony ewentualnych roszczeń.
          </li>
          <li>
            Po upływie wymaganych okresów dane są usuwane lub poddawane anonimizacji,
            zgodnie z obowiązującymi przepisami prawa.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§7. Prawa osób, których dane dotyczą">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Każdej osobie, której dane osobowe są przetwarzane przez Administratora,
            przysługują prawa wynikające z RODO.
          </li>
          <li>
            <p>Osoba, której dane dotyczą, ma prawo do:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>dostępu do swoich danych osobowych,</li>
              <li>sprostowania danych,</li>
              <li>
                usunięcia danych („prawo do bycia zapomnianym”) – w przypadkach
                przewidzianych przepisami prawa,
              </li>
              <li>ograniczenia przetwarzania danych,</li>
              <li>przenoszenia danych,</li>
              <li>
                wniesienia sprzeciwu wobec przetwarzania danych, jeżeli podstawą
                przetwarzania jest prawnie uzasadniony interes Administratora,
              </li>
              <li>wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.</li>
            </ul>
          </li>
          <li>
            <p>
              W celu realizacji swoich praw należy skontaktować się z Administratorem
              za pośrednictwem adresu e-mail:
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
            Administrator udzieli odpowiedzi na żądanie bez zbędnej zwłoki, nie
            później niż w terminie jednego miesiąca od dnia jego otrzymania, chyba że
            przepisy prawa stanowią inaczej.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§8. Pliki cookies">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Serwis wykorzystuje pliki cookies wyłącznie w zakresie niezbędnym do
            prawidłowego funkcjonowania strony internetowej oraz procesu zakupu biletów.
          </li>
          <li>
            <p>Pliki cookies mogą być wykorzystywane między innymi do:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>utrzymania poprawnego działania Serwisu,</li>
              <li>zapewnienia bezpieczeństwa korzystania z Serwisu,</li>
              <li>
                zapamiętywania podstawowych ustawień użytkownika podczas korzystania
                ze strony.
              </li>
            </ul>
          </li>
          <li>
            Administrator nie wykorzystuje plików cookies do profilowania użytkowników
            ani prowadzenia działań marketingowych.
          </li>
          <li>
            Serwis nie korzysta z Google Analytics, Meta Pixel ani innych narzędzi
            analitycznych lub reklamowych służących do śledzenia aktywności użytkowników.
          </li>
          <li>
            Użytkownik może w każdym czasie zmienić ustawienia dotyczące plików
            cookies w swojej przeglądarce internetowej, jednak ograniczenie stosowania
            cookies może wpłynąć na poprawne działanie niektórych funkcji Serwisu.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§9. Postanowienia końcowe">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Administrator zastrzega sobie prawo do wprowadzania zmian w niniejszej
            Polityce Prywatności w przypadku zmian przepisów prawa, zmian
            technologicznych lub zmian w sposobie funkcjonowania Serwisu.
          </li>
          <li>
            <p>
              Aktualna wersja Polityki Prywatności jest zawsze dostępna w Serwisie
              pod adresem:
            </p>
            <p className="mt-3">
              <strong>
                https://bilety.katarzynabellingham.pl/polityka-prywatnosci
              </strong>
            </p>
          </li>
          <li>
            W sprawach nieuregulowanych niniejszą Polityką Prywatności zastosowanie
            mają przepisy RODO oraz obowiązujące przepisy prawa polskiego.
          </li>
          <li>
            Niniejsza Polityka Prywatności obowiązuje od dnia jej opublikowania w
            Serwisie.
          </li>
        </ol>
      </LegalSection>
    </LegalLayout>
  );
}
