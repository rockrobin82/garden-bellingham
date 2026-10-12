import "server-only";

import { sendRefundEmail } from "@/lib/email/send-refund-email";
import { completeEntrySlotRefund } from "@/lib/payments/complete-entry-slot-refund";
import {
  OrderAlreadyRefundedError,
  OrderNotFoundError,
} from "@/lib/payments/errors";
import {
  finalizeRefundedOrder,
  type FinalizeRefundedOrderInput,
} from "@/lib/payments/finalize-refunded-order";
import {
  refundP24Payment,
  type RefundP24PaymentResult,
} from "@/lib/payments/refund-p24-payment";
import { reconcileDaySoldCount } from "@/lib/sheets/reconcile-day-sold-count";
import { decreaseSoldCountForOrder } from "@/lib/sheets/update-sold-count";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentStatus } from "@/types/database";

const LOG_PREFIX = "[processOrderRefund]";

export type ProcessOrderRefundResult = RefundP24PaymentResult;

export type RefundOrderRecord = {
  id: string;
  entry_slot_id: string | null;
  booking_date?: string | null;
  payment_status: PaymentStatus;
  refund_id: string | null;
  refund_amount_minor: number | null;
  refund_reason: string | null;
  refunded_at: string | null;
};

export type ProcessOrderRefundDependencies = {
  loadOrder?: (orderId: string) => Promise<RefundOrderRecord>;
  refundPayment?: (
    orderId: string,
    reason?: string,
  ) => Promise<RefundP24PaymentResult>;
  finalizeDayRefund?: (
    input: FinalizeRefundedOrderInput,
  ) => Promise<boolean | void>;
  decreaseSoldCount?: (orderId: string) => Promise<void>;
  syncDaySoldCount?: (bookingDate: string) => Promise<void>;
  completeSlotRefund?: typeof completeEntrySlotRefund;
  sendRefundEmail?: (orderId: string) => Promise<void>;
};

/**
 * Full refund flow: confirmed Przelewy24 result, then database, then capacity, then email.
 * Day orders reconcile the date-sheet sold_count to an absolute value after the local refund is saved.
 * A later call for an already refunded day order finishes that sync and does not subtract again.
 * Injected decreaseSoldCount keeps the older test seam and is not the production repair.
 * Entry-slot orders release the PostgreSQL hold and project sold_qty instead.
 * refundP24Payment now looks the refund up before sending another request.
 * That change covers day orders too: a lost provider response used to send a second refund.
 * The day counter itself still changes only after the order is marked refunded.
 * A repeated day refund reconciles the absolute count and does not subtract again.
 */
export async function processOrderRefund(
  orderId: string,
  reason?: string,
  dependencies: ProcessOrderRefundDependencies = {},
): Promise<ProcessOrderRefundResult> {
  const loadOrder = dependencies.loadOrder ?? loadRefundOrder;
  const refundPayment = dependencies.refundPayment ?? refundP24Payment;
  const finalizeDayRefund = dependencies.finalizeDayRefund ?? finalizeRefundedOrder;
  const decreaseSoldCount =
    dependencies.decreaseSoldCount ?? decreaseSoldCountForOrder;
  const syncSheet = async (bookingDate: string): Promise<void> => {
    await (dependencies.syncDaySoldCount ?? reconcileDaySoldCount)(bookingDate);
  };
  const completeSlotRefund =
    dependencies.completeSlotRefund ?? completeEntrySlotRefund;
  const sendEmail = dependencies.sendRefundEmail ?? sendRefundEmail;

  const order = await loadOrder(orderId);

  if (order.payment_status === "refunded") {
    if (!order.entry_slot_id) {
      if (!dependencies.decreaseSoldCount) {
        try {
          await syncDaySoldCount(order.booking_date, syncSheet);
        } catch (error) {
          console.error(
            `${LOG_PREFIX} Google Sheets sold_count sync failed.`,
            error instanceof Error ? error.message : "unknown",
          );
        }
      }

      throw new OrderAlreadyRefundedError(orderId);
    }

    await completeSlotRefund({
      orderId,
      refundId: order.refund_id ?? "",
      refundAmountMinor: order.refund_amount_minor ?? 0,
      refundReason: order.refund_reason ?? "",
      refundedAt: order.refunded_at ?? new Date().toISOString(),
    });
    await sendRefundEmailBestEffort(sendEmail, orderId);
    return storedRefundResult(order);
  }

  const refundResult = await refundPayment(orderId, reason);

  if (order.entry_slot_id) {
    await completeSlotRefund({
      orderId: refundResult.orderId,
      refundId: refundResult.refundId,
      refundAmountMinor: refundResult.refundAmountMinor,
      refundReason: refundResult.refundReason,
      refundedAt: refundResult.refundedAt,
    });
  } else {
    let markedRefund = true;

    try {
      markedRefund = (await finalizeDayRefund({
        orderId: refundResult.orderId,
        refundId: refundResult.refundId,
        refundAmountMinor: refundResult.refundAmountMinor,
        refundReason: refundResult.refundReason,
        refundedAt: refundResult.refundedAt,
      })) !== false;
    } catch (error) {
      console.error(`${LOG_PREFIX} Database finalize failed.`, error);
      throw error;
    }

    if (markedRefund) {
      try {
        if (dependencies.decreaseSoldCount) {
          await decreaseSoldCount(orderId);
        } else {
          await syncDaySoldCount(order.booking_date, syncSheet);
        }
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Google Sheets sold_count sync failed.`,
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
  }

  await sendRefundEmailBestEffort(sendEmail, orderId);
  return refundResult;
}

async function loadRefundOrder(orderId: string): Promise<RefundOrderRecord> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, entry_slot_id, booking_date, payment_status, refund_id, refund_amount_minor, refund_reason, refunded_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Order read failed.`, error);
    throw new Error("Refund could not be started");
  }

  if (!data) {
    throw new OrderNotFoundError(orderId);
  }

  return data;
}

function storedRefundResult(order: RefundOrderRecord): ProcessOrderRefundResult {
  const refundId = order.refund_id ?? "";
  const amount = order.refund_amount_minor ?? 0;

  return {
    orderId: order.id,
    refundId,
    refundAmountMinor: amount,
    refundReason: order.refund_reason ?? "",
    refundedAt: order.refunded_at ?? new Date().toISOString(),
    p24: {
      requestId: `refund-${order.id}`,
      refundsUuid: refundId,
      amount,
      currency: "PLN",
      items: [],
    },
  };
}

async function syncDaySoldCount(
  bookingDate: string | null | undefined,
  sync: (bookingDate: string) => Promise<void>,
): Promise<void> {
  if (!bookingDate) {
    console.error(
      `${LOG_PREFIX} Day sheet sync skipped because the booking date is missing.`,
    );
    return;
  }

  await sync(bookingDate);
}

async function sendRefundEmailBestEffort(
  sendEmail: (orderId: string) => Promise<void>,
  orderId: string,
): Promise<void> {
  try {
    await sendEmail(orderId);
  } catch (error) {
    console.error(`${LOG_PREFIX} Refund email failed.`, error);
  }
}
