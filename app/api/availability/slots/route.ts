import { toAvailabilityEntrySlots } from "@/lib/availability/entry-slots";
import { readSheetRange } from "@/lib/sheets/helpers";
import {
  parseEntrySlotRows,
  publicEntrySlotAvailabilityMessage,
} from "@/lib/sheets/parse-entry-slots";
import { detectDatesSheetFormat, SHEET_TABS } from "@/lib/sheets/schema";

/**
 * Entry-slot availability from the Wejścia tab.
 * The booking page keeps calling `/api/availability`. Checkout still rejects entrySlotId.
 * A header other than the entry-slot columns returns 409.
 */

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
} as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  try {
    const rawRows = await readSheetRange(SHEET_TABS.entrySlots, "A:Z");
    const format = detectDatesSheetFormat(rawRows[0] ?? []);

    if (format !== "entry-slot") {
      return Response.json(
        {
          error: `Entry slot availability is not enabled. The ${SHEET_TABS.entrySlots} sheet header does not match the entry-slot format.`,
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
