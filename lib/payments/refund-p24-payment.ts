import "server-only";

import {
  OrderAlreadyRefundedError,
  OrderMissingPaymentDataError,
  OrderNotFoundError,
  OrderNotRefundableError,
} from "@/lib/payments/errors";
import {
  createP24Client,
  getP24Config,
  refundTransaction,
  type RefundTransactionResult,
} from "@/lib/przelewy24";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentStatus } from "@/types/database";

const LOG_PREFIX = "[refundP24Payment]";

const DEFAULT_REFUND_REASON = "Zwrot wykonany przez administratora";

type OrderForRefund = {
  id: string;
  booking_date: string;
  customer_email: string;
  ticket_qty: number;
  total_amount_minor: number;
  payment_status: PaymentStatus;
  p24_session_id: string | null;
  p24_order_id: string | null;
};

export type RefundP24PaymentResult = {
  orderId: string;
  refundId: string;
  refundAmountMinor: number;
  refundReason: string;
  refundedAt: string;
  p24: RefundTransactionResult;
};

function isRefundableStatus(status: string): boolean {
  return status === "paid" || status === "completed";
}

/**
 * Refunds a paid order via Przelewy24.
 * Does not mutate local order/ticket state — call finalize after success.
 */
export async function refundP24Payment(
  orderId: string,
  reason?: string,
): Promise<RefundP24PaymentResult> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, booking_date, customer_email, ticket_qty, total_amount_minor, payment_status, p24_session_id, p24_order_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Supabase load failed.`, error);
    throw new Error(error.message);
  }

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  const typedOrder = order as OrderForRefund;

  if (typedOrder.payment_status === "refunded") {
    throw new OrderAlreadyRefundedError(orderId);
  }

  if (!isRefundableStatus(typedOrder.payment_status)) {
    throw new OrderNotRefundableError(orderId);
  }

  if (!typedOrder.p24_order_id) {
    throw new OrderMissingPaymentDataError(orderId);
  }

  const p24OrderId = Number(typedOrder.p24_order_id);
  if (!Number.isFinite(p24OrderId)) {
    throw new OrderMissingPaymentDataError(orderId);
  }

  const sessionId = typedOrder.p24_session_id ?? typedOrder.id;
  const refundReason =
    reason?.trim() && reason.trim().length > 0
      ? reason.trim()
      : DEFAULT_REFUND_REASON;
  const requestId = `refund-${typedOrder.id}`;
  const refundsUuid = typedOrder.id;

  try {
    const config = getP24Config();
    const client = createP24Client(config);

    const p24Result = await refundTransaction(client, config, {
      requestId,
      refundsUuid,
      refunds: [
        {
          orderId: p24OrderId,
          sessionId,
          amount: typedOrder.total_amount_minor,
          description: refundReason,
        },
      ],
      currency: "PLN",
    });

    return {
      orderId: typedOrder.id,
      refundId: p24Result.refundsUuid,
      refundAmountMinor: p24Result.amount,
      refundReason,
      refundedAt: new Date().toISOString(),
      p24: p24Result,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Przelewy24 refund failed.`, error);
    throw error;
  }
}
