/**
 * Invoice domain types.
 *
 * Current MVP stores buyer invoice request data on `orders`.
 * These types leave room for later document generation, PDF delivery,
 * and external accounting integrations (Fakturownia, wFirma, iFirma)
 * without changing the purchase flow.
 */

export type InvoiceBuyerData = {
  companyName: string;
  nip: string;
  street: string;
  postalCode: string;
  city: string;
};

export type InvoiceIssueStatus = "not_requested" | "pending" | "issued";

/**
 * Reserved for future invoice document metadata (number, PDF, provider sync).
 * Not persisted yet.
 */
export type InvoiceDocumentPlaceholder = {
  invoiceNumber?: string;
  pdfUrl?: string;
  provider?: "manual" | "fakturownia" | "wfirma" | "ifirma";
  providerExternalId?: string;
  emailedAt?: string;
};
