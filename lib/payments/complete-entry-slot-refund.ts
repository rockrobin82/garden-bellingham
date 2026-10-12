import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { mapEntrySlotRpcError } from "@/lib/orders/map-entry-slot-rpc-error";
import { OrderRequestError } from "@/lib/orders/errors";
import { projectEntrySlotSoldCount } from "@/lib/sheets/project-entry-slot-sold-count";
import type { EntrySlotSheetDependencies } from "@/lib/sheets/project-entry-slot-sold-count";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, PaymentStatus } from "@/types/database";

const LOG_PREFIX = "[completeEntrySlotRefund]";

type AdminClient = SupabaseClient<Database>;

export type CompleteEntrySlotRefundInput = {
  orderId: string;
  refundId: string;
  refundAmountMinor: number;
  refundReason: string;
  refundedAt: string;
};

export type CompleteEntrySlotRefundDependencies = EntrySlotSheetDependencies & {
  supabase?: AdminClient;
  releaseHold?: (order: RefundOrder) => Promise<void>;
};

type RefundOrder = {
  id: string;
  payment_status: PaymentStatus;
  ticket_qty: number;
  entry_slot_id: string | null;
};

/**
 * Records a refund that Przelewy24 has already accepted, then releases the slot.
 * Seats stay confirmed until the order status is refunded.
 * A repeated call does not release the same seats twice.
 */
export async function completeEntrySlotRefund(
  input: CompleteEntrySlotRefundInput,
  dependencies: CompleteEntrySlotRefundDependencies = {},
): Promise<void> {
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();
  const order = await loadOrder(supabase, input.orderId);

  if (!order.entry_slot_id) {
    throw new Error("Order has no entry slot");
  }

  if (order.payment_status !== "refunded") {
    await markRefunded(supabase, order, input);
  }

  await cancelTickets(supabase, order.id);

  if (dependencies.releaseHold) {
    await dependencies.releaseHold(order);
  } else {
    await releaseHold(supabase, order);
  }

  await projectEntrySlotSoldCount(order.id, dependencies);
}

async function loadOrder(
  supabase: AdminClient,
  orderId: string,
): Promise<RefundOrder> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, payment_status, ticket_qty, entry_slot_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Order read failed.`, error);
    throw new Error("Entry slot refund could not be recorded");
  }

  if (!data) {
    throw new Error("Entry slot refund could not be recorded");
  }

  return data;
}

async function markRefunded(
  supabase: AdminClient,
  order: RefundOrder,
  input: CompleteEntrySlotRefundInput,
): Promise<void> {
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: "refunded",
      refunded_at: input.refundedAt,
      refund_reason: input.refundReason,
      refund_amount_minor: input.refundAmountMinor,
      refund_id: input.refundId,
    })
    .eq("id", order.id)
    .in("payment_status", ["paid", "review"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Refund update failed.`, error);
    throw new Error("Entry slot refund could not be recorded");
  }

  if (data) {
    return;
  }

  const current = await loadOrder(supabase, order.id);

  if (current.payment_status !== "refunded") {
    throw new Error("Entry slot refund could not be recorded");
  }
}

async function cancelTickets(
  supabase: AdminClient,
  orderId: string,
): Promise<void> {
  const { error } = await supabase
    .from("tickets")
    .update({ status: "cancelled" })
    .eq("order_id", orderId);

  if (error) {
    console.error(`${LOG_PREFIX} Ticket cancel failed.`, error);
    throw new Error("Entry slot refund could not be recorded");
  }
}

async function releaseHold(
  supabase: AdminClient,
  order: RefundOrder,
): Promise<void> {
  if (!order.entry_slot_id) {
    throw new Error("Order has no entry slot");
  }

  const { error } = await supabase.rpc("release_entry_slot_hold", {
    p_order_id: order.id,
    p_slot_id: order.entry_slot_id,
    p_qty: order.ticket_qty,
  });

  if (error) {
    console.error(`${LOG_PREFIX} release_entry_slot_hold failed.`, error);
    const mapped = mapEntrySlotRpcError(error);

    if (mapped instanceof OrderRequestError) {
      throw mapped;
    }

    throw new Error("Entry slot refund could not be recorded");
  }
}
