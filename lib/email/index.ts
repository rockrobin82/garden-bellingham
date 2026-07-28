export { getMailFromAddress, getResendClient } from "@/lib/email/client";
export { buildOrderEmailContent } from "@/lib/email/build-order-email";
export { buildRefundEmailContent } from "@/lib/email/build-refund-email";
export { buildInvoiceAdminEmailContent } from "@/lib/email/build-invoice-admin-email";
export { buildInvoiceCustomerEmailContent } from "@/lib/email/build-invoice-customer-email";
export { sendOrderEmail } from "@/lib/email/send-order-email";
export { sendRefundEmail } from "@/lib/email/send-refund-email";
export { sendInvoiceNotificationEmails } from "@/lib/email/send-invoice-notification-emails";
export type {
  OrderEmailAttachment,
  OrderEmailContent,
  OrderEmailData,
} from "@/lib/email/types";
export type { RefundEmailData } from "@/lib/email/build-refund-email";
export type { InvoiceAdminEmailData } from "@/lib/email/build-invoice-admin-email";
export type { InvoiceCustomerEmailData } from "@/lib/email/build-invoice-customer-email";
