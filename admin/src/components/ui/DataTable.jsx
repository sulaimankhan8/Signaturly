import { useNavigate } from "react-router-dom";
import { Button, EmptyState, ErrorNote, Skeleton } from "./basics.jsx";
import { count } from "../../lib/format.js";

/**
 * The one table: headings that sort, rows that open, pages, and a line that says so when
 * there is nothing to show. While it loads for the first time it shows grey rows in place;
 * while a later page loads, the rows already there stay, dimmed.
 *
 * columns: [{ key, header, render(row), sort?, align?, className? }]
 * `rowTo(row)` gives the address a row opens. The row's first link is what the keyboard uses;
 * clicking anywhere else in the row goes to the same place.
 */
export default function DataTable({ columns, rows, rowKey = (row) => row.id, rowTo, loading, error, onRetry, empty = "Nothing to show.", sort, order, onSort, label }) {
  const navigate = useNavigate();
  const first = loading && !rows;

  if (error && !rows) return <div className="p-5"><ErrorNote onRetry={onRetry}>{error}</ErrorNote></div>;

  return (
    <div>
      {error && <div className="px-5 pt-4"><ErrorNote onRetry={onRetry}>{error}</ErrorNote></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left" aria-label={label} aria-busy={loading || undefined}>
          <thead>
            <tr className="thead-row">
              {columns.map((column) => {
                const sorted = column.sort && sort === column.sort;
                return (
                  <th key={column.key} scope="col" className={`px-5 py-3 whitespace-nowrap ${column.align === "right" ? "text-right" : ""}`} aria-sort={sorted ? (order === "asc" ? "ascending" : "descending") : undefined}>
                    {column.sort && onSort ? (
                      <button type="button" onClick={() => onSort(column.sort, sorted && order === "desc" ? "asc" : "desc")} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider hover:text-ink ${sorted ? "text-ink" : ""}`}>
                        {column.header}
                        <span aria-hidden="true" className={sorted ? "text-ink" : "text-transparent"}>
                          {order === "asc" ? "↑" : "↓"}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={`divide-y divide-line ${loading && rows ? "opacity-60" : ""}`}>
            {first &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[9rem]" />
                    </td>
                  ))}
                </tr>
              ))}
            {rows?.map((row) => {
              const to = rowTo?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  className={to ? "hover:bg-white/[0.035] cursor-pointer transition-colors" : ""}
                  onClick={
                    to
                      ? (event) => {
                          // A link or button inside the row does its own thing; selecting text is not a click
                          if (event.target.closest("a, button") || window.getSelection()?.toString()) return;
                          navigate(to);
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`px-5 py-3.5 align-top ${column.align === "right" ? "text-right" : ""} ${column.className || ""}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows && rows.length === 0 && !loading && <EmptyState>{empty}</EmptyState>}
    </div>
  );
}

// "1 to 25 of 312", with Previous and Next
export function Pagination({ page, pageSize, total, onPage }) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-line text-sm text-ink-muted" aria-label="Pages">
      <span>
        {count(from)} to {count(to)} of {count(total)}
      </span>
      <span className="flex items-center gap-2">
        <Button size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <span>
          Page {count(page)} of {count(pages)}
        </span>
        <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          Next
        </Button>
      </span>
    </nav>
  );
}
