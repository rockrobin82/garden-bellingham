import { z } from "zod";

import type { PaymentStatus } from "@/types/booking";

export const paymentStatusSchema = z.enum([
  "pending",
  "paid",
  "failed",
  "cancelled",
]);

export function parsePaymentStatus(value: string): PaymentStatus {
  return paymentStatusSchema.parse(value);
}
