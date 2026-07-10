import { z } from "zod";

export const createP24PaymentRequestSchema = z.object({
  orderId: z.string().uuid(),
});

export type CreateP24PaymentRequest = z.infer<typeof createP24PaymentRequestSchema>;
