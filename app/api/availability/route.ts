import { readSheetRange, parseDateRows } from "@/lib/sheets/helpers";
import { SHEET_TABS } from "@/lib/sheets/schema";

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

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  try {
    const rawRows = await readSheetRange(SHEET_TABS.dates, "A:Z");
    const dateRows = parseDateRows(rawRows);

    const dates: AvailabilityDate[] = dateRows.map((row) => {
      const remaining = Math.max(0, row.ticket_limit - row.sold_count);
      const soldOut = remaining <= 0;
      const note = row.note.trim();

      return {
        date: row.date,
        active: row.active && !soldOut,
        remaining,
        priceNormal: row.price_normal,
        priceReduced: row.price_reduced,
        note: note.length > 0 ? note : undefined,
        soldOut,
        maxTicketsPerOrder: row.max_tickets_per_order,
      };
    });

    const payload: AvailabilityResponse = { dates };
    return Response.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("Failed to fetch availability from Google Sheets.", error);
    return Response.json(
      { dates: [] satisfies AvailabilityResponse["dates"] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
