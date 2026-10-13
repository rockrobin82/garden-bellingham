/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AvailabilityEntrySlot } from "@/lib/availability/entry-slots";
import { EntrySlotPreview } from "@/components/booking/EntrySlotPreview";
import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";
import { POST } from "@/app/api/orders/route";

function slot(overrides: Partial<AvailabilityEntrySlot> = {}): AvailabilityEntrySlot {
  return {
    slotId: "morning",
    date: "2026-10-17",
    timeStart: "10:00",
    timeEnd: "15:00",
    active: true,
    ticketLimit: 10,
    soldCount: 2,
    remaining: 8,
    priceNormal: 35,
    priceReduced: 25,
    note: "Wejście poranne",
    maxTicketsPerOrder: 6,
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("slot tiles in the calendar", () => {
  it("renders separate tiles for two hours on the same date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          slots: [
            slot(),
            slot({
              slotId: "evening",
              timeStart: "16:00",
              timeEnd: "20:00",
              note: "Wejście wieczorne",
              priceNormal: 40,
              priceReduced: 30,
            }),
          ],
        }),
      ),
    );

    render(<EntrySlotPreview showDeveloperPreview={false} />);

    const morning = await screen.findByRole("button", { name: /10:00–15:00/ });
    const evening = screen.getByRole("button", { name: /16:00–20:00/ });
    expect(morning).toBeTruthy();
    expect(evening).toBeTruthy();
    expect(morning).not.toBe(evening);
    expect(screen.getAllByText("2026-10-17")).toHaveLength(2);
    expect(screen.getAllByText("Pozostało: 8")).toHaveLength(2);
    expect(screen.getByText(/Normalny: .*35,00/)).toBeTruthy();
    expect(screen.getByText(/Ulgowy: .*25,00/)).toBeTruthy();
    expect(screen.getByText("Wejście poranne")).toBeTruthy();
    expect(screen.getByText("Wejście wieczorne")).toBeTruthy();
    expect(screen.getAllByText("Dostępne")).toHaveLength(2);
  });

  it("keeps TEST slots out of the customer tiles and hides their prices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          slots: [
            slot({ note: "" }),
            slot({
              slotId: "probe",
              timeStart: "18:00",
              timeEnd: "19:00",
              priceNormal: 999,
              priceReduced: 888,
              note: "TEST",
            }),
          ],
        }),
      ),
    );

    render(<EntrySlotPreview showDeveloperPreview />);

    expect(await screen.findByRole("button", { name: /10:00–15:00/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /18:00–19:00/ })).toBeNull();
    expect(screen.getByText("Podgląd developerski")).toBeTruthy();
    expect(screen.getByText("2026-10-17, 18:00–19:00")).toBeTruthy();
    expect(screen.queryByText(/999,00/)).toBeNull();
    expect(screen.queryByText(/888,00/)).toBeNull();
  });

  it("hides the developer preview of TEST slots from the customer offer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          slots: [
            slot({
              slotId: "probe",
              timeStart: "18:00",
              timeEnd: "19:00",
              note: "TEST",
            }),
          ],
        }),
      ),
    );

    render(<EntrySlotPreview showDeveloperPreview={false} />);

    expect(await screen.findByText("Brak przedziałów do wyświetlenia.")).toBeTruthy();
    expect(screen.queryByText("Podgląd developerski")).toBeNull();
    expect(screen.queryByText(/18:00–19:00/)).toBeNull();
  });

  it("shows sold-out and inactive tiles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          slots: [
            slot({
              slotId: "sold-out",
              timeStart: "12:00",
              timeEnd: "13:00",
              remaining: 0,
              note: "",
            }),
            slot({
              slotId: "closed",
              timeStart: "13:00",
              timeEnd: "14:00",
              active: false,
              remaining: 4,
              note: "",
            }),
          ],
        }),
      ),
    );

    render(<EntrySlotPreview showDeveloperPreview={false} />);

    expect(await screen.findByText("Wyprzedane")).toBeTruthy();
    expect(screen.getByText("Nieaktywne")).toBeTruthy();
    expect(screen.getByRole("button", { name: /12:00–13:00/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /13:00–14:00/ })).toHaveProperty("disabled", true);
  });

  it("shows an empty list and a read error without calling orders", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url !== "/api/availability/slots") {
        throw new Error(`unexpected ${url}`);
      }
      return jsonResponse({ slots: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<EntrySlotPreview showDeveloperPreview={false} />);
    expect(await screen.findByText("Brak przedziałów do wyświetlenia.")).toBeTruthy();
    unmount();

    fetchMock.mockImplementation(async () => {
      throw new Error("network down");
    });
    render(<EntrySlotPreview showDeveloperPreview={false} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(fetchMock.mock.calls.every((call) => String(call[0]) === "/api/availability/slots")).toBe(
      true,
    );
  });
});

