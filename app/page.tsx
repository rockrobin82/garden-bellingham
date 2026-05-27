import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#071b11] p-6 text-white sm:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="mb-2 text-zinc-400">Rezerwacja biletow online</p>
          <h1 className="text-4xl font-bold sm:text-6xl">Ogrod Bellingham</h1>
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