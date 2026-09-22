import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Hash,
  Type,
  Calendar,
  ToggleLeft
} from 'lucide-react';

/**
 * Enterprise Dynamic Paginated Data Table for Dashboard
 * @param {{
 *   columns: Array<{ name: string, type: string }>,
 *   rows: Array<any>,
 *   totalCount: number,
 *   page: number,
 *   limit: number,
 *   onPageChange: (newPage: number) => void,
 *   onLimitChange: (newLimit: number) => void,
 *   onSortChange: (key: string, order: 'asc' | 'desc') => void,
 *   onSearchChange: (search: string) => void,
 *   sortKey?: string,
 *   sortOrder?: 'asc' | 'desc',
 *   searchQuery?: string,
 *   isLoading?: boolean,
 *   datasetName?: string
 * }} props
 */
export default function DynamicDataTable({
  columns = [],
  rows = [],
  totalCount = 0,
  page = 1,
  limit = 20,
  onPageChange,
  onLimitChange,
  onSortChange,
  onSearchChange,
  sortKey,
  sortOrder = 'desc',
  searchQuery = '',
  isLoading = false,
  datasetName = 'Dataset'
}) {
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const handleSort = (columnName) => {
    if (sortKey === columnName) {
      onSortChange(columnName, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(columnName, 'desc');
    }
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const headerRow = columns.map(c => c.name);
    const csvLines = [
      headerRow.join(','),
      ...rows.map(row =>
        headerRow.map(h => {
          const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${datasetName}_filtered_page_${page}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'number':
        return <Hash className="h-3 w-3 text-sky-600" title="Numeric field" />;
      case 'boolean':
        return <ToggleLeft className="h-3 w-3 text-purple-600" title="Boolean field" />;
      case 'date':
        return <Calendar className="h-3 w-3 text-amber-600" title="Date field" />;
      default:
        return <Type className="h-3 w-3 text-slate-400" title="Text field" />;
    }
  };

  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-2xs font-sans">
      {/* Table Header / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Dataset Telemetry Records
            </h3>
            <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              {totalCount.toLocaleString()} matching records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time filtered rows from active dataset
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search table rows..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export Page</span>
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-2xs">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center text-[10px] font-mono font-bold uppercase text-slate-400 border-r border-slate-200 bg-slate-100 sticky left-0 z-30">
                #
              </th>
              {columns.map((col) => {
                const isSorted = sortKey === col.name;
                return (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap cursor-pointer hover:text-slate-900 select-none bg-slate-100"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{getTypeBadge(col.type)}</span>
                      <span>{col.name}</span>
                      <span className="text-slate-400 ml-1">
                        {isSorted ? (
                          sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-blue-600" /> : <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center text-xs text-slate-400 font-sans">
                  Calculating records...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center text-xs text-slate-400 font-sans">
                  No records match current filter criteria.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const globalRowNumber = (page - 1) * limit + rowIdx + 1;
                return (
                  <tr key={row.id || rowIdx} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="py-2.5 px-3 text-center text-slate-400 border-r border-slate-100 font-mono text-[10px] bg-slate-50/70 group-hover:bg-blue-50/60 sticky left-0 z-10 select-none">
                      {globalRowNumber}
                    </td>

                    {columns.map((col) => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined;
                      const isBool = typeof val === 'boolean';
                      const isNum = typeof val === 'number';

                      return (
                        <td key={col.name} className="py-2.5 px-4 whitespace-nowrap text-slate-800">
                          {isNull ? (
                            <span className="text-slate-300 italic font-sans text-[10px]">null</span>
                          ) : isBool ? (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              val ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {val ? 'TRUE' : 'FALSE'}
                            </span>
                          ) : isNum ? (
                            <span className="font-semibold text-slate-900">{val.toLocaleString()}</span>
                          ) : (
                            <span className="font-sans text-xs">{String(val)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="rounded border border-slate-200 bg-white py-1 px-2 text-xs font-semibold text-slate-800 outline-none"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span className="text-slate-400 font-mono">
            Showing {rows.length > 0 ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, totalCount)} of {totalCount}
          </span>
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-600 font-semibold mr-2">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white transition"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white transition"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
