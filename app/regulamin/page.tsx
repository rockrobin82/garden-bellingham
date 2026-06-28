import { LegalLayout } from "@/components/legal/LegalLayout";

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
    />
  );
}
