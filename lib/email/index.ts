export { getMailFromAddress, getResendClient } from "@/lib/email/client";
export { buildOrderEmailContent } from "@/lib/email/build-order-email";
export { buildRefundEmailContent } from "@/lib/email/build-refund-email";
export { sendOrderEmail } from "@/lib/email/send-order-email";
export { sendRefundEmail } from "@/lib/email/send-refund-email";
export type {
  OrderEmailAttachment,
  OrderEmailContent,
  OrderEmailData,
} from "@/lib/email/types";
export type { RefundEmailData } from "@/lib/email/build-refund-email";
