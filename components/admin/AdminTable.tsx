import type { ReactNode } from "react";

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
};

type AdminTableProps<T> = {
  columns: AdminTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
};

export function AdminTable<T>({ columns, rows, getRowKey }: AdminTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-[#f6faf7] text-[#666]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  "whitespace-nowrap px-4 py-3 font-medium",
                  column.className,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-t border-border text-[#1f4d35]"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={[
                    "whitespace-nowrap px-4 py-3 align-middle",
                    column.className,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
