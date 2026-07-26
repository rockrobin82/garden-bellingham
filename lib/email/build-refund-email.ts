import "server-only";

import type { OrderEmailContent } from "@/lib/email/types";

const EMAIL_SUBJECT = "Zwrot środków został wykonany";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type RefundEmailData = {
  customerEmail: string;
  visitDate: string;
  ticketCount: number;
  refundAmountLabel: string;
};

/**
 * Builds the refund confirmation email content.
 */
export function buildRefundEmailContent(data: RefundEmailData): OrderEmailContent {
  const visitDate = escapeHtml(data.visitDate);
  const refundAmount = escapeHtml(data.refundAmountLabel);
  const ticketCount = data.ticketCount;

  const text = [
    "Dziękujemy.",
    "",
    "Zwrot środków za bilety do Ogrodu Katarzyny Bellingham został wykonany.",
    "",
    `Kwota zwrotu: ${data.refundAmountLabel}`,
    `Liczba biletów: ${ticketCount}`,
    `Data wydarzenia: ${data.visitDate}`,
    "",
    "Środki wrócą na Twoje konto zgodnie z regulaminem Przelewy24.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f4d35; line-height: 1.6;">
      <p>Dziękujemy.</p>
      <p>Zwrot środków za bilety do Ogrodu Katarzyny Bellingham został wykonany.</p>
      <p><strong>Kwota zwrotu:</strong> ${refundAmount}</p>
      <p><strong>Liczba biletów:</strong> ${ticketCount}</p>
      <p><strong>Data wydarzenia:</strong> ${visitDate}</p>
      <p>Środki wrócą na Twoje konto zgodnie z regulaminem Przelewy24.</p>
    </div>
  `.trim();

  return {
    subject: EMAIL_SUBJECT,
    html,
    text,
    attachments: [],
  };
}
