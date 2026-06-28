import { LegalHeader } from "@/components/legal/LegalHeader";
import { LegalSection } from "@/components/legal/LegalSection";

const bookingUrl = "https://bilety.katarzynabellingham.pl";

type LegalLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: readonly string[];
  placeholderPrefix: string;
};

export function LegalLayout({
  eyebrow,
  title,
  description,
  sections,
  placeholderPrefix,
}: LegalLayoutProps) {
  return (
    <main className="bg-white px-6 py-10 text-[#1f4d35] sm:px-10 sm:py-14">
      <div className="mx-auto max-w-5xl space-y-8">
        <LegalHeader eyebrow={eyebrow} title={title} description={description} />

        <div className="garden-section space-y-4 p-5 sm:p-8">
          {sections.map((section) => (
            <LegalSection
              key={section}
              title={section}
              placeholder={`${placeholderPrefix}: ${section}. Treść zostanie dodana później.`}
            />
          ))}
        </div>

        <div className="flex justify-center">
          <a href={bookingUrl} className="garden-btn px-5 py-3 text-sm font-medium">
            ← Wróć do rezerwacji biletów
          </a>
        </div>
      </div>
    </main>
  );
}
