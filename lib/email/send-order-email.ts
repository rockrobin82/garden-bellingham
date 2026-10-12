import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildOrderEmailContent } from "@/lib/email/build-order-email";
import { getMailFromAddress, getResendClient } from "@/lib/email/client";
import { getOrderPageUrl } from "@/lib/orders/get-order-with-tickets";
import { getTicketBreakdown } from "@/lib/orders/ticket-breakdown";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type OrderConfirmationEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
};

export type SendOrderEmailDependencies = {
  supabase?: SupabaseClient<Database>;
  fromAddress?: string;
  sendEmail?: (
    payload: OrderConfirmationEmail,
    options: { idempotencyKey: string },
  ) => Promise<{ error: { message: string } | null }>;
};

/**
 * Sends the order confirmation after a successful payment.
 *
 * Skips when email_sent_at is already stored. Otherwise sends with a stable
 * Resend idempotency key for this order. Resend keeps that key for 24 hours
 * and does not promise delivery exactly once after the key expires, or when
 * a second request with the same key is still in flight. email_sent_at is
 * stored only after Resend accepts the send.
 */
export async function sendOrderEmail(
  orderId: string,
  dependencies: SendOrderEmailDependencies = {},
): Promise<void> {
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, booking_date, customer_email, ticket_qty, normal_qty, reduced_qty, payment_status, email_sent_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  if (order.email_sent_at) {
    return;
  }

  if (order.payment_status !== "paid") {
    return;
  }

  const ticketBreakdown = getTicketBreakdown(order);

  const emailContent = buildOrderEmailContent({
    customerEmail: order.customer_email,
    visitDate: order.booking_date,
    normalQty: ticketBreakdown.normalQty,
    reducedQty: ticketBreakdown.reducedQty,
    totalQty: ticketBreakdown.totalQty,
    orderPageUrl: getOrderPageUrl(order.id),
  });

  const payload: OrderConfirmationEmail = {
    from: dependencies.fromAddress ?? getMailFromAddress(),
    to: order.customer_email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    attachments: emailContent.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
    })),
  };
  const idempotencyKey = `order-confirmation/${orderId}`;
  const { error: sendError } = dependencies.sendEmail
    ? await dependencies.sendEmail(payload, { idempotencyKey })
    : await getResendClient().emails.send(payload, { idempotencyKey });

  if (sendError) {
    throw new Error(sendError.message);
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updatedOrder) {
    return;
  }
}
