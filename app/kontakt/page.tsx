import { LegalLayout } from "@/components/legal/LegalLayout";

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
