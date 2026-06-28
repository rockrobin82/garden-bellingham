import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

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
      description="Struktura strony kontaktowej aplikacji biletowej. Dane kontaktowe zostaną dodane później."
      sections={sections}
      placeholderPrefix="TODO: Kontakt"
    />
  );
}
