import "server-only";

import { buildOrderEmailContent } from "@/lib/email/build-order-email";
import { getMailFromAddress, getResendClient } from "@/lib/email/client";
import { getOrderPageUrl, getOrderWithTickets } from "@/lib/orders/get-order-with-tickets";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Sends the order confirmation email after successful payment.
 * Idempotent: skips when email_sent_at is already set.
 */
export async function sendOrderEmail(orderId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, booking_date, customer_email, ticket_qty, payment_status, email_sent_at",
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

  const orderWithTickets = await getOrderWithTickets(orderId);

  if (!orderWithTickets) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const emailContent = buildOrderEmailContent({
    customerEmail: order.customer_email,
    visitDate: order.booking_date,
    ticketCount:
      orderWithTickets.tickets.length > 0
        ? orderWithTickets.tickets.length
        : order.ticket_qty,
    orderPageUrl: getOrderPageUrl(order.id),
  });

  const resend = getResendClient();
  const { error: sendError } = await resend.emails.send({
    from: getMailFromAddress(),
    to: order.customer_email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    attachments: emailContent.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
    })),
  });

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
