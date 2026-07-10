import { z } from "zod";

export const createP24PaymentRequestSchema = z.object({
  orderId: z.string().uuid(),
});

export type CreateP24PaymentRequest = z.infer<typeof createP24PaymentRequestSchema>;

export const p24TransactionNotificationSchema = z.object({
  merchantId: z.coerce.number().int(),
  posId: z.coerce.number().int(),
  sessionId: z.string().min(1),
  amount: z.coerce.number().int(),
  originAmount: z.coerce.number().int(),
  currency: z.enum(["PLN", "EUR", "USD", "GBP", "CZK"]),
  orderId: z.coerce.number().int(),
  methodId: z.coerce.number().int(),
  statement: z.string(),
  sign: z.string().min(1),
});

export type P24TransactionNotificationInput = z.infer<
  typeof p24TransactionNotificationSchema
>;
