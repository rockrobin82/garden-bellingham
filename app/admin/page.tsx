import Link from "next/link";

import { OrdersFilterForm } from "@/components/admin/OrdersFilterForm";
import { OrdersTable } from "@/components/admin/OrdersTable";
import {
  AdminEmptyState,
  AdminErrorState,
} from "@/components/admin/AdminTableStates";
import {
  formatOrdersFoundCount,
  hasActiveAdminOrderFilters,
  parseAdminOrderFilters,
} from "@/lib/admin/order-filters";
import {
  countPendingInvoices,
  listAdminOrders,
  type AdminOrderListItem,
} from "@/lib/admin/orders";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = parseAdminOrderFilters(resolvedSearchParams);
  const filtersActive = hasActiveAdminOrderFilters(filters);

  let orders: AdminOrderListItem[] = [];
  let pendingInvoices = 0;
  let errorMessage: string | null = null;

  try {
    const [orderRows, invoiceCount] = await Promise.all([
      listAdminOrders(filters),
      countPendingInvoices(),
    ]);
    orders = orderRows;
    pendingInvoices = invoiceCount;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Nieoczekiwany błąd.";
  }

  return (
    <div className="space-y-6">
      <header className="garden-section p-6 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-[#666]">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Zamówienia</h1>
        <p className="mt-2 text-sm text-[#666]">
          Najnowsze zamówienia biletów (najpierw najnowsze).
        </p>
      </header>

      <Link
        href="/admin?invoice=waiting"
        className="garden-section block p-6 transition hover:bg-[#f3f8f5] sm:p-8"
      >
        <p className="text-sm font-medium uppercase tracking-wide text-[#666]">
          🧾 Faktury do wystawienia
        </p>
        <p className="mt-2 text-3xl font-semibold text-[#1f4d35]">
          {pendingInvoices}
        </p>
        <p className="mt-2 text-sm text-[#666]">
          Zamówienia ze zgłoszoną fakturą VAT oczekujące na wystawienie.
        </p>
      </Link>

      <OrdersFilterForm filters={filters} />

      {errorMessage ? (
        <AdminErrorState description={errorMessage} />
      ) : (
        <>
          <p className="text-sm font-medium text-[#1f4d35]">
            {formatOrdersFoundCount(orders.length)}
          </p>

          {orders.length === 0 ? (
            filtersActive ? (
              <div className="garden-section space-y-4 p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-[#1f4d35]">
                  Brak wyników
                </h2>
                <p className="text-sm text-[#666]">
                  Nie znaleziono zamówień spełniających wybrane kryteria.
                </p>
                <Link
                  href="/admin"
                  className="garden-btn inline-flex px-5 py-3 text-sm font-medium"
                >
                  Wyczyść filtry
                </Link>
              </div>
            ) : (
              <AdminEmptyState />
            )
          ) : (
            <OrdersTable orders={orders} />
          )}
        </>
      )}
    </div>
  );
}
