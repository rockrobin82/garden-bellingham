import "server-only";

import type { OrderEmailContent } from "@/lib/email/types";

const EMAIL_SUBJECT =
  "🧾 Nowe opłacone zamówienie wymagające faktury VAT";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type InvoiceAdminEmailData = {
  orderId: string;
  visitDate: string;
  customerEmail: string;
  amountLabel: string;
  companyName: string;
  nip: string;
  street: string;
  postalCode: string;
  city: string;
  adminOrderUrl: string;
};

/**
 * Builds the admin notification email for a paid order that requested a VAT invoice.
 */
export function buildInvoiceAdminEmailContent(
  data: InvoiceAdminEmailData,
): OrderEmailContent {
  const text = [
    "Nowe opłacone zamówienie wymaga wystawienia faktury VAT.",
    "",
    `Numer zamówienia: ${data.orderId}`,
    `Data wizyty: ${data.visitDate}`,
    `E-mail klienta: ${data.customerEmail}`,
    `Kwota: ${data.amountLabel}`,
    `Nazwa firmy: ${data.companyName}`,
    `NIP: ${data.nip}`,
    `Ulica: ${data.street}`,
    `Kod pocztowy: ${data.postalCode}`,
    `Miasto: ${data.city}`,
    "",
    "Panel administracyjny:",
    data.adminOrderUrl,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f4d35; line-height: 1.6;">
      <p>Nowe opłacone zamówienie wymaga wystawienia faktury VAT.</p>
      <p><strong>Numer zamówienia:</strong> ${escapeHtml(data.orderId)}</p>
      <p><strong>Data wizyty:</strong> ${escapeHtml(data.visitDate)}</p>
      <p><strong>E-mail klienta:</strong> ${escapeHtml(data.customerEmail)}</p>
      <p><strong>Kwota:</strong> ${escapeHtml(data.amountLabel)}</p>
      <p><strong>Nazwa firmy:</strong> ${escapeHtml(data.companyName)}</p>
      <p><strong>NIP:</strong> ${escapeHtml(data.nip)}</p>
      <p><strong>Ulica:</strong> ${escapeHtml(data.street)}</p>
      <p><strong>Kod pocztowy:</strong> ${escapeHtml(data.postalCode)}</p>
      <p><strong>Miasto:</strong> ${escapeHtml(data.city)}</p>
      <p style="margin-top: 24px;">
        <a
          href="${escapeHtml(data.adminOrderUrl)}"
          style="display: inline-block; background: #1f4d35; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 600;"
        >
          Otwórz zamówienie w panelu
        </a>
      </p>
    </div>
  `.trim();

  return {
    subject: EMAIL_SUBJECT,
    html,
    text,
    attachments: [],
  };
}
