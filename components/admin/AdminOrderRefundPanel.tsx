"use client";

import { useState } from "react";

import { formatAmountMinor, formatDateTime } from "@/lib/admin/format";
import { formatPaymentStatus } from "@/lib/orders/format-payment-status";
import type { PaymentStatus } from "@/types/database";

type AdminOrderRefundPanelProps = {
  orderId: string;
  customerEmail: string;
  bookingDate: string;
  ticketQty: number;
  amountMinor: number;
  initialPaymentStatus: PaymentStatus;
  initialRefundedAt: string | null;
  initialRefundAmountMinor: number | null;
  initialRefundId: string | null;
};

type RefundApiResponse = {
  refundId: string;
  refundAmountMinor: number;
  refundedAt: string;
  error?: string;
};

export function AdminOrderRefundPanel({
  orderId,
  customerEmail,
  bookingDate,
  ticketQty,
  amountMinor,
  initialPaymentStatus,
  initialRefundedAt,
  initialRefundAmountMinor,
  initialRefundId,
}: AdminOrderRefundPanelProps) {
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>(initialPaymentStatus);
  const [refundedAt, setRefundedAt] = useState(initialRefundedAt);
  const [refundAmountMinor, setRefundAmountMinor] = useState(
    initialRefundAmountMinor,
  );
  const [refundId, setRefundId] = useState(initialRefundId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canRefund = paymentStatus === "paid";
  const isRefunded = paymentStatus === "refunded";

  async function handleRefund() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Zwrot wykonany przez administratora",
        }),
      });

      const payload = (await response.json()) as RefundApiResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Nie udało się wykonać zwrotu.");
      }

      setPaymentStatus("refunded");
      setRefundedAt(payload.refundedAt);
      setRefundAmountMinor(payload.refundAmountMinor);
      setRefundId(payload.refundId);
      setIsModalOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nie udało się wykonać zwrotu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4">
        <p className="text-sm text-[#666]">Status</p>
        <p className="mt-1 font-medium">{formatPaymentStatus(paymentStatus)}</p>
      </div>

      <section className="garden-section space-y-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Refund</h2>
            <p className="mt-2 text-sm text-[#666]">
              Zwrot środków przez Przelewy24 dla tego zamówienia.
            </p>
          </div>

          {canRefund ? (
            <button
              type="button"
              onClick={() => {
                setErrorMessage("");
                setIsModalOpen(true);
              }}
              className="garden-btn px-4 py-2 text-sm font-medium"
            >
              💰 Wykonaj zwrot
            </button>
          ) : null}
        </div>

        {isRefunded ? (
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="font-medium text-[#1f4d35]">Refund wykonano</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#666]">Data</dt>
                <dd className="font-medium">{formatDateTime(refundedAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#666]">Kwota</dt>
                <dd className="font-medium">
                  {formatAmountMinor(refundAmountMinor ?? amountMinor)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#666]">Refund ID</dt>
                <dd className="break-all font-mono text-xs font-medium sm:text-sm">
                  {refundId ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            <h3
              id="refund-modal-title"
              className="text-lg font-semibold text-[#1f4d35]"
            >
              Czy na pewno chcesz wykonać zwrot?
            </h3>

            <dl className="mt-4 space-y-2 text-sm text-[#1f4d35]">
              <div>
                <dt className="text-[#666]">Klient</dt>
                <dd className="font-medium break-all">{customerEmail}</dd>
              </div>
              <div>
                <dt className="text-[#666]">Email</dt>
                <dd className="font-medium break-all">{customerEmail}</dd>
              </div>
              <div>
                <dt className="text-[#666]">Kwota</dt>
                <dd className="font-medium">{formatAmountMinor(amountMinor)}</dd>
              </div>
              <div>
                <dt className="text-[#666]">Bilety</dt>
                <dd className="font-medium">
                  {ticketQty} ({bookingDate})
                </dd>
              </div>
            </dl>

            <ul className="mt-4 space-y-1 text-sm text-[#666]">
              <li>✓ bilety zostaną anulowane</li>
              <li>✓ środki zostaną zwrócone</li>
              <li>✓ miejsca wrócą do sprzedaży</li>
            </ul>

            {errorMessage ? (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-[#1f4d35] disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleRefund()}
                className="garden-btn px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Wykonywanie zwrotu…" : "Wykonaj zwrot"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
