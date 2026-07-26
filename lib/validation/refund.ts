import { z } from "zod";

export const adminRefundRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type AdminRefundRequest = z.infer<typeof adminRefundRequestSchema>;
