import "server-only";

import { sendInvoiceNotificationEmails } from "@/lib/email/send-invoice-notification-emails";
import { sendOrderEmail } from "@/lib/email/send-order-email";
import { updateSoldCountForOrder } from "@/lib/sheets/update-sold-count";
import { generateTicketsForOrder } from "@/lib/tickets";

const LOG_PREFIX = "[finalizePaidOrder]";

export async function finalizePaidOrder(orderId: string): Promise<void> {
  await generateTicketsForOrder(orderId);
  await updateSoldCountForOrder(orderId);
  await sendOrderEmail(orderId);

  try {
    await sendInvoiceNotificationEmails(orderId);
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Invoice notification emails failed for order ${orderId}.`,
      error,
    );
  }
}
