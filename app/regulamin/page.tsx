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
      {sections.map((section) => (
        <LegalSection key={section} title={section}>
          <p className="mt-3 text-sm leading-6 text-[#666]">
            TODO: Regulamin: {section}. Treść zostanie dodana później.
          </p>
        </LegalSection>
      ))}
    </LegalLayout>
  );
}
