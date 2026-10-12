import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendInvoiceNotificationEmails } from "@/lib/email/send-invoice-notification-emails";
import { sendOrderEmail } from "@/lib/email/send-order-email";
import {
  EntrySlotHoldInactiveError,
  OrderRequestError,
} from "@/lib/orders/errors";
import {
  entrySlotErrorText,
  mapEntrySlotRpcError,
} from "@/lib/orders/map-entry-slot-rpc-error";
import {
  PaymentAmountMismatchError,
  OrderNotPayableError,
} from "@/lib/payments/errors";
import { projectEntrySlotSoldCount } from "@/lib/sheets/project-entry-slot-sold-count";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertOrderTickets } from "@/lib/tickets/insert-order-tickets";
import type { Database, EntrySlotHoldRow, PaymentStatus } from "@/types/database";

const LOG_PREFIX = "[applyVerifiedEntrySlotPayment]";
const RESERVATION_CONFIRMED = "confirmed";
const RESERVATION_UNFULFILLED = "payment_unfulfilled";

type AdminClient = SupabaseClient<Database>;

type SlotOrder = {
  id: string;
  payment_status: PaymentStatus;
  total_amount_minor: number;
  ticket_qty: number;
  entry_slot_id: string | null;
  payment_metadata: Record<string, unknown> | null;
};

export type VerifiedEntrySlotPayment = {
  orderId: string;
  p24OrderId: string;
  p24SessionId: string;
  amountMinor: number;
};

export type ApplyVerifiedEntrySlotPaymentDependencies = {
  supabase?: AdminClient;
  generateTickets?: (orderId: string) => Promise<void>;
  syncSheet?: (orderId: string) => Promise<void>;
  sendEmail?: (orderId: string) => Promise<void>;
  sendInvoiceEmails?: (orderId: string) => Promise<void>;
  beforeMarkPaid?: () => Promise<void> | void;
  confirmHold?: (order: SlotOrder) => Promise<EntrySlotHoldRow>;
};

export type ApplyVerifiedEntrySlotPaymentResult = "paid" | "review";

const ORDER_SELECT =
  "id, payment_status, total_amount_minor, ticket_qty, entry_slot_id, payment_metadata" as const;

function readMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }

  return {};
}

function unwrapHold(
  data: EntrySlotHoldRow | EntrySlotHoldRow[] | null,
): EntrySlotHoldRow | null {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
}

function unfulfilledReason(error: unknown): string | null {
  const text = entrySlotErrorText(error);

  if (text.includes("HOLD_INACTIVE")) {
    return "HOLD_INACTIVE";
  }

  if (text.includes("HOLD_NOT_FOUND")) {
    return "HOLD_NOT_FOUND";
  }

  if (text.includes("HOLD_CONFLICT")) {
    return "HOLD_CONFLICT";
  }

  return null;
}

async function loadOrder(
  supabase: AdminClient,
  orderId: string,
): Promise<SlotOrder> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Order read failed.`, error);
    throw new Error("Entry slot order could not be read");
  }

  if (!data?.entry_slot_id) {
    throw new OrderNotPayableError(orderId);
  }

  return {
    ...data,
    payment_metadata: readMetadata(data.payment_metadata),
  };
}

async function confirmHold(
  supabase: AdminClient,
  order: SlotOrder,
): Promise<EntrySlotHoldRow> {
  if (!order.entry_slot_id) {
    throw new OrderNotPayableError(order.id);
  }

  const { data, error } = await supabase.rpc("confirm_entry_slot_hold", {
    p_order_id: order.id,
    p_slot_id: order.entry_slot_id,
    p_qty: order.ticket_qty,
  });

  if (error) {
    console.error(`${LOG_PREFIX} confirm_entry_slot_hold failed.`, error);
    throw error;
  }

  const hold = unwrapHold(data);

  if (!hold) {
    throw new Error("Entry slot confirmation returned no hold");
  }

  return hold;
}

async function fulfillPaidOrder(
  orderId: string,
  dependencies: ApplyVerifiedEntrySlotPaymentDependencies,
  supabase: AdminClient,
): Promise<void> {
  const generateTickets =
    dependencies.generateTickets ??
    ((paidOrderId: string) => insertOrderTickets(supabase, paidOrderId));
  const syncSheet =
    dependencies.syncSheet ??
    ((paidOrderId: string) => projectEntrySlotSoldCount(paidOrderId));
  const sendEmail = dependencies.sendEmail ?? sendOrderEmail;
  const sendInvoiceEmails =
    dependencies.sendInvoiceEmails ?? sendInvoiceNotificationEmails;

  await generateTickets(orderId);
  await syncSheet(orderId);

  await sendEmail(orderId);

  try {
    await sendInvoiceEmails(orderId);
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Invoice notification emails failed for ${orderId}.`,
      error,
    );
  }
}

