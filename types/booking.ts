export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type CheckoutPayload = {
  visitDate: string;
  email: string;
  normalQty: number;
  reducedQty: number;
};