describe("daily calendar", () => {
  it("stays on day tickets until the visitor switches to entry hours", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/availability") {
        return jsonResponse({
          dates: [
            {
              date: "2026-10-17",
              active: true,
              remaining: 12,
              priceNormal: 35,
              priceReduced: 25,
              note: "Dzień otwarty",
              soldOut: false,
              maxTicketsPerOrder: 6,
            },
          ],
        });
      }

      if (url === "/api/availability/slots") {
        return jsonResponse({
          slots: [
            slot(),
            slot({
              slotId: "evening",
              timeStart: "16:00",
              timeEnd: "20:00",
              note: "",
            }),
          ],
        });
      }

      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AvailabilityCalendar />);

    expect(await screen.findByRole("button", { name: /2026-10-17/ })).toBeTruthy();
    expect(screen.getByText("Pozostało: 12")).toBeTruthy();
    expect(screen.getByText(/Normalny: .*35,00/)).toBeTruthy();
    expect(screen.getByText("Dzień otwarty")).toBeTruthy();
    expect(screen.getByText("Dostępne")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bilety dzienne" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.queryByText(/10:00–15:00/)).toBeNull();
    expect(screen.getByRole("button", { name: /Przejdź do płatności/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Godziny wejścia" }));

    expect(await screen.findByRole("button", { name: /10:00–15:00/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /16:00–20:00/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Przejdź do płatności/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Sprzedaż wejść godzinowych jeszcze nieaktywna" }),
    ).toHaveProperty("disabled", true);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain("/api/availability");
    expect(urls).toContain("/api/availability/slots");
    expect(urls.some((url) => url.includes("/api/orders") || url.includes("payment"))).toBe(false);
  });

  it("does not render a second entry-hours block outside the calendar", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/availability") {
          return jsonResponse({
            dates: [
              {
                date: "2026-10-17",
                active: true,
                remaining: 12,
                priceNormal: 35,
                priceReduced: 25,
                soldOut: false,
                maxTicketsPerOrder: 6,
              },
            ],
          });
        }

        if (url === "/api/availability/slots") {
          return jsonResponse({
            slots: [
              slot(),
              slot({
                slotId: "evening",
                timeStart: "16:00",
                timeEnd: "20:00",
                note: "",
              }),
            ],
          });
        }

        throw new Error(`unexpected ${url}`);
      }),
    );

    render(<AvailabilityCalendar />);

    const heading = await screen.findByRole("heading", { name: "Ogród otwarty w dniach:" });
    expect(screen.getAllByRole("heading", { name: "Ogród otwarty w dniach:" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: /Godziny wejścia/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Godziny wejścia" })).toHaveLength(1);
    expect(screen.queryByText("Brak przedziałów do wyświetlenia.")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sprzedaż wejść godzinowych jeszcze nieaktywna" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Godziny wejścia" }));

    const morning = await screen.findByRole("button", { name: /10:00–15:00/ });
    const calendar = heading.closest("section");
    expect(calendar?.contains(morning)).toBe(true);
    expect(calendar?.contains(screen.getByRole("button", { name: /16:00–20:00/ }))).toBe(true);
    expect(screen.getAllByRole("heading", { name: "Ogród otwarty w dniach:" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: /Godziny wejścia/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Godziny wejścia" })).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Sprzedaż wejść godzinowych jeszcze nieaktywna" }),
    ).toHaveLength(1);
    expect(screen.queryByText("Brak przedziałów do wyświetlenia.")).toBeNull();
    expect(document.querySelectorAll("section")).toHaveLength(1);
  });
});

describe("entry slot checkout gate", () => {
  it("still rejects entrySlotId on POST /api/orders", async () => {
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingDate: "2026-10-17",
          email: "visitor@example.test",
          normalQty: 1,
          reducedQty: 0,
          invoiceRequested: false,
          entrySlotId: "morning",
          idempotencyKey: "calendar-preview-gate",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Entry slot checkout is not available",
    });
  });
});
