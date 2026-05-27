import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#071b11] p-6 text-white sm:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <div className="flex items-stretch gap-4 sm:gap-6">
            <div className="flex min-h-[86px] shrink-0 items-center justify-center sm:min-h-[112px]">
              <img
                src="/logo.png"
                alt="Logo Ogród Bellingham"
                className="h-[52px] w-[52px] sm:h-[110px] sm:w-[110px]"
              />
            </div>

            <div className="flex min-h-[86px] flex-col justify-center sm:min-h-[112px]">
              <p className="mb-2 text-zinc-400">Kup wejściówkę do ogrodu</p>
              <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
                Ogród Bellingham
              </h1>
            </div>
          </div>
        </header>

        <div className="rounded-3xl border border-green-900 bg-[#0b2216] p-6 sm:p-10">
          <p className="mb-4 text-green-400">Rezerwacja online</p>
          <h2 className="mb-4 text-2xl font-semibold sm:text-4xl">
            System rezerwacji biletow do Ogrodu Bellingham
          </h2>
          <p className="text-lg leading-relaxed text-zinc-300 sm:text-xl">
            Sprawdz dostepne terminy i ceny bezposrednio z kalendarza.
          </p>
        </div>

        <AvailabilityCalendar />
      </div>
    </main>
  );
}