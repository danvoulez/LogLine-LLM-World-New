import React from "react";
import { cn } from "@/lib/utils";

interface TableColumn {
  key: string;
  header: string;
  width?: string;
}

interface TableProps {
  columns: TableColumn[];
  data: Record<string, any>[];
  className?: string;
}

export function SafeTable({ columns, data, className }: TableProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 text-sm text-gray-700">
                  {formatCellValue(row[col.key], col.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No data available
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: any, key: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }

  // Status badges
  if (key === "status") {
    const statusColors: Record<string, string> = {
      VIGENTE: "bg-green-100 text-green-800",
      RASCUNHO: "bg-yellow-100 text-yellow-800",
      QUESTIONADO: "bg-orange-100 text-orange-800",
      CONCLUÍDO: "bg-blue-100 text-blue-800",
      CANCELADO: "bg-red-100 text-red-800",
      PENALIZADO: "bg-purple-100 text-purple-800",
    };
    const colorClass = statusColors[value] || "bg-gray-100 text-gray-800";
    return (
      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", colorClass)}>
        {value}
      </span>
    );
  }

  // IDs with monospace
  if (key === "id" || key.includes("_id") || key.includes("ID")) {
    return <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{value}</code>;
  }

  return String(value);
}

