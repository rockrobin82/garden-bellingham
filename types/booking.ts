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

export type CreateOrderResponse = {
  orderId: string;
  status: "pending";
  totalAmountMinor: number;
};

export type CreateP24PaymentResponse = {
  redirectUrl: string;
  token: string;
};
