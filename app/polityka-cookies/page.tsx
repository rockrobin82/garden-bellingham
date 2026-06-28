import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

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
    />
  );
}
