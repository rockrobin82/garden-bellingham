import { timingSafeEqual } from "crypto";

import { runExpireEntrySlotHolds } from "@/lib/reservations/expire-entry-slot-holds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOG_PREFIX = "[POST /api/internal/entry-slots/expire]";

function secretsMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Trusted server hook for expire_entry_slot_holds.
 * Call about once a minute with Authorization: Bearer $ENTRY_SLOT_EXPIRE_SECRET.
 * No scheduler is configured in this repository.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.ENTRY_SLOT_EXPIRE_SECRET;

  if (!secret) {
    console.error(`${LOG_PREFIX} ENTRY_SLOT_EXPIRE_SECRET is not configured.`);
    return Response.json(
      { error: "Entry slot expiry is not configured" },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (!token || !secretsMatch(secret, token)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expiredCount = await runExpireEntrySlotHolds();
    return Response.json({ expiredCount });
  } catch (error) {
    console.error(`${LOG_PREFIX} Expiry run failed.`, error);
    return Response.json({ error: "Entry slot expiry failed" }, { status: 500 });
  }
}
