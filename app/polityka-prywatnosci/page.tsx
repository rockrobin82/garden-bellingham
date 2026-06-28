import { LegalLayout } from "@/components/legal/LegalLayout";

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
    />
  );
}
