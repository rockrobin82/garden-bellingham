import { toAvailabilityEntrySlots } from "@/lib/availability/entry-slots";
import { readSheetRange } from "@/lib/sheets/helpers";
import {
  parseEntrySlotRows,
  publicEntrySlotAvailabilityMessage,
} from "@/lib/sheets/parse-entry-slots";
import { detectDatesSheetFormat, SHEET_TABS } from "@/lib/sheets/schema";

/**
 * Future entry-slot availability contract.
 * The booking page keeps calling `/api/availability` and this route is not part of checkout.
 * While the production sheet still uses the day header, the response is 409.
 */

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
} as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  try {
    const rawRows = await readSheetRange(SHEET_TABS.dates, "A:Z");
    const format = detectDatesSheetFormat(rawRows[0] ?? []);

    if (format !== "entry-slot") {
      return Response.json(
        {
          error:
            "Entry slot availability is not enabled. The dates sheet still uses the day format.",
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    return Response.json(
      { slots: toAvailabilityEntrySlots(parseEntrySlotRows(rawRows)) },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Failed to fetch entry slot availability.", error);
    const overlapMessage = publicEntrySlotAvailabilityMessage(error);

    if (overlapMessage) {
      return Response.json(
        { error: overlapMessage },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    return Response.json(
      { error: "Failed to fetch entry slot availability." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
