import type { AdminTicketItem } from "@/lib/admin/orders";
import { formatDateTime } from "@/lib/admin/format";
import { AdminTable, type AdminTableColumn } from "@/components/admin/AdminTable";

type TicketsTableProps = {
  tickets: AdminTicketItem[];
};

export function TicketsTable({ tickets }: TicketsTableProps) {
  const columns: AdminTableColumn<AdminTicketItem>[] = [
    {
      key: "code",
      header: "Ticket code",
      cell: (ticket) => (
        <span className="font-mono text-xs sm:text-sm">{ticket.ticket_code}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (ticket) => ticket.status,
    },
    {
      key: "used_at",
      header: "Used at",
      cell: (ticket) => formatDateTime(ticket.used_at),
    },
  ];

  return (
    <AdminTable
      columns={columns}
      rows={tickets}
      getRowKey={(ticket) => ticket.ticket_code}
    />
  );
}
