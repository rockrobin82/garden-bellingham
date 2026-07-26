import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const LOG_PREFIX = "[finalizeRefundedOrder]";

export type FinalizeRefundedOrderInput = {
  orderId: string;
  refundId: string;
  refundAmountMinor: number;
  refundReason: string;
  refundedAt: string;
};

/**
 * Marks order as refunded and cancels all tickets.
 * Must only be called after Przelewy24 accepted the refund.
 */
export async function finalizeRefundedOrder(
  input: FinalizeRefundedOrderInput,
): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: updatedOrder, error: orderError } = await supabase
    .from("orders")
    .update({
      payment_status: "refunded",
      refunded_at: input.refundedAt,
      refund_reason: input.refundReason,
      refund_amount_minor: input.refundAmountMinor,
      refund_id: input.refundId,
    })
    .eq("id", input.orderId)
    .eq("payment_status", "paid")
    .select("id")
    .maybeSingle();

  if (orderError) {
    console.error(`${LOG_PREFIX} Supabase order update failed.`, orderError);
    throw new Error(orderError.message);
  }

  if (!updatedOrder) {
    const { data: currentOrder, error: reloadError } = await supabase
      .from("orders")
      .select("payment_status")
      .eq("id", input.orderId)
      .maybeSingle();

    if (reloadError) {
      console.error(`${LOG_PREFIX} Supabase reload failed.`, reloadError);
      throw new Error(reloadError.message);
    }

    if (currentOrder?.payment_status !== "refunded") {
      throw new Error(`Failed to mark order as refunded: ${input.orderId}`);
    }
  }

  const { error: ticketsError } = await supabase
    .from("tickets")
    .update({ status: "cancelled" })
    .eq("order_id", input.orderId);

  if (ticketsError) {
    console.error(`${LOG_PREFIX} Supabase tickets update failed.`, ticketsError);
    throw new Error(ticketsError.message);
  }
}
