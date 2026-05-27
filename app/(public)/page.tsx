import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium text-primary">Rezerwacja biletow online</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          System rezerwacji biletow do Ogrodu Bellingham
        </h2>
        <p className="mt-3 text-muted">
          Sprawdz dostepne terminy i ceny bezposrednio z kalendarza Google Sheets.
        </p>
      </div>

      <AvailabilityCalendar />
    </section>
  );
}
