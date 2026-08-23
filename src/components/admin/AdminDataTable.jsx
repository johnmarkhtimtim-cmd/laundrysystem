import { useMemo, useState } from "react";
import { MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import StatusBadge from "./StatusBadge";

const statuses = [
  "Active",
  "Inactive",
  "Paid",
  "Pending",
  "Failed",
  "Scheduled",
  "Assigned",
  "In Progress",
];

export default function AdminDataTable({ config }) {
  const [query, setQuery] = useState("");
  const hasActionColumn = config.columns.some(
    (column) => column.toLowerCase() === "actions",
  );
  const rows = useMemo(
    () =>
      config.rows.filter((row) =>
        row.join(" ").toLowerCase().includes(query.toLowerCase()),
      ),
    [config.rows, query],
  );

  return (
    <section className="portal-card">
      <div className="table-tools">
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${config.title.toLowerCase()}...`}
          />
        </label>
        <button className="light-action" type="button">
          <SlidersHorizontal size={16} />
          Filter
        </button>
      </div>
      <div className="portal-table-wrap">
        <table>
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
              {!hasActionColumn && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((value, cellIndex) => (
                    <td key={cellIndex}>
                      {statuses.includes(value) ? (
                        <StatusBadge value={value} />
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      className="row-action"
                      type="button"
                      aria-label={`Actions for ${row[0]}`}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={config.columns.length + (hasActionColumn ? 0 : 1)}>
                  No {config.title.toLowerCase()} found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
