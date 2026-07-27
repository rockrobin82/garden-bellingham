import Link from "next/link";

import {
  ADMIN_ORDER_FILTER_STATUSES,
  type AdminOrderFilters,
} from "@/lib/admin/order-filters";
import { formatPaymentStatus } from "@/lib/orders/format-payment-status";

type OrdersFilterFormProps = {
  filters: AdminOrderFilters;
};

export function OrdersFilterForm({ filters }: OrdersFilterFormProps) {
  return (
    <form
      method="get"
      action="/admin"
      className="garden-section space-y-5 p-6 sm:p-8"
    >
      <div>
        <h2 className="text-lg font-semibold text-[#1f4d35]">
          🔍 Filtrowanie zamówień
        </h2>
        <p className="mt-1 text-sm text-[#666]">
          Szukaj po e-mailu, statusie i dacie wizyty.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label
            htmlFor="admin-orders-search"
            className="mb-2 block text-sm font-medium text-[#1f4d35]"
          >
            🔍 Email
          </label>
          <input
            id="admin-orders-search"
            type="search"
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="np. anna, gmail.com, @wp.pl"
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-[#1f4d35] outline-none transition placeholder:text-[#999] focus:border-[#1f4d35]"
          />
        </div>

        <div>
          <label
            htmlFor="admin-orders-status"
            className="mb-2 block text-sm font-medium text-[#1f4d35]"
          >
            Status
          </label>
          <select
            id="admin-orders-status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-[#1f4d35] outline-none transition focus:border-[#1f4d35]"
          >
            <option value="">Wszystkie</option>
            {ADMIN_ORDER_FILTER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatPaymentStatus(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:contents">
          <div>
            <label
              htmlFor="admin-orders-from"
              className="mb-2 block text-sm font-medium text-[#1f4d35]"
            >
              Data od
            </label>
            <input
              id="admin-orders-from"
              type="date"
              name="from"
              defaultValue={filters.from ?? ""}
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-[#1f4d35] outline-none transition focus:border-[#1f4d35]"
            />
          </div>

          <div>
            <label
              htmlFor="admin-orders-to"
              className="mb-2 block text-sm font-medium text-[#1f4d35]"
            >
              Data do
            </label>
            <input
              id="admin-orders-to"
              type="date"
              name="to"
              defaultValue={filters.to ?? ""}
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-[#1f4d35] outline-none transition focus:border-[#1f4d35]"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="garden-btn px-5 py-3 text-sm font-medium"
        >
          Szukaj
        </button>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-xl border border-border bg-white px-5 py-3 text-sm font-medium text-[#1f4d35] transition hover:bg-[#f6faf7]"
        >
          Wyczyść
        </Link>
      </div>
    </form>
  );
}
