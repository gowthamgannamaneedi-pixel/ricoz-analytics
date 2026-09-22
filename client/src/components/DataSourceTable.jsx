import React, { useState } from 'react';
import {
  Database,
  FileSpreadsheet,
  FileCode,
  Layers,
  Trash2,
  Calendar,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search
} from 'lucide-react';
import DataSourceStatus from './DataSourceStatus';

/**
 * Enterprise Data Sources Table
 * @param {{
 *   sources: Array<any>,
 *   onDelete: (id: number) => void,
 *   isDeleting?: number | null
 * }} props
 */
export default function DataSourceTable({ sources = [], onDelete, isDeleting = null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const getTypeIcon = (type) => {
    switch (type) {
      case 'csv':
        return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
      case 'json':
        return <FileCode className="h-4 w-4 text-amber-600" />;
      case 'postgresql':
        return <Database className="h-4 w-4 text-blue-600" />;
      default:
        return <Layers className="h-4 w-4 text-slate-600" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'csv':
        return (
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            CSV
          </span>
        );
      case 'json':
        return (
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            JSON
          </span>
        );
      case 'postgresql':
        return (
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            PostgreSQL
          </span>
        );
      default:
        return (
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            {type.toUpperCase()}
          </span>
        );
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const filteredSources = React.useMemo(() => {
    let result = [...sources];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
      );
    }

    if (sortKey) {
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
      });
    }

    return result;
  }, [sources, searchQuery, sortKey, sortOrder]);

  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-2xs font-sans">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Active Data Sources
          </h3>
          <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {filteredSources.length} sources
          </span>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search data sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-800 select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Source Name</span>
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </div>
              </th>

              <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Type
              </th>

              <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Status
              </th>

              <th
                onClick={() => handleSort('dataset_count')}
                className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right cursor-pointer hover:text-slate-800 select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Datasets</span>
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </div>
              </th>

              <th
                onClick={() => handleSort('total_rows')}
                className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right cursor-pointer hover:text-slate-800 select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Total Rows</span>
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </div>
              </th>

              <th
                onClick={() => handleSort('created_at')}
                className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-800 select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Connected On</span>
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </div>
              </th>

              <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredSources.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                  {searchQuery ? 'No data sources matched your search.' : 'No data sources connected yet. Click "+ Add Data Source" above to begin.'}
                </td>
              </tr>
            ) : (
              filteredSources.map((source) => (
                <tr key={source.id} className="transition-colors hover:bg-slate-50/70 group">
                  {/* Name + Icon */}
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-100 shrink-0">
                        {getTypeIcon(source.type)}
                      </div>
                      <div>
                        <span className="truncate block max-w-xs">{source.name}</span>
                        {source.config?.originalFilename && (
                          <span className="text-[10px] text-slate-400 font-mono font-normal block truncate">
                            {source.config.originalFilename}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Type Badge */}
                  <td className="py-3.5 px-4">
                    {getTypeBadge(source.type)}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    <DataSourceStatus status={source.status} />
                  </td>

                  {/* Datasets Count */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                    {source.dataset_count || 1}
                  </td>

                  {/* Total Ingested Rows */}
                  <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                    {typeof source.total_rows === 'number' ? source.total_rows.toLocaleString() : '—'}
                  </td>

                  {/* Connected Timestamp */}
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {new Date(source.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </td>

                  {/* Delete Action */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete data source "${source.name}" and all associated datasets?`)) {
                          onDelete(source.id);
                        }
                      }}
                      disabled={isDeleting === source.id}
                      className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                      title="Delete Data Source"
                      aria-label="Delete Data Source"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