async function saveManualReview(
  supabase: AdminClient,
  order: SlotOrder,
  payment: VerifiedEntrySlotPayment,
  reason: string,
): Promise<void> {
  const metadata = {
    ...readMetadata(order.payment_metadata),
    entry_slot_reservation: RESERVATION_UNFULFILLED,
    manual_review_reason: reason,
    p24_amount_minor: payment.amountMinor,
  };
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: "review",
      p24_order_id: payment.p24OrderId,
      p24_session_id: payment.p24SessionId,
      payment_metadata: metadata,
    })
    .eq("id", order.id)
    .in("payment_status", ["pending", "cancelled", "failed"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Manual review update failed.`, error);
    throw new Error("Confirmed payment could not be recorded for review");
  }

  if (data) {
    return;
  }

  const current = await loadOrder(supabase, order.id);

  if (current.payment_status === "review" || current.payment_status === "paid") {
    return;
  }

  throw new Error("Confirmed payment could not be recorded for review");
}

async function markPaid(
  supabase: AdminClient,
  order: SlotOrder,
  payment: VerifiedEntrySlotPayment,
  holdId: string,
): Promise<SlotOrder> {
  const metadata = {
    ...readMetadata(order.payment_metadata),
    entry_slot_reservation: RESERVATION_CONFIRMED,
    entry_slot_hold_id: holdId,
  };
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      p24_order_id: payment.p24OrderId,
      p24_session_id: payment.p24SessionId,
      payment_metadata: metadata,
    })
    .eq("id", order.id)
    .eq("payment_status", "pending")
    .select(ORDER_SELECT)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Paid update failed.`, error);
    throw new Error("Paid order could not be saved");
  }

  if (data?.entry_slot_id) {
    return {
      ...data,
      payment_metadata: readMetadata(data.payment_metadata),
    };
  }

  return loadOrder(supabase, order.id);
}

/**
 * Confirms a verified Przelewy24 payment for an entry-slot order.
 * Tickets are created only after confirm_entry_slot_hold succeeds.
 * HOLD_INACTIVE keeps the payment evidence and leaves the order for manual refund.
 */
export async function applyVerifiedEntrySlotPayment(
  payment: VerifiedEntrySlotPayment,
  dependencies: ApplyVerifiedEntrySlotPaymentDependencies = {},
): Promise<ApplyVerifiedEntrySlotPaymentResult> {
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();
  const order = await loadOrder(supabase, payment.orderId);

  if (order.total_amount_minor !== payment.amountMinor) {
    throw new PaymentAmountMismatchError();
  }

  if (order.payment_status === "review") {
    return "review";
  }

  if (order.payment_status === "paid") {
    await fulfillPaidOrder(order.id, dependencies, supabase);
    return "paid";
  }

  if (order.payment_status !== "pending") {
    await saveManualReview(supabase, order, payment, "ORDER_NOT_PENDING");
    return "review";
  }

  let hold: EntrySlotHoldRow;

  try {
    hold = dependencies.confirmHold
      ? await dependencies.confirmHold(order)
      : await confirmHold(supabase, order);
  } catch (error) {
    const reason = unfulfilledReason(error);

    if (reason) {
      await saveManualReview(supabase, order, payment, reason);
      return "review";
    }

    if (error instanceof OrderRequestError) {
      throw error;
    }

    const mapped = mapEntrySlotRpcError(error);

    if (mapped instanceof EntrySlotHoldInactiveError) {
      await saveManualReview(supabase, order, payment, "HOLD_INACTIVE");
      return "review";
    }

    throw mapped;
  }

  if (dependencies.beforeMarkPaid) {
    await dependencies.beforeMarkPaid();
  }

  const paidOrder = await markPaid(supabase, order, payment, hold.id);

  if (paidOrder.payment_status === "review") {
    return "review";
  }

  if (paidOrder.payment_status !== "paid") {
    throw new Error("Paid order could not be saved");
  }

  await fulfillPaidOrder(paidOrder.id, dependencies, supabase);
  return "paid";
}
