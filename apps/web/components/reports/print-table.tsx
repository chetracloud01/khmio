import type { DataGridColumn } from "@/components/data-grid";

/** A report's table on paper: every row, with the grid's columns and export values, without the grid's buttons. Hidden on screen. */
export function PrintTable<T>({ columns, rows, getRowId }: { columns: DataGridColumn<T>[]; rows: readonly T[]; getRowId: (row: T) => string }) {
  const align = (column: DataGridColumn<T>) => (column.align === "right" ? "py-1 text-right" : "py-1");
  return (
    <table className="hidden w-full text-sm print:table">
      <thead>
        <tr className="border-b border-border text-left">
          {columns.map((column) => (
            <th key={column.key} className={align(column)}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={getRowId(row)} className="border-b border-border">
            {columns.map((column) => (
              <td key={column.key} className={align(column)}>
                {column.exportValue?.(row) ?? column.value?.(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
