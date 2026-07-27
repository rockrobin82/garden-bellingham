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
import { listAdminOrders, type AdminOrderListItem } from "@/lib/admin/orders";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = parseAdminOrderFilters(resolvedSearchParams);
  const filtersActive = hasActiveAdminOrderFilters(filters);

  let orders: AdminOrderListItem[] = [];
  let errorMessage: string | null = null;

  try {
    orders = await listAdminOrders(filters);
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
