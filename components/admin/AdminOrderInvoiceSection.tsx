"use client";

import { useState, useTransition } from "react";

import { markInvoiceIssuedAction } from "@/app/admin/orders/[orderId]/invoice-actions";
import { formatDateTime } from "@/lib/admin/format";
import {
  formatInvoiceClipboardText,
  getInvoiceIssueStatus,
} from "@/lib/invoices/status";

type AdminOrderInvoiceSectionProps = {
  orderId: string;
  invoiceRequested: boolean;
  invoiceCompanyName: string | null;
  invoiceNip: string | null;
  invoiceStreet: string | null;
  invoicePostalCode: string | null;
  invoiceCity: string | null;
  invoiceIssued: boolean;
  invoiceIssuedAt: string | null;
};

export function AdminOrderInvoiceSection({
  orderId,
  invoiceRequested,
  invoiceCompanyName,
  invoiceNip,
  invoiceStreet,
  invoicePostalCode,
  invoiceCity,
  invoiceIssued,
  invoiceIssuedAt,
}: AdminOrderInvoiceSectionProps) {
  const [issued, setIssued] = useState(invoiceIssued);
  const [issuedAt, setIssuedAt] = useState(invoiceIssuedAt);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyError, setCopyError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const status = getInvoiceIssueStatus({
    invoice_requested: invoiceRequested,
    invoice_issued: issued,
  });

  async function handleCopy() {
    setCopyMessage("");
    setCopyError("");

    const text = formatInvoiceClipboardText({
      invoice_company_name: invoiceCompanyName,
      invoice_nip: invoiceNip,
      invoice_street: invoiceStreet,
      invoice_postal_code: invoicePostalCode,
      invoice_city: invoiceCity,
    });

    if (!text) {
      setCopyError("Brak danych do skopiowania.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Dane do faktury zostały skopiowane.");
    } catch (error) {
      console.error("[AdminOrderInvoiceSection] clipboard failed", error);
      setCopyError("Nie udało się skopiować danych do schowka.");
    }
  }

  function handleMarkIssued() {
    setActionError("");
    setSuccessMessage("");

    startTransition(async () => {
      const result = await markInvoiceIssuedAction(orderId);
      if (!result.success) {
        setActionError(result.error ?? "Nie udało się oznaczyć faktury.");
        return;
      }

      setIssued(true);
      setIssuedAt(new Date().toISOString());
      setSuccessMessage("Faktura została oznaczona jako wystawiona.");
    });
  }

  return (
    <section className="garden-section space-y-4 p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-semibold">Faktura VAT</h2>
        <p className="mt-2 text-sm text-[#666]">
          Dane nabywcy zgłoszone przed płatnością.
        </p>
      </div>

      {!invoiceRequested ? (
        <p className="text-sm text-[#666]">
          Klient nie zgłosił chęci otrzymania faktury VAT.
        </p>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Nazwa firmy" value={invoiceCompanyName ?? "—"} />
            <DetailItem label="NIP" value={invoiceNip ?? "—"} />
            <DetailItem label="Ulica" value={invoiceStreet ?? "—"} />
            <DetailItem label="Kod pocztowy" value={invoicePostalCode ?? "—"} />
            <DetailItem label="Miasto" value={invoiceCity ?? "—"} />
          </dl>

          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-sm text-[#666]">Status</p>
            <p className="mt-1 font-medium">
              {status === "issued"
                ? "🟢 Wystawiona"
                : "🟡 Oczekuje na wystawienie"}
            </p>
            {status === "issued" ? (
              <p className="mt-2 text-sm text-[#666]">
                Data wystawienia: {formatDateTime(issuedAt)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-[#1f4d35] transition hover:bg-[#f6faf7]"
            >
              Kopiuj dane do faktury
            </button>

            {status === "pending" ? (
              <button
                type="button"
                onClick={handleMarkIssued}
                disabled={isPending}
                className="garden-btn px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending
                  ? "Zapisywanie…"
                  : "Oznacz fakturę jako wystawioną"}
              </button>
            ) : null}
          </div>

          {copyMessage ? (
            <p className="text-sm text-[#1f4d35]" role="status">
              {copyMessage}
            </p>
          ) : null}
          {copyError ? (
            <p className="text-sm text-red-600" role="alert">
              {copyError}
            </p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-[#1f4d35]" role="status">
              {successMessage}
            </p>
          ) : null}
          {actionError ? (
            <p className="text-sm text-red-600" role="alert">
              {actionError}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <dt className="text-sm text-[#666]">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  );
}
