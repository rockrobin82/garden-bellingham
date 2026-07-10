export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type CheckoutPayload = {
  visitDate: string;
  email: string;
  ticketQty: number;
};

export type CreateOrderRequest = {
  bookingDate: string;
  email: string;
  ticketQty: number;
};

export type CreateOrderResponse = {
  orderId: string;
  status: "pending";
  totalAmountMinor: number;
};
