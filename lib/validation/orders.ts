import { z } from "zod";

import type { CreateOrderRequest } from "@/types/booking";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createOrderRequestSchema = z.object({
  bookingDate: z
    .string()
    .trim()
    .min(1, "bookingDate is required")
    .regex(isoDateRegex, "bookingDate must be YYYY-MM-DD"),
  email: z.string().trim().email(),
  ticketQty: z.number().int().positive(),
});

export function parseCreateOrderRequest(input: unknown): CreateOrderRequest {
  return createOrderRequestSchema.parse(input);
}
