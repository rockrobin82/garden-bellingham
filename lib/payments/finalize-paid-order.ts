import "server-only";

import { sendOrderEmail } from "@/lib/email/send-order-email";
import { generateTicketsForOrder } from "@/lib/tickets";

export async function finalizePaidOrder(orderId: string): Promise<void> {
  await generateTicketsForOrder(orderId);
  await sendOrderEmail(orderId);
}
