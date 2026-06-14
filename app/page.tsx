import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-10 text-[#1f4d35] sm:px-10 sm:py-14">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="py-4 sm:py-8">
          <div className="flex items-center gap-5 sm:gap-8">
            <div className="flex shrink-0 items-center justify-center">
              <img
                src="/logo.png"
                alt="Logo Ogród Bellingham"
                className="h-[52px] w-[52px] sm:h-[110px] sm:w-[110px]"
              />
            </div>

            <div className="flex flex-col justify-center">
              <p className="mb-2 text-sm text-[#666] sm:text-base">
                Kup wejściówkę do ogrodu
              </p>
              <h1 className="text-4xl font-bold leading-tight text-[#1f4d35] sm:text-6xl">
                Ogród Bellingham
              </h1>
            </div>
          </div>
        </header>

        <div className="garden-section p-6 sm:p-10">
          <p className="mb-3 text-sm font-medium text-[#1f4d35]">Rezerwacja online</p>
          <h2 className="mb-4 text-2xl font-semibold text-[#1f4d35] sm:text-4xl">
            System rezerwacji biletów do Ogrodu Bellingham
          </h2>
          <p className="text-base leading-relaxed text-[#666] sm:text-xl">
            Sprawdź dostępne terminy i ceny bezpośrednio z kalendarza.
          </p>
        </div>

        <AvailabilityCalendar />
      </div>
    </main>
  );
}
