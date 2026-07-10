import "server-only";

import { sendOrderEmail } from "@/lib/email/send-order-email";
import { updateSoldCountForOrder } from "@/lib/sheets/update-sold-count";
import { generateTicketsForOrder } from "@/lib/tickets";

export async function finalizePaidOrder(orderId: string): Promise<void> {
  await generateTicketsForOrder(orderId);
  await updateSoldCountForOrder(orderId);
  await sendOrderEmail(orderId);
}
