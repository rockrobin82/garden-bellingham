const features = [
  "Kalendarz dostepnych terminow",
  "Bilety normalne i ulgowe",
  "Platnosc online Przelewy24",
  "Bilet PDF/QR wysylany e-mailem",
];

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium text-primary">MVP w przygotowaniu</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          System rezerwacji biletow do Ogrodu Bellingham
        </h2>
        <p className="mt-3 text-muted">
          To jest strona startowa MVP. W kolejnych krokach dodamy kalendarz,
          wybor liczby biletow, podsumowanie ceny i checkout.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Zakres Section 1</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
