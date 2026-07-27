import type { InvoiceIssueStatus } from "@/lib/invoices/types";

export type InvoiceFlags = {
  invoice_requested: boolean;
  invoice_issued: boolean;
};

export type InvoiceAddressFields = {
  invoice_company_name: string | null;
  invoice_nip: string | null;
  invoice_street: string | null;
  invoice_postal_code: string | null;
  invoice_city: string | null;
};

export function getInvoiceIssueStatus(
  order: InvoiceFlags,
): InvoiceIssueStatus {
  if (!order.invoice_requested) {
    return "not_requested";
  }

  if (order.invoice_issued) {
    return "issued";
  }

  return "pending";
}

export function formatInvoiceClipboardText(order: InvoiceAddressFields): string {
  const lines = [
    order.invoice_company_name?.trim()
      ? `Nazwa firmy: ${order.invoice_company_name.trim()}`
      : null,
    order.invoice_nip?.trim() ? `NIP: ${order.invoice_nip.trim()}` : null,
    formatInvoiceAddress(order),
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

export function formatInvoiceAddress(order: InvoiceAddressFields): string | null {
  const street = order.invoice_street?.trim() ?? "";
  const postalCode = order.invoice_postal_code?.trim() ?? "";
  const city = order.invoice_city?.trim() ?? "";
  const cityLine = [postalCode, city].filter(Boolean).join(" ");
  const address = [street, cityLine].filter(Boolean).join(", ");

  if (!address) {
    return null;
  }

  return `Adres: ${address}`;
}

export function formatAdminInvoiceLabel(status: InvoiceIssueStatus): {
  label: string;
  title: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "🟡 Oczekuje",
        title: "Klient zgłosił fakturę VAT — oczekuje na wystawienie",
      };
    case "issued":
      return {
        label: "🟢 Wystawiona",
        title: "Faktura VAT została oznaczona jako wystawiona",
      };
    case "not_requested":
    default:
      return {
        label: "—",
        title: "Klient nie zgłosił chęci otrzymania faktury VAT",
      };
  }
}
