import "server-only";

import type { OrderEmailContent } from "@/lib/email/types";

const EMAIL_SUBJECT = "Potwierdzenie prośby o fakturę VAT";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type InvoiceCustomerEmailData = {
  visitDate: string;
  companyName: string;
  amountLabel: string;
};

/**
 * Builds the customer confirmation email for a VAT invoice request.
 */
export function buildInvoiceCustomerEmailContent(
  data: InvoiceCustomerEmailData,
): OrderEmailContent {
  const text = [
    "Dziękujemy za zakup.",
    "",
    "Otrzymaliśmy Twoją prośbę o wystawienie faktury VAT.",
    "Faktura zostanie przesłana na ten adres e-mail po jej przygotowaniu.",
    "",
    `Data wizyty: ${data.visitDate}`,
    `Nazwa firmy: ${data.companyName}`,
    `Kwota: ${data.amountLabel}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f4d35; line-height: 1.6;">
      <p>Dziękujemy za zakup.</p>
      <p>Otrzymaliśmy Twoją prośbę o wystawienie faktury VAT.</p>
      <p>Faktura zostanie przesłana na ten adres e-mail po jej przygotowaniu.</p>
      <p><strong>Data wizyty:</strong> ${escapeHtml(data.visitDate)}</p>
      <p><strong>Nazwa firmy:</strong> ${escapeHtml(data.companyName)}</p>
      <p><strong>Kwota:</strong> ${escapeHtml(data.amountLabel)}</p>
    </div>
  `.trim();

  return {
    subject: EMAIL_SUBJECT,
    html,
    text,
    attachments: [],
  };
}
