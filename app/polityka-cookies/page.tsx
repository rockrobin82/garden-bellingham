import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";

const title = "Polityka cookies | Ogród Bellingham Bilety";
const description =
  "Polityka cookies aplikacji do rezerwacji biletów Ogród Bellingham.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/polityka-cookies",
  },
  openGraph: {
    title,
    description,
    url: "/polityka-cookies",
    siteName: "Ogród Bellingham Bilety",
    type: "article",
  },
};

const sections = [
  "What are cookies",
  "Essential cookies",
  "Functional cookies",
  "Analytics cookies",
  "Third-party services",
  "Managing cookies",
  "Contact",
] as const;

export default function CookiePolicyPage() {
  return (
    <LegalLayout
      eyebrow="Dokumenty prawne"
      title="Polityka cookies"
      description="Struktura polityki cookies dla aplikacji biletowej. Treść prawna zostanie dodana później."
      sections={sections}
      placeholderPrefix="TODO: Polityka cookies"
    >
      <LegalSection title="§1. Postanowienia ogólne">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Niniejsza Polityka Cookies określa zasady wykorzystywania plików cookies
            oraz podobnych technologii w serwisie internetowym
            https://bilety.katarzynabellingham.pl.
          </li>
          <li>
            <p>Właścicielem Serwisu oraz administratorem danych osobowych jest:</p>
            <p className="mt-3">
              <strong>Ogród Bellingham &quot;the Garden&quot; Katarzyna Bellingham</strong>
            </p>
            <p className="mt-3">
              NIP: <strong>9570775872</strong>
            </p>
            <p className="mt-3">
              REGON: <strong>222091433</strong>
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
            Korzystanie z Serwisu oznacza akceptację zasad opisanych w niniejszej
            Polityce Cookies.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§2. Czym są pliki cookies?">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Pliki cookies to niewielkie pliki tekstowe zapisywane na urządzeniu
            użytkownika podczas korzystania ze strony internetowej.
          </li>
          <li>
            Pliki cookies umożliwiają prawidłowe funkcjonowanie Serwisu, zwiększają
            wygodę korzystania z niego oraz pomagają zapewnić bezpieczeństwo
            świadczonych usług.
          </li>
          <li>
            Cookies nie służą do identyfikacji użytkownika jako osoby fizycznej i nie
            zawierają danych umożliwiających bezpośrednią identyfikację.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§3. Jakie pliki cookies wykorzystujemy?">
        <div className="mt-3 text-sm leading-6 text-[#666]">
          <p>
            Serwis wykorzystuje wyłącznie pliki cookies niezbędne do prawidłowego
            działania strony internetowej oraz procesu zakupu biletów.
          </p>
          <p className="mt-4">Pliki cookies mogą być wykorzystywane w celu:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>utrzymania poprawnego działania Serwisu,</li>
            <li>zapewnienia bezpieczeństwa korzystania z Serwisu,</li>
            <li>prawidłowej realizacji procesu składania zamówienia,</li>
            <li>
              zapamiętywania podstawowych ustawień użytkownika podczas korzystania
              ze strony.
            </li>
          </ul>
          <p className="mt-4">
            Serwis nie wykorzystuje plików cookies do profilowania użytkowników ani
            prowadzenia działań marketingowych.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="§4. Zarządzanie plikami cookies">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Użytkownik może w dowolnym momencie zmienić ustawienia dotyczące plików
            cookies za pomocą swojej przeglądarki internetowej.
          </li>
          <li>
            <p>
              Większość przeglądarek internetowych domyślnie akceptuje zapisywanie
              plików cookies. Użytkownik może jednak zmienić ustawienia przeglądarki
              tak, aby:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>blokować wszystkie pliki cookies,</li>
              <li>akceptować tylko wybrane pliki cookies,</li>
              <li>usuwać zapisane pliki cookies.</li>
            </ul>
          </li>
          <li>
            Ograniczenie lub wyłączenie obsługi plików cookies może wpłynąć na
            prawidłowe działanie niektórych funkcji Serwisu, w szczególności procesu
            zakupu biletów.
          </li>
          <li>
            Szczegółowe informacje dotyczące zarządzania plikami cookies znajdują się
            w dokumentacji lub ustawieniach używanej przeglądarki internetowej.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="§5. Postanowienia końcowe">
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-6 text-[#666]">
          <li>
            Serwis nie wykorzystuje plików cookies do prowadzenia działań marketingowych,
            profilowania użytkowników ani analizy statystycznej z wykorzystaniem
            narzędzi zewnętrznych.
          </li>
          <li>
            Administrator zastrzega sobie prawo do aktualizacji niniejszej Polityki
            Cookies w przypadku zmian przepisów prawa lub zmian technologicznych
            wpływających na sposób funkcjonowania Serwisu.
          </li>
          <li>
            <p>Aktualna wersja Polityki Cookies jest dostępna pod adresem:</p>
            <p className="mt-3">
              <strong>https://bilety.katarzynabellingham.pl/polityka-cookies</strong>
            </p>
          </li>
          <li>
            W sprawach nieuregulowanych niniejszą Polityką Cookies zastosowanie mają
            przepisy prawa polskiego oraz odpowiednie postanowienia Polityki
            Prywatności.
          </li>
          <li>
            Niniejsza Polityka Cookies obowiązuje od dnia jej opublikowania w Serwisie.
          </li>
        </ol>
      </LegalSection>
    </LegalLayout>
  );
}
