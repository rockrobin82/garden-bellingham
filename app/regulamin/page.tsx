import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

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
    />
  );
}
