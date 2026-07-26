import "server-only";

import { sendRefundEmail } from "@/lib/email/send-refund-email";
import { finalizeRefundedOrder } from "@/lib/payments/finalize-refunded-order";
import {
  refundP24Payment,
  type RefundP24PaymentResult,
} from "@/lib/payments/refund-p24-payment";
import { decreaseSoldCountForOrder } from "@/lib/sheets/update-sold-count";

const LOG_PREFIX = "[processOrderRefund]";

export type ProcessOrderRefundResult = RefundP24PaymentResult;

/**
 * Full refund flow: Przelewy24 → database → Sheets (best effort) → email (best effort).
 * Tickets are never cancelled unless Przelewy24 accepted the refund.
 */
export async function processOrderRefund(
  orderId: string,
  reason?: string,
): Promise<ProcessOrderRefundResult> {
  const refundResult = await refundP24Payment(orderId, reason);

  try {
    await finalizeRefundedOrder({
      orderId: refundResult.orderId,
      refundId: refundResult.refundId,
      refundAmountMinor: refundResult.refundAmountMinor,
      refundReason: refundResult.refundReason,
      refundedAt: refundResult.refundedAt,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Database finalize failed.`, error);
    throw error;
  }

  try {
    await decreaseSoldCountForOrder(orderId);
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Google Sheets sold_count decrease failed.`,
      error,
    );
  }

  try {
    await sendRefundEmail(orderId);
  } catch (error) {
    console.error(`${LOG_PREFIX} Refund email failed.`, error);
  }

  return refundResult;
}
