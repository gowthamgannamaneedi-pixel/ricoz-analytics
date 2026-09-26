import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table2,
  FileSpreadsheet,
  FileCode,
  Database,
  Layers,
  Eye,
  Trash2,
  Search,
  ArrowUpDown,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  ShieldCheck
} from 'lucide-react';

/**
 * Enterprise Datasets Table Component
 * @param {{
 *   datasets: Array<any>,
 *   onPreview: (id: number) => void,
 *   onDelete: (id: number) => void,
 *   isDeleting?: number | null
 * }} props
 */
export default function DatasetTable({
  datasets = [],
  onPreview,
  onDelete,
  isDeleting = null
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const getSourceIcon = (type) => {
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

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const filteredDatasets = React.useMemo(() => {
    let result = Array.isArray(datasets) ? [...datasets] : [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        (d?.name && String(d.name).toLowerCase().includes(q)) ||
        (d?.description && String(d.description).toLowerCase().includes(q)) ||
        (d?.data_source_name && String(d.data_source_name).toLowerCase().includes(q))
      );
    }

    if (sortKey) {
      result.sort((a, b) => {
        const valA = a?.[sortKey];
        const valB = b?.[sortKey];

        // Handle null / undefined safely without throwing
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (typeof valA === 'string' || typeof valB === 'string') {
          const strA = String(valA ?? '');
          const strB = String(valB ?? '');
          return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
        return sortOrder === 'asc'
          ? (Number(valA) || 0) - (Number(valB) || 0)
          : (Number(valB) || 0) - (Number(valA) || 0);
      });
    }

    return result;
  }, [datasets, searchQuery, sortKey, sortOrder]);

  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-2xs font-sans">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Available Datasets
          </h3>
          <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {filteredDatasets.length} datasets
          </span>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search datasets by name or source..."
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
                  <span>Dataset Name</span>
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </div>
              </th>

              <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Data Source
              </th>

              <th
                onClick={() => handleSort('row_count')}
                className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right cursor-pointer hover:text-slate-800 select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Records</span>
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </div>
              </th>

              <th
                onClick={() => handleSort('column_count')}
                className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right cursor-pointer hover:text-slate-800 select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Columns</span>
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </div>
              </th>

              <th
                onClick={() => handleSort('created_at')}
                className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-800 select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Created Date</span>
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </div>
              </th>

              <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredDatasets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                  {searchQuery ? 'No datasets matched your search.' : 'No datasets created yet. Ingest a data source to generate your first dataset.'}
                </td>
              </tr>
            ) : (
              filteredDatasets.map((dataset) => (
                <tr key={dataset.id} className="transition-colors hover:bg-slate-50/70 group">
                  {/* Name + Description */}
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-blue-50 border border-blue-100 text-blue-700 shrink-0">
                        <Table2 className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="truncate block max-w-xs">{dataset.name}</span>
                        {dataset.description && (
                          <span className="text-[10px] text-slate-400 font-normal block truncate">
                            {dataset.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Parent Source */}
                  <td className="py-3.5 px-4 text-slate-700">
                    <div className="flex items-center gap-1.5">
                      {getSourceIcon(dataset.data_source_type)}
                      <span className="font-medium truncate max-w-[140px]">
                        {dataset.data_source_name || 'Direct Ingestion'}
                      </span>
                    </div>
                  </td>

                  {/* Row Count */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {Number(dataset.row_count || 0).toLocaleString()}
                  </td>

                  {/* Column Count */}
                  <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                    {dataset.column_count || 0} cols
                  </td>

                  {/* Created Date */}
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {dataset.created_at ? new Date(dataset.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }) : '—'}
                  </td>

                  {/* Actions: Preview & Delete */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => navigate(`/data-quality?datasetId=${dataset.id}`)}
                        className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition"
                        title="View Data Quality & Observability profile"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Quality</span>
                      </button>

                      <button
                        onClick={() => onPreview(dataset.id)}
                        id={`preview-dataset-${dataset.id}`}
                        className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition"
                        title="Preview first 50 rows"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={() => onDelete(dataset)}
                        disabled={isDeleting === dataset.id}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                        title="Delete Dataset"
                        aria-label="Delete Dataset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
