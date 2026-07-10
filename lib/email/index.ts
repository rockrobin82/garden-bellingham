export { getMailFromAddress, getResendClient } from "@/lib/email/client";
export { buildOrderEmailContent } from "@/lib/email/build-order-email";
export { sendOrderEmail } from "@/lib/email/send-order-email";
export type {
  OrderEmailAttachment,
  OrderEmailContent,
  OrderEmailData,
} from "@/lib/email/types";
