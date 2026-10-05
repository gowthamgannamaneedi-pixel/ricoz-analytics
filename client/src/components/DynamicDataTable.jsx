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
  ToggleLeft,
  Loader2,
  Inbox
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

  const formatColumnName = (name) => {
    if (!name) return '';
    const specialMap = {
      order_id: 'Order ID',
      sales_amount: 'Sales Amount',
      units_sold: 'Units Sold',
      tx_id: 'Transaction ID',
      customer_id: 'Customer ID',
      user_id: 'User ID'
    };
    if (specialMap[name.toLowerCase()]) return specialMap[name.toLowerCase()];
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
    <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-md font-sans">
      {/* Table Header / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Transaction Records
            </h3>
            <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
              {totalCount.toLocaleString()} records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Filtered records from active dataset
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-52 sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition shadow-2xs"
            />
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition disabled:opacity-40 shadow-2xs cursor-pointer"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-20 bg-slate-50/90 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center text-[10px] font-mono font-bold uppercase text-slate-400 border-r border-slate-200 bg-slate-50 sticky left-0 z-30">
                #
              </th>
              {columns.map((col) => {
                const isSorted = sortKey === col.name;
                return (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="py-2.5 px-4 text-[11px] font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:text-slate-900 select-none bg-slate-50"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{getTypeBadge(col.type)}</span>
                      <span>{formatColumnName(col.name)}</span>
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
                <td colSpan={columns.length + 1} className="py-16 text-center text-xs text-slate-500 font-sans">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="font-semibold text-slate-700">Loading records...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-16 text-center text-xs text-slate-500 font-sans">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Inbox className="h-8 w-8 text-slate-300" />
                    <span className="font-semibold text-slate-700">No records found</span>
                    <span className="text-[11px] text-slate-400">Try adjusting your filters or search query</span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => {
                const globalRowNumber = (page - 1) * limit + rowIdx + 1;
                return (
                  <tr key={row.id || rowIdx} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="py-3 px-3 text-center text-slate-400 border-r border-slate-100 font-mono text-[10px] bg-slate-50/70 group-hover:bg-blue-50/60 sticky left-0 z-10 select-none">
                      {globalRowNumber}
                    </td>

                    {columns.map((col) => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined;
                      const isBool = typeof val === 'boolean';
                      const isNum = typeof val === 'number';

                      return (
                        <td key={col.name} className="py-3 px-4 whitespace-nowrap text-slate-800">
                          {isNull ? (
                            <span className="text-slate-300 italic font-sans text-[10px]">null</span>
                          ) : isBool ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
          <span className="font-medium text-slate-600">Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-slate-300 bg-white py-1 px-2.5 text-xs font-bold text-slate-800 outline-none shadow-2xs focus:border-blue-600 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span className="text-slate-500 font-mono text-xs ml-1">
            Showing {rows.length > 0 ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, totalCount)} of {totalCount}
          </span>
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-600 font-bold mr-2">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="h-8 w-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center transition shadow-2xs cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="h-8 w-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center transition shadow-2xs cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
