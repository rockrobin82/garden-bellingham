import "server-only";

import type { P24Client } from "@/lib/przelewy24/client";
import { P24ApiError } from "@/lib/przelewy24/types";

/**
 * Documented Przelewy24 refund lookup.
 * GET /api/v1/refund/by/orderId/{orderId}
 * Status: 1 completed, 2 pending, 3 awaiting acceptance, 4 rejected.
 * HTTP 404 means no refund is registered for that order id.
 */

export type P24RefundSnapshot = {
  requestId: string;
  status: number;
  amount: number;
};

export type P24RefundLookup =
  | { outcome: "not_found" }
  | { outcome: "unavailable" }
  | { outcome: "listed"; refunds: P24RefundSnapshot[] };

type RefundsPayload = {
  refunds?: unknown;
};

export async function getRefundsByOrderId(
  client: P24Client,
  orderId: number,
): Promise<P24RefundLookup> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return { outcome: "unavailable" };
  }

  try {
    const data = await client.get<RefundsPayload>(
      `/refund/by/orderId/${orderId}`,
    );
    const refunds = readRefunds(data);

    if (!refunds) {
      return { outcome: "unavailable" };
    }

    return { outcome: "listed", refunds };
  } catch (error) {
    if (error instanceof P24ApiError && error.statusCode === 404) {
      return { outcome: "not_found" };
    }

    console.error("[getRefundsByOrderId] Refund lookup failed.", error);
    return { outcome: "unavailable" };
  }
}

function readRefunds(data: RefundsPayload): P24RefundSnapshot[] | null {
  if (!data || typeof data !== "object" || !Array.isArray(data.refunds)) {
    return null;
  }

  return data.refunds.map((item) => readRefund(item));
}

function readRefund(item: unknown): P24RefundSnapshot {
  if (!item || typeof item !== "object") {
    return { requestId: "", status: Number.NaN, amount: Number.NaN };
  }

  const record = item as Record<string, unknown>;
  const requestId = typeof record.requestId === "string" ? record.requestId : "";
  const status =
    typeof record.status === "number" && Number.isInteger(record.status)
      ? record.status
      : Number.NaN;
  const amount =
    typeof record.amount === "number" && Number.isInteger(record.amount)
      ? record.amount
      : Number.NaN;

  return { requestId, status, amount };
}
