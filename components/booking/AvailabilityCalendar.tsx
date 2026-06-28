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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

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

  const canProceedToPayment = acceptedTerms && acceptedPrivacy;

  function handlePaymentAttempt() {
    if (canProceedToPayment) {
      setValidationMessage("");
      return;
    }

    setValidationMessage(
      "Przed przejściem do płatności zaakceptuj regulamin oraz politykę prywatności.",
    );
  }

  if (state === "loading") {
    return (
      <section className="garden-section p-6 sm:p-8">
        <h3 className="text-xl font-semibold text-[#1f4d35]">Dostępne terminy</h3>
        <p className="mt-2 text-sm text-[#666]">Ładowanie danych z kalendarza...</p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="garden-section p-6 sm:p-8">
        <h3 className="text-xl font-semibold text-[#1f4d35]">Dostępne terminy</h3>
        <p className="mt-2 text-sm text-red-600">
          Nie udało się pobrać dostępności. Spróbuj ponownie za chwilę.
        </p>
      </section>
    );
  }

  return (
    <section className="garden-section p-6 sm:p-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-semibold text-[#1f4d35]">Ogród otwarty w dniach:</h3>
        <span className="text-xs text-[#666] sm:text-sm">
          Ilość dostępnych biletów jest aktualizowana na bieżąco.
        </span>
      </div>

      {dates.length === 0 ? (
        <p className="text-sm text-[#666]">Brak terminów do wyświetlenia.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {dates.map((item, index) => (
            <article
              key={`${item.date}-${index}`}
              className={[
                "rounded-2xl border bg-white p-5 transition duration-200",
                item.soldOut
                  ? "border-red-200 opacity-80"
                  : item.active
                    ? "border-[#d7e8dc] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                    : "border-[#d7e8dc] opacity-70",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-[#1f4d35]">{item.date}</p>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    item.soldOut
                      ? "bg-red-50 text-red-700"
                      : item.active
                        ? "bg-[#e8f3ec] text-[#1f4d35]"
                        : "bg-gray-100 text-[#666]",
                  ].join(" ")}
                >
                  {item.soldOut ? "Wyprzedane" : item.active ? "Dostępne" : "Nieaktywne"}
                </span>
              </div>

              <p className="mt-3 text-sm text-[#666]">Pozostało: {item.remaining}</p>
              <p className="text-sm text-[#666]">
                Normalny: {formatPrice(item.priceNormal)}
              </p>
              <p className="text-sm text-[#666]">
                Ulgowy: {formatPrice(item.priceReduced)}
              </p>

              {item.note ? (
                <p className="mt-3 rounded-xl border border-[#d7e8dc] bg-[#f6faf7] px-3 py-2 text-sm text-[#1f4d35]">
                  {item.note}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-white p-5">
        <h4 className="text-lg font-semibold text-[#1f4d35]">Zgody wymagane do płatności</h4>

        <div className="mt-4 space-y-4">
          <label className="flex gap-3 text-sm leading-6 text-[#666]">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
                setValidationMessage("");
              }}
              className="mt-1 h-4 w-4 rounded border-border accent-[#1f4d35]"
              required
            />
            <span>
              Zapoznałem(-am) się z{" "}
              <a
                href="/regulamin"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#1f4d35] underline-offset-4 hover:underline"
              >
                Regulaminem
              </a>
              .
            </span>
          </label>

          <label className="flex gap-3 text-sm leading-6 text-[#666]">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(event) => {
                setAcceptedPrivacy(event.target.checked);
                setValidationMessage("");
              }}
              className="mt-1 h-4 w-4 rounded border-border accent-[#1f4d35]"
              required
            />
            <span>
              Zapoznałem(-am) się z{" "}
              <a
                href="/polityka-prywatnosci"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#1f4d35] underline-offset-4 hover:underline"
              >
                Polityką prywatności
              </a>
              .
            </span>
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-[#f6faf7] p-4">
          <p className="font-medium text-[#1f4d35]">Masz pytania?</p>
          <a
            href="/kontakt"
            className="mt-1 inline-flex text-sm font-medium text-[#1f4d35] underline-offset-4 hover:underline"
          >
            Skontaktuj się z nami →
          </a>
        </div>

        {validationMessage ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {validationMessage}
          </p>
        ) : null}

        <div className="mt-5" onClick={handlePaymentAttempt}>
          <button
            type="button"
            disabled={!canProceedToPayment}
            className="garden-btn w-full px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none sm:w-auto"
          >
            Przejdź do płatności
          </button>
        </div>
      </div>
    </section>
  );
}
