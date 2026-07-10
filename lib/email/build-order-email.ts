import "server-only";

import type { OrderEmailContent, OrderEmailData } from "@/lib/email/types";

const EMAIL_SUBJECT = "Twoje bilety do Ogrodu Katarzyny Bellingham";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Builds the order confirmation email content.
 * Attachments can be added later for PDF tickets without changing send flow.
 */
export function buildOrderEmailContent(data: OrderEmailData): OrderEmailContent {
  const visitDate = escapeHtml(data.visitDate);
  const orderPageUrl = escapeHtml(data.orderPageUrl);
  const ticketCount = data.ticketCount;

  const text = [
    "Dziękujemy za zakup.",
    "",
    `Data wizyty: ${data.visitDate}`,
    `Liczba biletów: ${ticketCount}`,
    "",
    "Otwórz swoje bilety:",
    data.orderPageUrl,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f4d35; line-height: 1.6;">
      <p>Dziękujemy za zakup.</p>
      <p>Twoje bilety do Ogrodu Katarzyny Bellingham są gotowe.</p>
      <p><strong>Data wizyty:</strong> ${visitDate}</p>
      <p><strong>Liczba biletów:</strong> ${ticketCount}</p>
      <p style="margin-top: 24px;">
        <a
          href="${orderPageUrl}"
          style="display: inline-block; background: #1f4d35; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 600;"
        >
          Otwórz swoje bilety
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
