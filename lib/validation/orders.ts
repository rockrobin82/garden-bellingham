import { z } from "zod";

import {
  normalizeInvoicePayload,
  orderInvoiceFieldsSchema,
  refineInvoiceFields,
} from "@/lib/validation/invoice";
import type { CreateOrderRequest } from "@/types/booking";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createOrderRequestSchema = z
  .object({
    bookingDate: z
      .string()
      .trim()
      .min(1, "bookingDate is required")
      .regex(isoDateRegex, "bookingDate must be YYYY-MM-DD"),
    email: z.string().trim().email(),
    normalQty: z.number().int().min(0),
    reducedQty: z.number().int().min(0),
  })
  .merge(orderInvoiceFieldsSchema)
  .refine((data) => data.normalQty + data.reducedQty > 0, {
    message: "At least one ticket is required",
    path: ["normalQty"],
  })
  .superRefine(refineInvoiceFields)
  .transform((data): CreateOrderRequest => {
    const invoice = normalizeInvoicePayload(data);

    return {
      bookingDate: data.bookingDate,
      email: data.email,
      normalQty: data.normalQty,
      reducedQty: data.reducedQty,
      ...invoice,
    };
  });

export function parseCreateOrderRequest(input: unknown): CreateOrderRequest {
  return createOrderRequestSchema.parse(input);
}

const entrySlotIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "entrySlotId is invalid");

const idempotencyKeySchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/,
    "idempotencyKey is invalid",
  );

export const createEntrySlotOrderRequestSchema = z
  .object({
    bookingDate: z
      .string()
      .trim()
      .min(1, "bookingDate is required")
      .regex(isoDateRegex, "bookingDate must be YYYY-MM-DD"),
    email: z.string().trim().email(),
    normalQty: z.number().int().min(0),
    reducedQty: z.number().int().min(0),
    entrySlotId: entrySlotIdSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .merge(orderInvoiceFieldsSchema)
  .refine((data) => data.normalQty + data.reducedQty > 0, {
    message: "At least one ticket is required",
    path: ["normalQty"],
  })
  .superRefine(refineInvoiceFields)
  .transform((data) => {
    const invoice = normalizeInvoicePayload(data);

    return {
      bookingDate: data.bookingDate,
      email: data.email,
      normalQty: data.normalQty,
      reducedQty: data.reducedQty,
      entrySlotId: data.entrySlotId,
      idempotencyKey: data.idempotencyKey,
      ...invoice,
    };
  });

export function parseCreateEntrySlotOrderRequest(input: unknown) {
  return createEntrySlotOrderRequestSchema.parse(input);
}
