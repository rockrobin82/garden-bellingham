export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type OrderInvoicePayload = {
  invoiceRequested: boolean;
  invoiceCompanyName?: string;
  invoiceNip?: string;
  invoiceStreet?: string;
  invoicePostalCode?: string;
  invoiceCity?: string;
};

export type CheckoutPayload = {
  visitDate: string;
  email: string;
  normalQty: number;
  reducedQty: number;
} & OrderInvoicePayload;

export type CreateOrderRequest = {
  bookingDate: string;
  email: string;
  normalQty: number;
  reducedQty: number;
} & OrderInvoicePayload;

/**
 * Prepared entry-slot order. The public checkout route does not accept this yet.
 */
export type CreateEntrySlotOrderRequest = CreateOrderRequest & {
  entrySlotId: string;
  idempotencyKey: string;
};

export type CreateOrderResponse = {
  orderId: string;
  status: "pending";
  totalAmountMinor: number;
};

export type CreateP24PaymentResponse = {
  redirectUrl: string;
  token: string;
};
