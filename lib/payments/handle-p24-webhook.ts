import "server-only";

import { timingSafeEqual } from "crypto";

import {
  InvalidNotificationSignatureError,
  OrderNotFoundError,
  OrderNotPayableError,
  PaymentAmountMismatchError,
} from "@/lib/payments/errors";
import { finalizePaidOrder } from "@/lib/payments/finalize-paid-order";
import {
  createP24Client,
  getP24Config,
  signTransactionNotification,
  verifyTransaction,
  type TransactionNotificationPayload,
} from "@/lib/przelewy24";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentStatus } from "@/types/database";

type OrderForWebhook = {
  id: string;
  payment_status: PaymentStatus;
  total_amount_minor: number;
  p24_order_id: string | null;
};

const ORDER_SELECT =
  "id, payment_status, total_amount_minor, p24_order_id" as const;

function secureCompare(expected: string, received: string): boolean {
  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function validateNotificationSignature(
  notification: TransactionNotificationPayload,
  crcKey: string,
): void {
  const expectedSign = signTransactionNotification({
    merchantId: notification.merchantId,
    posId: notification.posId,
    sessionId: notification.sessionId,
    amount: notification.amount,
    originAmount: notification.originAmount,
    currency: notification.currency,
    orderId: notification.orderId,
    methodId: notification.methodId,
    statement: notification.statement,
    crc: crcKey,
  });

  if (!secureCompare(expectedSign, notification.sign)) {
    throw new InvalidNotificationSignatureError();
  }
}

async function loadOrderForNotification(
  notification: TransactionNotificationPayload,
): Promise<OrderForWebhook | null> {
  const supabase = getSupabaseAdminClient();

  const byId = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", notification.sessionId)
    .maybeSingle();

  if (byId.error) {
    throw new Error(byId.error.message);
  }

  if (byId.data) {
    return byId.data;
  }

  const bySessionId = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("p24_session_id", notification.sessionId)
    .maybeSingle();

  if (bySessionId.error) {
    throw new Error(bySessionId.error.message);
  }

  if (bySessionId.data) {
    return bySessionId.data;
  }

  const byP24OrderId = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("p24_order_id", String(notification.orderId))
    .maybeSingle();

  if (byP24OrderId.error) {
    throw new Error(byP24OrderId.error.message);
  }

  return byP24OrderId.data;
}

/**
 * Handles a Przelewy24 payment notification (urlStatus webhook).
 * Idempotent: repeated deliveries for an already paid order succeed without changes.
 */
export async function handleP24WebhookNotification(
  notification: TransactionNotificationPayload,
): Promise<void> {
  const config = getP24Config();
  validateNotificationSignature(notification, config.crcKey);

  const order = await loadOrderForNotification(notification);

  if (!order) {
    throw new OrderNotFoundError(notification.sessionId);
  }

  if (order.payment_status === "paid") {
    await finalizePaidOrder(order.id);
    return;
  }

  if (order.payment_status !== "pending") {
    throw new OrderNotPayableError(order.id);
  }

  if (order.total_amount_minor !== notification.amount) {
    throw new PaymentAmountMismatchError();
  }

  const client = createP24Client(config);
  await verifyTransaction(client, config, {
    sessionId: notification.sessionId,
    orderId: notification.orderId,
    amount: notification.amount,
    currency: notification.currency,
  });

  const supabase = getSupabaseAdminClient();
  const paidAt = new Date().toISOString();
  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      paid_at: paidAt,
      p24_order_id: String(notification.orderId),
      p24_session_id: notification.sessionId,
    })
    .eq("id", order.id)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updatedOrder) {
    const { data: currentOrder, error: reloadError } = await supabase
      .from("orders")
      .select("payment_status")
      .eq("id", order.id)
      .maybeSingle();

    if (reloadError) {
      throw new Error(reloadError.message);
    }

    if (currentOrder?.payment_status === "paid") {
      await finalizePaidOrder(order.id);
      return;
    }

    throw new Error("Failed to mark order as paid");
  }

  await finalizePaidOrder(order.id);
}
