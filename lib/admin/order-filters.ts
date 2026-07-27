import type { PaymentStatus } from "@/types/database";

/**
 * Statuses available in the admin orders filter.
 * Derived from PaymentStatus — omit values that are not useful for ops filtering.
 */
export const ADMIN_ORDER_FILTER_STATUSES = [
  "pending",
  "paid",
  "refunded",
  "cancelled",
] as const satisfies ReadonlyArray<PaymentStatus>;

export type AdminOrderFilterStatus =
  (typeof ADMIN_ORDER_FILTER_STATUSES)[number];

export const ADMIN_INVOICE_FILTER_OPTIONS = [
  "none",
  "waiting",
  "issued",
] as const;

export type AdminInvoiceFilter =
  (typeof ADMIN_INVOICE_FILTER_OPTIONS)[number];

export type AdminOrderFilters = {
  search?: string;
  status?: AdminOrderFilterStatus;
  from?: string;
  to?: string;
  invoice?: AdminInvoiceFilter;
};

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isAdminOrderFilterStatus(
  value: string,
): value is AdminOrderFilterStatus {
  return (ADMIN_ORDER_FILTER_STATUSES as ReadonlyArray<string>).includes(
    value,
  );
}

function isAdminInvoiceFilter(value: string): value is AdminInvoiceFilter {
  return (ADMIN_INVOICE_FILTER_OPTIONS as ReadonlyArray<string>).includes(
    value,
  );
}

export function parseAdminOrderFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminOrderFilters {
  const search = firstParam(searchParams.search)?.trim() || undefined;
  const statusRaw = firstParam(searchParams.status)?.trim();
  const fromRaw = firstParam(searchParams.from)?.trim();
  const toRaw = firstParam(searchParams.to)?.trim();
  const invoiceRaw = firstParam(searchParams.invoice)?.trim();

  const status =
    statusRaw && isAdminOrderFilterStatus(statusRaw) ? statusRaw : undefined;
  const from = fromRaw && ISO_DATE_REGEX.test(fromRaw) ? fromRaw : undefined;
  const to = toRaw && ISO_DATE_REGEX.test(toRaw) ? toRaw : undefined;
  const invoice =
    invoiceRaw && isAdminInvoiceFilter(invoiceRaw) ? invoiceRaw : undefined;

  return {
    search,
    status,
    from,
    to,
    invoice,
  };
}

export function hasActiveAdminOrderFilters(filters: AdminOrderFilters): boolean {
  return Boolean(
    filters.search ||
      filters.status ||
      filters.from ||
      filters.to ||
      filters.invoice,
  );
}

export function formatOrdersFoundCount(count: number): string {
  const absolute = Math.abs(count);
  const mod10 = absolute % 10;
  const mod100 = absolute % 100;

  let noun: string;
  if (absolute === 1) {
    noun = "zamówienie";
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    noun = "zamówienia";
  } else {
    noun = "zamówień";
  }

  return `Znaleziono: ${count} ${noun}`;
}

/** Escapes ILIKE wildcards so user input is treated literally. */
export function escapeIlikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}
