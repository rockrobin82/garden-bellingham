import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  formatPaymentStatus,
  getOrderWithTickets,
  getTicketQrImagePath,
} from "@/lib/orders/get-order-with-tickets";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

function isValidOrderId(orderId: string): boolean {
  return z.string().uuid().safeParse(orderId).success;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params;

  return {
    title: "Twoje zamówienie | Ogród Bellingham",
    description: "Szczegóły zamówienia i bilety elektroniczne.",
    robots: {
      index: false,
      follow: false,
    },
    alternates: isValidOrderId(orderId)
      ? {
          canonical: `/orders/${orderId}`,
        }
      : undefined,
  };
}

export default async function OrderPage({ params }: PageProps) {
  const { orderId } = await params;

  if (!isValidOrderId(orderId)) {
    notFound();
  }

  const result = await getOrderWithTickets(orderId);

  if (!result) {
    notFound();
  }

  const { order, tickets } = result;

  return (
    <main className="bg-white px-6 py-10 text-[#1f4d35] sm:px-10 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="garden-section p-6 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-wide text-[#666]">
            Twoje zamówienie
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Bilety do Ogrodu Bellingham</h1>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-4">
              <dt className="text-sm text-[#666]">Data wizyty</dt>
              <dd className="mt-1 font-medium">{order.booking_date}</dd>
            </div>

            <div className="rounded-xl border border-border bg-white p-4">
              <dt className="text-sm text-[#666]">Status płatności</dt>
              <dd className="mt-1 font-medium">
                {formatPaymentStatus(order.payment_status)}
              </dd>
            </div>

            <div className="rounded-xl border border-border bg-white p-4">
              <dt className="text-sm text-[#666]">Adres e-mail</dt>
              <dd className="mt-1 font-medium break-all">{order.customer_email}</dd>
            </div>

            <div className="rounded-xl border border-border bg-white p-4">
              <dt className="text-sm text-[#666]">Liczba biletów</dt>
              <dd className="mt-1 font-medium">{order.ticket_qty}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Twoje bilety</h2>
            <p className="mt-2 text-sm leading-6 text-[#666]">
              Pokaż kod QR przy wejściu do ogrodu.
            </p>
          </div>

          {tickets.length === 0 ? (
            <div className="garden-section p-6 text-sm text-[#666]">
              Bilety są w trakcie przygotowania. Odśwież stronę za chwilę.
            </div>
          ) : (
            <div className="grid gap-4">
              {tickets.map((ticket, index) => (
                <article
                  key={ticket.ticket_code}
                  className="garden-section flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm text-[#666]">Bilet {index + 1}</p>
                    <p className="mt-1 font-mono text-sm font-medium break-all">
                      {ticket.ticket_code}
                    </p>
                  </div>

                  <img
                    src={getTicketQrImagePath(ticket.ticket_code)}
                    alt={`Kod QR biletu ${index + 1}`}
                    width={160}
                    height={160}
                    className="h-40 w-40 rounded-xl border border-border bg-white p-2"
                  />
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-center">
          <Link href="/" className="garden-btn px-5 py-3 text-sm font-medium">
            Wróć na stronę główną
          </Link>
        </div>
      </div>
    </main>
  );
}
