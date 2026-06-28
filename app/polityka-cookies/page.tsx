import { LegalLayout } from "@/components/legal/LegalLayout";

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
    />
  );
}
