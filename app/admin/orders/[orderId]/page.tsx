import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AdminOrderInvoiceSection } from "@/components/admin/AdminOrderInvoiceSection";
import { AdminOrderRefundPanel } from "@/components/admin/AdminOrderRefundPanel";
import { TicketsTable } from "@/components/admin/TicketsTable";
import {
  AdminEmptyState,
  AdminErrorState,
} from "@/components/admin/AdminTableStates";
import { formatAmountMinor, formatDateTime } from "@/lib/admin/format";
import {
  getAdminOrderWithTickets,
  type AdminOrderWithTickets,
} from "@/lib/admin/orders";
import { getTicketBreakdown } from "@/lib/orders/ticket-breakdown";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

function isValidOrderId(orderId: string): boolean {
  return z.string().uuid().safeParse(orderId).success;
}

export default async function AdminOrderDetailsPage({ params }: PageProps) {
  const { orderId } = await params;

  if (!isValidOrderId(orderId)) {
    notFound();
  }

  let result: AdminOrderWithTickets | null = null;
  let errorMessage: string | null = null;

  try {
    result = await getAdminOrderWithTickets(orderId);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Nieoczekiwany błąd.";
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin"
          className="text-sm font-medium text-[#1f4d35] underline-offset-4 hover:underline"
        >
          ← Wróć do listy
        </Link>
        <AdminErrorState description={errorMessage} />
      </div>
    );
  }

  if (!result) {
    notFound();
  }

  const { order, tickets } = result;
  const breakdown = getTicketBreakdown(order);

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="text-sm font-medium text-[#1f4d35] underline-offset-4 hover:underline"
      >
        ← Wróć do listy
      </Link>

      <section className="garden-section p-6 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-[#666]">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Szczegóły zamówienia</h1>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <DetailItem label="Order id" value={order.id} mono />
          <DetailItem
            label="Session id"
            value={order.p24_session_id ?? "—"}
            mono
          />
          <DetailItem label="Email" value={order.customer_email} />
          <DetailItem label="Booking date" value={order.booking_date} />
          <DetailItem label="Normal tickets" value={String(breakdown.normalQty)} />
          <DetailItem
            label="Reduced tickets"
            value={String(breakdown.reducedQty)}
          />
          <DetailItem label="Total tickets" value={String(breakdown.totalQty)} />
          <DetailItem
            label="Amount"
            value={formatAmountMinor(order.total_amount_minor)}
          />
          <DetailItem
            label="Created at"
            value={formatDateTime(order.created_at)}
          />
          <DetailItem
            label="Payment time"
            value={formatDateTime(order.paid_at)}
          />
          <DetailItem
            label="Email sent"
            value={formatDateTime(order.email_sent_at)}
          />
          <DetailItem
            label="Sheet synced"
            value={formatDateTime(order.sheet_synced_at)}
          />
        </dl>
      </section>

      <AdminOrderInvoiceSection
        orderId={order.id}
        invoiceRequested={order.invoice_requested}
        invoiceCompanyName={order.invoice_company_name}
        invoiceNip={order.invoice_nip}
        invoiceStreet={order.invoice_street}
        invoicePostalCode={order.invoice_postal_code}
        invoiceCity={order.invoice_city}
        invoiceIssued={order.invoice_issued}
        invoiceIssuedAt={order.invoice_issued_at}
      />

      <AdminOrderRefundPanel
        orderId={order.id}
        customerEmail={order.customer_email}
        bookingDate={order.booking_date}
        ticketQty={order.ticket_qty}
        amountMinor={order.total_amount_minor}
        initialPaymentStatus={order.payment_status}
        initialRefundedAt={order.refunded_at}
        initialRefundAmountMinor={order.refund_amount_minor}
        initialRefundId={order.refund_id}
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Bilety</h2>
          <p className="mt-2 text-sm text-[#666]">
            Wygenerowane bilety dla tego zamówienia.
          </p>
        </div>

        {tickets.length === 0 ? (
          <AdminEmptyState
            title="Brak biletów"
            description="Dla tego zamówienia nie wygenerowano jeszcze biletów."
          />
        ) : (
          <TicketsTable tickets={tickets} />
        )}
      </section>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <dt className="text-sm text-[#666]">{label}</dt>
      <dd
        className={[
          "mt-1 break-all font-medium",
          mono ? "font-mono text-xs sm:text-sm" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
