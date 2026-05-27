"use client";

import { useEffect, useState } from "react";

type AvailabilityDate = {
  date: string;
  active: boolean;
  remaining: number;
  priceNormal: number;
  priceReduced: number;
  note?: string;
  soldOut: boolean;
  maxTicketsPerOrder: number;
};

type AvailabilityResponse = {
  dates: AvailabilityDate[];
};

type LoadState = "loading" | "ready" | "error";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(value);
}

export function AvailabilityCalendar() {
  const [state, setState] = useState<LoadState>("loading");
  const [dates, setDates] = useState<AvailabilityDate[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadAvailability() {
      try {
        setState("loading");
        const response = await fetch("/api/availability", { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Failed with HTTP ${response.status}`);
        }

        const data = (await response.json()) as AvailabilityResponse;
        if (!mounted) {
          return;
        }

        setDates(data.dates);
        setState("ready");
      } catch (error) {
        console.error("Availability fetch error", error);
        if (mounted) {
          setState("error");
        }
      }
    }

    void loadAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-foreground">Dostepne terminy</h3>
        <p className="mt-2 text-sm text-muted">Ladowanie danych z kalendarza...</p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-foreground">Dostepne terminy</h3>
        <p className="mt-2 text-sm text-red-700">
          Nie udalo sie pobrac dostepnosci. Sprobuj ponownie za chwile.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Dostepne terminy</h3>
        <span className="text-xs font-medium text-primary">LIVE</span>
      </div>

      {dates.length === 0 ? (
        <p className="text-sm text-muted">Brak terminow do wyswietlenia.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dates.map((item) => (
            <article
              key={item.date}
              className={[
                "rounded-xl border p-4 transition",
                item.soldOut
                  ? "border-red-200 bg-red-50/60"
                  : item.active
                    ? "border-border bg-background hover:border-primary/40 hover:shadow-sm"
                    : "border-border bg-zinc-100/70",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-foreground">{item.date}</p>
                <span
                  className={[
                    "rounded-full px-2 py-1 text-xs font-medium",
                    item.soldOut
                      ? "bg-red-100 text-red-700"
                      : item.active
                        ? "bg-green-100 text-green-700"
                        : "bg-zinc-200 text-zinc-700",
                  ].join(" ")}
                >
                  {item.soldOut ? "Wyprzedane" : item.active ? "Dostepne" : "Nieaktywne"}
                </span>
              </div>

              <p className="mt-2 text-sm text-muted">Pozostalo: {item.remaining}</p>
              <p className="text-sm text-muted">Normalny: {formatPrice(item.priceNormal)}</p>
              <p className="text-sm text-muted">Ulgowy: {formatPrice(item.priceReduced)}</p>
              <p className="text-sm text-muted">
                Limit na zamowienie: {item.maxTicketsPerOrder}
              </p>

              {item.note ? (
                <p className="mt-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                  {item.note}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
