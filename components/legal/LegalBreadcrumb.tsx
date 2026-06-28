const bookingUrl = "https://bilety.katarzynabellingham.pl";

type LegalBreadcrumbProps = {
  currentPageTitle: string;
};

export function LegalBreadcrumb({ currentPageTitle }: LegalBreadcrumbProps) {
  return (
    <nav aria-label="Ścieżka nawigacji" className="mb-3 text-sm text-[#666]">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <a
            href={bookingUrl}
            className="text-[#1f4d35] underline-offset-4 transition hover:text-[#2a6b4a] hover:underline"
          >
            Rezerwacja biletów
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="font-medium">
          {currentPageTitle}
        </li>
      </ol>
    </nav>
  );
}
