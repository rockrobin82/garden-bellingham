import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";

const title = "Kontakt | Ogród Bellingham Bilety";
const description =
  "Kontakt i informacje wsparcia dla aplikacji do rezerwacji biletów Ogród Bellingham.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/kontakt",
  },
  openGraph: {
    title,
    description,
    url: "/kontakt",
    siteName: "Ogród Bellingham Bilety",
    type: "website",
  },
};

const sections = [
  "Seller Information",
  "Contact Information",
  "Business Address",
  "Email",
  "Phone Number",
  "Business Hours",
  "Location (future Google Maps integration)",
  "Frequently Asked Questions",
  "Support Information",
] as const;

export default function ContactPage() {
  return (
    <LegalLayout
      eyebrow="Obsługa klienta"
      title="Kontakt"
      description="Masz pytania dotyczące zakupu biletów lub planowanej wizyty w Ogrodzie Bellingham?"
      sections={sections}
      placeholderPrefix="TODO: Kontakt"
    >
      <LegalSection title="Kontakt">
        <p className="mt-3 text-sm leading-6 text-[#666]">
          Chętnie pomożemy. W przypadku pytań dotyczących rezerwacji, płatności,
          biletów elektronicznych, faktur lub reklamacji prosimy o kontakt drogą
          mailową.
        </p>
      </LegalSection>

      <LegalSection title="Dane sprzedawcy">
        <div className="mt-3 text-sm leading-6 text-[#666]">
          <p>
            <strong>Ogród Bellingham &quot;the Garden&quot; Katarzyna Bellingham</strong>
          </p>
          <p className="mt-3">
            NIP: <strong>9570775872</strong>
          </p>
          <p className="mt-3">
            REGON: <strong>222091433</strong>
          </p>
        </div>
      </LegalSection>

      <LegalSection title="Adres Ogrodu">
        <p className="mt-3 text-sm leading-6 text-[#666]">
          ul. Zamkowa 2A
          <br />
          83-322 Zgorzałe
        </p>
      </LegalSection>

      <LegalSection title="Adres do korespondencji">
        <p className="mt-3 text-sm leading-6 text-[#666]">
          ul. Manifestu Połanieckiego 6/3
          <br />
          80-406 Gdańsk
        </p>
      </LegalSection>

      <LegalSection title="Kontakt e-mail">
        <div className="mt-3 text-sm leading-6 text-[#666]">
          <p>
            <strong>
              <a
                href="mailto:biuro@angielskieogrody.com"
                className="text-[#1f4d35] underline-offset-4 hover:underline"
              >
                biuro@angielskieogrody.com
              </a>
            </strong>
          </p>
          <p className="mt-4">
            Wiadomości można kierować na powyższy adres we wszystkich sprawach
            związanych z:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>zakupem biletów,</li>
            <li>płatnościami,</li>
            <li>fakturami VAT,</li>
            <li>reklamacjami,</li>
            <li>organizacją wizyty,</li>
            <li>funkcjonowaniem serwisu.</li>
          </ul>
        </div>
      </LegalSection>

      <LegalSection title="Czas odpowiedzi">
        <div className="mt-3 text-sm leading-6 text-[#666]">
          <p>
            Dokładamy wszelkich starań, aby odpowiadać na wiadomości możliwie
            najszybciej.
          </p>
          <p className="mt-4">
            Reklamacje oraz zgłoszenia dotyczące zakupów rozpatrywane są zgodnie z
            zasadami określonymi w Regulaminie sprzedaży biletów.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="Informacja">
        <div className="mt-3 text-sm leading-6 text-[#666]">
          <p>
            Serwis <strong>https://bilety.katarzynabellingham.pl</strong> służy
            wyłącznie do sprzedaży biletów elektronicznych umożliwiających wejście do
            Ogrodu Bellingham.
          </p>
          <p className="mt-4">
            W przypadku pytań niezwiązanych z zakupem biletów zachęcamy do
            odwiedzenia oficjalnej strony internetowej Ogrodu Bellingham.
          </p>
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
