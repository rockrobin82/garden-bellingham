"use client";

import { useEffect, useMemo, useState } from "react";

import type { AvailabilityEntrySlot } from "@/lib/availability/entry-slots";
import {
  canSelectEntrySlot,
  isTestEntrySlot,
  offerEntrySlots,
} from "@/lib/booking/entry-slot-preview";

type LoadState = "loading" | "ready" | "error";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatClock(value: string): string {
  return value.slice(0, 5);
}

function isSoldOut(slot: AvailabilityEntrySlot): boolean {
  return slot.remaining <= 0;
}

export function EntrySlotPreview({
  showDeveloperPreview = process.env.NODE_ENV !== "production",
}: {
  showDeveloperPreview?: boolean;
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [slots, setSlots] = useState<AvailabilityEntrySlot[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSlots() {
      try {
        setState("loading");
        setErrorMessage("");
        const response = await fetch("/api/availability/slots", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          slots?: AvailabilityEntrySlot[];
          error?: string;
        };

        if (!response.ok || !Array.isArray(body.slots)) {
          throw new Error(body.error || "Nie udało się pobrać godzin wejścia.");
        }

        setSlots(body.slots);
        setState("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Entry slot preview fetch error", error);
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : "Nie udało się pobrać godzin wejścia.",
        );
        setState("error");
      }
    }

    void loadSlots();

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const offerSlots = useMemo(() => offerEntrySlots(slots), [slots]);
  const testSlots = useMemo(() => slots.filter((slot) => isTestEntrySlot(slot)), [slots]);

  if (state === "loading") {
    return <p className="text-sm text-[#666]">Ładowanie godzin wejścia...</p>;
  }

  if (state === "error") {
    return (
      <div role="alert">
        <p className="text-sm text-red-600">
          Nie udało się pobrać godzin wejścia. Spróbuj ponownie za chwilę.
        </p>
        {errorMessage ? <p className="mt-2 text-sm text-[#666]">{errorMessage}</p> : null}
        <button
          type="button"
          className="mt-4 rounded-xl border border-[#d7e8dc] px-4 py-2 text-sm font-medium text-[#1f4d35]"
          onClick={() => setReloadKey((value) => value + 1)}
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return (
    <div>
      {offerSlots.length === 0 ? (
        <p className="text-sm text-[#666]">Brak przedziałów do wyświetlenia.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {offerSlots.map((slot) => {
            const soldOut = isSoldOut(slot);
            const selectable = canSelectEntrySlot(slot);
            const selected = selectedSlotId === slot.slotId;
            const status = selected
              ? "Wybrano"
              : soldOut
                ? "Wyprzedane"
                : slot.active
                  ? "Dostępne"
                  : "Nieaktywne";

            return (
              <button
                type="button"
                key={slot.slotId}
                disabled={!selectable}
                aria-pressed={selected}
                onClick={() => {
                  if (!selectable) {
                    return;
                  }
                  setSelectedSlotId(slot.slotId);
                }}
                className={[
                  "rounded-2xl border p-5 text-left transition duration-200",
                  soldOut
                    ? "border-red-200 opacity-80"
                    : slot.active
                      ? "border-[#d7e8dc] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                      : "border-[#d7e8dc] opacity-70",
                  selected ? "border-[#1f4d35] bg-[#f6faf7]" : "bg-white",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#1f4d35]">{slot.date}</p>
                    <p className="mt-1 text-sm font-medium text-[#1f4d35]">
                      {formatClock(slot.timeStart)}–{formatClock(slot.timeEnd)}
                    </p>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      selected
                        ? "bg-[#1f4d35] text-white"
                        : soldOut
                          ? "bg-red-50 text-red-700"
                          : slot.active
                            ? "bg-[#e8f3ec] text-[#1f4d35]"
                            : "bg-gray-100 text-[#666]",
                    ].join(" ")}
                  >
                    {status}
                  </span>
                </div>

                <p className="mt-3 text-sm text-[#666]">Pozostało: {slot.remaining}</p>
                <p className="text-sm text-[#666]">Normalny: {formatPrice(slot.priceNormal)}</p>
                <p className="text-sm text-[#666]">Ulgowy: {formatPrice(slot.priceReduced)}</p>

                {slot.note ? (
                  <p className="mt-3 rounded-xl border border-[#d7e8dc] bg-[#f6faf7] px-3 py-2 text-sm text-[#1f4d35]">
                    {slot.note}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        disabled
        className="garden-btn mt-6 w-full cursor-not-allowed px-5 py-3 text-sm font-medium opacity-50 sm:w-auto"
      >
        Sprzedaż wejść godzinowych jeszcze nieaktywna
      </button>

      {showDeveloperPreview && testSlots.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#d7e8dc] p-4">
          <h4 className="text-sm font-semibold text-[#1f4d35]">Podgląd developerski</h4>
          <p className="mt-2 text-sm text-[#666]">
            Wpisy TEST nie są ofertą dla klientów. Ceny tych wpisów są ukryte.
          </p>
          <ul className="mt-3 space-y-2">
            {testSlots.map((slot) => (
              <li key={slot.slotId} className="text-sm text-[#666]">
                {slot.date}, {formatClock(slot.timeStart)}–{formatClock(slot.timeEnd)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
