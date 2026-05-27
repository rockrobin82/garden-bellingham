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
      <section className="rounded-3xl border border-green-900 bg-[#0b2216] p-6 sm:p-8">
        <h3 className="text-xl font-semibold">Dostepne terminy</h3>
        <p className="mt-2 text-sm text-zinc-400">Ladowanie danych z kalendarza...</p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="rounded-3xl border border-green-900 bg-[#0b2216] p-6 sm:p-8">
        <h3 className="text-xl font-semibold">Dostepne terminy</h3>
        <p className="mt-2 text-sm text-red-400">
          Nie udalo sie pobrac dostepnosci. Sprobuj ponownie za chwile.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-green-900 bg-[#0b2216] p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Dostepne terminy</h3>
        <span className="rounded-full border border-green-800 bg-green-950 px-2 py-1 text-xs font-medium text-green-400">
          LIVE
        </span>
      </div>

      {dates.length === 0 ? (
        <p className="text-sm text-zinc-400">Brak terminow do wyswietlenia.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {dates.map((item) => (
            <article
              key={item.date}
              className={[
                "rounded-2xl border p-4 transition",
                item.soldOut
                  ? "border-red-900/60 bg-red-950/30"
                  : item.active
                    ? "border-green-900 bg-[#071b11] hover:border-green-700"
                    : "border-green-900/50 bg-[#071b11]/60 opacity-70",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-white">{item.date}</p>
                <span
                  className={[
                    "rounded-full px-2 py-1 text-xs font-medium",
                    item.soldOut
                      ? "bg-red-900/50 text-red-300"
                      : item.active
                        ? "bg-green-900/50 text-green-300"
                        : "bg-zinc-800 text-zinc-400",
                  ].join(" ")}
                >
                  {item.soldOut ? "Wyprzedane" : item.active ? "Dostepne" : "Nieaktywne"}
                </span>
              </div>

              <p className="mt-3 text-sm text-zinc-400">Pozostalo: {item.remaining}</p>
              <p className="text-sm text-zinc-400">
                Normalny: {formatPrice(item.priceNormal)}
              </p>
              <p className="text-sm text-zinc-400">
                Ulgowy: {formatPrice(item.priceReduced)}
              </p>

              {item.note ? (
                <p className="mt-3 rounded-lg border border-green-800 bg-green-950/50 px-3 py-2 text-sm text-green-300">
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
