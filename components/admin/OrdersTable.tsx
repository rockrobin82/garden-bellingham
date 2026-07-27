import Link from "next/link";

import { formatAmountMinor } from "@/lib/admin/format";
import type { AdminOrderListItem } from "@/lib/admin/orders";
import {
  formatAdminInvoiceLabel,
  getInvoiceIssueStatus,
} from "@/lib/invoices/status";
import { getTicketBreakdown } from "@/lib/orders/ticket-breakdown";
import { formatPaymentStatus } from "@/lib/orders/format-payment-status";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";

type OrdersTableProps = {
  orders: AdminOrderListItem[];
};

export function OrdersTable({ orders }: OrdersTableProps) {
  const columns: AdminTableColumn<AdminOrderListItem>[] = [
    {
      key: "date",
      header: "Date",
      cell: (order) => order.booking_date,
    },
    {
      key: "email",
      header: "Customer email",
      cell: (order) => (
        <span className="max-w-[220px] truncate" title={order.customer_email}>
          {order.customer_email}
        </span>
      ),
    },
    {
      key: "normal",
      header: "Normal tickets",
      cell: (order) => getTicketBreakdown(order).normalQty,
    },
    {
      key: "reduced",
      header: "Reduced tickets",
      cell: (order) => getTicketBreakdown(order).reducedQty,
    },
    {
      key: "total",
      header: "Total tickets",
      cell: (order) => getTicketBreakdown(order).totalQty,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (order) => formatAmountMinor(order.total_amount_minor),
    },
    {
      key: "status",
      header: "Status",
      cell: (order) => formatPaymentStatus(order.payment_status),
    },
    {
      key: "invoice",
      header: "Faktura",
      cell: (order) => {
        const invoice = formatAdminInvoiceLabel(getInvoiceIssueStatus(order));
        return <span title={invoice.title}>{invoice.label}</span>;
      },
    },
    {
      key: "details",
      header: "Details",
      cell: (order) => (
        <Link
          href={`/admin/orders/${order.id}`}
          className="font-medium text-[#1f4d35] underline-offset-4 hover:underline"
        >
          Details
        </Link>
      ),
    },
  ];

  return (
    <AdminTable
      columns={columns}
      rows={orders}
      getRowKey={(order) => order.id}
    />
  );
}
