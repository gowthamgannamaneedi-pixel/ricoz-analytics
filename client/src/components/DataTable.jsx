import React, { useState } from 'react';
import { ChevronUp, ChevronDown, MoreHorizontal, ArrowUpDown, ExternalLink, Download } from 'lucide-react';

/**
 * Enterprise Reusable Data Table Component
 * @param {{
 *   columns: Array<{ key: string, label: string, sortable?: boolean, align?: 'left' | 'right' | 'center', render?: (row: any) => React.ReactNode }>,
 *   data: Array<any>,
 *   title?: string,
 *   subtitle?: string,
 *   action?: React.ReactNode,
 *   className?: string
 * }} props
 */
export default function DataTable({
  columns = [],
  data = [],
  title,
  subtitle,
  action,
  className = ''
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const filteredData = React.useMemo(() => {
    let result = [...data];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        Object.values(item).some(val => 
          String(val).toLowerCase().includes(q)
        )
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (typeof valA === 'string') {
          return sortOrder === 'asc' 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }
    return result;
  }, [data, searchQuery, sortKey, sortOrder]);

  return (
    <div className={`rounded-md border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] overflow-hidden shadow-2xs ${className}`}>
      {/* Table Header / Toolbar */}
      {(title || action || subtitle) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5 border-b border-slate-100 dark:border-[#334155]">
          <div>
            {title && (
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-[#F8FAFC]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && (
            <div className="flex items-center gap-2">
              {action}
            </div>
          )}
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#334155] bg-slate-50/80 dark:bg-[#1E293B]">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    className={`py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#CBD5E1] select-none ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${col.sortable !== false ? 'cursor-pointer hover:text-slate-800 dark:hover:text-[#F8FAFC]' : ''}`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span>{col.label}</span>
                      {col.sortable !== false && (
                        <span className="text-slate-400 dark:text-[#94A3B8]">
                          {isSorted ? (
                            <ChevronUp className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#334155] bg-white dark:bg-[#111827]">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-xs text-slate-400 dark:text-[#94A3B8]">
                  No matching telemetry records found.
                </td>
              </tr>
            ) : (
              filteredData.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-[#1E293B]/70 group"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 px-4 text-slate-700 dark:text-[#CBD5E1] ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer / Row Count */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 dark:bg-[#1E293B] border-t border-slate-100 dark:border-[#334155] text-xs text-slate-500 dark:text-[#94A3B8] font-medium">
        <span>Showing {filteredData.length} entries</span>
        <span className="font-mono text-[11px] text-slate-400 dark:text-[#94A3B8]">Live Enterprise Stream</span>
      </div>
    </div>
  );
}
