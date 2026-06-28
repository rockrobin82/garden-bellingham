import { LegalBreadcrumb } from "@/components/legal/LegalBreadcrumb";

const bookingUrl = "https://bilety.katarzynabellingham.pl";

type LegalHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function LegalHeader({ eyebrow, title, description }: LegalHeaderProps) {
  return (
    <header className="garden-section p-6 sm:p-10">
      <a
        href={bookingUrl}
        aria-label="Wróć do rezerwacji biletów"
        className="mb-6 inline-flex"
      >
        <img
          src="/logo.png"
          alt="Logo Ogród Bellingham"
          className="h-[52px] w-[52px] sm:h-[72px] sm:w-[72px]"
        />
      </a>
      <p className="mb-3 text-sm font-medium text-[#1f4d35]">{eyebrow}</p>
      <LegalBreadcrumb currentPageTitle={title} />
      <h1 className="text-3xl font-bold leading-tight text-[#1f4d35] sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-[#666]">
        {description}
      </p>
    </header>
  );
}
