import "server-only";

import { getEnv } from "@/lib/config/env";
import { buildInvoiceAdminEmailContent } from "@/lib/email/build-invoice-admin-email";
import { buildInvoiceCustomerEmailContent } from "@/lib/email/build-invoice-customer-email";
import { getMailFromAddress, getResendClient } from "@/lib/email/client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const LOG_PREFIX = "[sendInvoiceNotificationEmails]";
const METADATA_SENT_KEY = "invoice_notification_sent_at";

function formatAmountMinor(amountMinor: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function getAdminOrderUrl(orderId: string): string {
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${appUrl}/admin/orders/${orderId}`;
}

function readMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }

  return {};
}

/**
 * Notifies admin and customer after a paid order requested a VAT invoice.
 * Idempotent via payment_metadata.invoice_notification_sent_at.
 * Callers should catch errors so payment finalization is never blocked.
 */
export async function sendInvoiceNotificationEmails(
  orderId: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, booking_date, customer_email, total_amount_minor, payment_status, invoice_requested, invoice_company_name, invoice_nip, invoice_street, invoice_postal_code, invoice_city, payment_metadata",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  if (order.payment_status !== "paid") {
    return;
  }

  if (!order.invoice_requested) {
    return;
  }

  const metadata = readMetadata(order.payment_metadata);
  if (typeof metadata[METADATA_SENT_KEY] === "string") {
    return;
  }

  const amountLabel = formatAmountMinor(order.total_amount_minor);
  const companyName = order.invoice_company_name?.trim() || "—";
  const nip = order.invoice_nip?.trim() || "—";
  const street = order.invoice_street?.trim() || "—";
  const postalCode = order.invoice_postal_code?.trim() || "—";
  const city = order.invoice_city?.trim() || "—";

  const adminEmail = getEnv().INVOICE_NOTIFICATION_EMAIL;
  const resend = getResendClient();
  const from = getMailFromAddress();
  const failures: string[] = [];

  if (adminEmail) {
    const adminContent = buildInvoiceAdminEmailContent({
      orderId: order.id,
      visitDate: order.booking_date,
      customerEmail: order.customer_email,
      amountLabel,
      companyName,
      nip,
      street,
      postalCode,
      city,
      adminOrderUrl: getAdminOrderUrl(order.id),
    });

    const { error: adminSendError } = await resend.emails.send({
      from,
      to: adminEmail,
      subject: adminContent.subject,
      html: adminContent.html,
      text: adminContent.text,
    });

    if (adminSendError) {
      console.error(`${LOG_PREFIX} Admin email failed.`, adminSendError);
      failures.push(adminSendError.message);
    }
  } else {
    console.error(
      `${LOG_PREFIX} INVOICE_NOTIFICATION_EMAIL is not configured; skipping admin notification.`,
    );
  }

  const customerContent = buildInvoiceCustomerEmailContent({
    visitDate: order.booking_date,
    companyName,
    amountLabel,
  });

  const { error: customerSendError } = await resend.emails.send({
    from,
    to: order.customer_email,
    subject: customerContent.subject,
    html: customerContent.html,
    text: customerContent.text,
  });

  if (customerSendError) {
    console.error(`${LOG_PREFIX} Customer email failed.`, customerSendError);
    failures.push(customerSendError.message);
  }

  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }

  const nextMetadata = {
    ...metadata,
    [METADATA_SENT_KEY]: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("orders")
    .update({ payment_metadata: nextMetadata })
    .eq("id", orderId)
    .eq("payment_status", "paid");

  if (updateError) {
    throw new Error(updateError.message);
  }
}
