import { z } from "zod";

import type { CheckoutPayload } from "@/types/booking";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const checkoutPayloadSchema = z
  .object({
    visitDate: z.string().regex(isoDateRegex, "visitDate must be YYYY-MM-DD"),
    email: z.string().email(),
    normalQty: z.number().int().min(0),
    reducedQty: z.number().int().min(0),
  })
  .refine((data) => data.normalQty + data.reducedQty > 0, {
    message: "At least one ticket is required",
    path: ["normalQty"],
  });

export function parseCheckoutPayload(input: unknown): CheckoutPayload {
  return checkoutPayloadSchema.parse(input);
}
