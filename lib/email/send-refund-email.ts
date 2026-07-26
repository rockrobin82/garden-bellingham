import "server-only";

import { buildRefundEmailContent } from "@/lib/email/build-refund-email";
import { getMailFromAddress, getResendClient } from "@/lib/email/client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const LOG_PREFIX = "[sendRefundEmail]";

function formatAmountMinor(amountMinor: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/**
 * Sends the refund confirmation email after a successful refund.
 */
export async function sendRefundEmail(orderId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, booking_date, customer_email, ticket_qty, refund_amount_minor, total_amount_minor, payment_status",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error(`${LOG_PREFIX} Supabase load failed.`, orderError);
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  if (order.payment_status !== "refunded") {
    return;
  }

  const refundAmountMinor =
    order.refund_amount_minor ?? order.total_amount_minor;

  const emailContent = buildRefundEmailContent({
    customerEmail: order.customer_email,
    visitDate: order.booking_date,
    ticketCount: order.ticket_qty,
    refundAmountLabel: formatAmountMinor(refundAmountMinor),
  });

  try {
    const resend = getResendClient();
    const { error: sendError } = await resend.emails.send({
      from: getMailFromAddress(),
      to: order.customer_email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (sendError) {
      throw new Error(sendError.message);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Email send failed.`, error);
    throw error;
  }
}
