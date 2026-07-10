import "server-only";

/**
 * Optional email attachment for future PDF ticket delivery.
 */
export type OrderEmailAttachment = {
  filename: string;
  content: Buffer;
};

export type OrderEmailContent = {
  subject: string;
  html: string;
  text: string;
  attachments?: OrderEmailAttachment[];
};

export type OrderEmailData = {
  customerEmail: string;
  visitDate: string;
  ticketCount: number;
  orderPageUrl: string;
};
