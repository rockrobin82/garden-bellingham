import { OrdersTable } from "@/components/admin/OrdersTable";
import {
  AdminEmptyState,
  AdminErrorState,
} from "@/components/admin/AdminTableStates";
import { listAdminOrders, type AdminOrderListItem } from "@/lib/admin/orders";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let orders: AdminOrderListItem[] = [];
  let errorMessage: string | null = null;

  try {
    orders = await listAdminOrders();
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

      {errorMessage ? (
        <AdminErrorState description={errorMessage} />
      ) : orders.length === 0 ? (
        <AdminEmptyState />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}
