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
  ShieldCheck,
  X,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Server
} from 'lucide-react';

/**
 * Enterprise Datasets Table Component
 * Answers: “What data can I analyze, what does it contain, and is it ready?”
 * @param {{
 *   datasets: Array<any>,
 *   onPreview: (id: number) => void,
 *   onDelete: (dataset: any) => void,
 *   isDeleting?: number | null,
 *   onOpenUploadModal?: () => void,
 *   isViewer?: boolean
 * }} props
 */
export default function DatasetTable({
  datasets = [],
  onPreview,
  onDelete,
  onRefreshDataset,
  isRefreshingDataset = null,
  isDeleting = null,
  onOpenUploadModal,
  isViewer = false
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
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
      case 'rest_api':
      case 'api':
        return <Server className="h-4 w-4 text-purple-600" />;
      default:
        return <Layers className="h-4 w-4 text-slate-600" />;
    }
  };

  const getSourceBadge = (type) => {
    switch (type) {
      case 'csv':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            CSV
          </span>
        );
      case 'json':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80">
            JSON
          </span>
        );
      case 'postgresql':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80">
            Postgres
          </span>
        );
      case 'rest_api':
      case 'api':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/80">
            REST API
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80">
            {(type || 'Upload').toUpperCase()}
          </span>
        );
    }
  };

  const getDatasetStatus = (dataset) => {
    if (dataset?.status) {
      const s = String(dataset.status).toLowerCase();
      if (s === 'ready' || s === 'active') return 'ready';
      if (s === 'processing' || s === 'syncing' || s === 'pending') return 'processing';
      if (s === 'error' || s === 'failed') return 'error';
      if (s === 'empty') return 'empty';
    }
    if (dataset?.data_source_status === 'error') return 'error';
    if (dataset?.data_source_status === 'pending' || dataset?.data_source_status === 'syncing') return 'processing';
    const rowCount = Number(dataset?.row_count);
    if (isNaN(rowCount) || rowCount === 0) return 'empty';
    return 'ready';
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Ready</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/90 shadow-2xs whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Processing...</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>Error</span>
          </span>
        );
      case 'empty':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200/90 shadow-2xs whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>Empty</span>
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

  const filteredDatasets = React.useMemo(() => {
    let result = Array.isArray(datasets) ? [...datasets] : [];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        (d?.name && String(d.name).toLowerCase().includes(q)) ||
        (d?.description && String(d.description).toLowerCase().includes(q)) ||
        (d?.data_source_name && String(d.data_source_name).toLowerCase().includes(q)) ||
        (d?.data_source_type && String(d.data_source_type).toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(d => getDatasetStatus(d) === statusFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      result = result.filter(d => (d?.data_source_type || 'csv').toLowerCase() === sourceFilter.toLowerCase());
    }

    // Sorting
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a?.[sortKey];
        const valB = b?.[sortKey];

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
  }, [datasets, searchQuery, statusFilter, sourceFilter, sortKey, sortOrder]);

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || sourceFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSourceFilter('all');
  };

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs font-sans">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xs font-bold text-slate-800 tracking-tight">
            Curated Tables for Analysis
          </h2>
          <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
            {filteredDatasets.length} {filteredDatasets.length === 1 ? 'dataset' : 'datasets'}
          </span>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 transition"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 px-2.5 text-xs text-slate-700 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="empty">Empty</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 px-2.5 text-xs text-slate-700 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
          >
            <option value="all">All Sources</option>
            <option value="csv">CSV Files</option>
            <option value="json">JSON Files</option>
            <option value="postgresql">PostgreSQL</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 transition"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[860px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/60">
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Dataset Name</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                Source Pipeline
              </th>

              <th className="py-3 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                Status
              </th>

              <th
                onClick={() => handleSort('row_count')}
                className="py-3 px-4 text-xs font-semibold text-slate-600 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Record Count</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => handleSort('column_count')}
                className="py-3 px-4 text-xs font-semibold text-slate-600 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Fields</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => handleSort('created_at')}
                className="py-3 px-4 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Created / Updated</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3 px-4 text-xs font-semibold text-slate-600 text-right whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredDatasets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                  {hasActiveFilters ? (
                    <div className="space-y-2">
                      <p>No datasets matched your filter criteria.</p>
                      <button
                        onClick={resetFilters}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                      >
                        Reset search & filters
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-sm mx-auto">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Table2 className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-slate-800">No datasets available yet</p>
                      <p className="text-[11px] text-slate-500">
                        Datasets are structured tables created from uploaded or connected Data Sources.
                      </p>
                      {onOpenUploadModal && !isViewer && (
                        <button
                          onClick={onOpenUploadModal}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                        >
                          + Upload Dataset
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredDatasets.map((dataset) => {
                const status = getDatasetStatus(dataset);

                return (
                  <tr key={dataset.id} className="transition-colors hover:bg-slate-50/60 group">
                    {/* Dataset Name (Strongest Visual Element) + Description */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 shrink-0">
                          <Table2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 max-w-md">
                          <span className="block text-sm font-bold text-slate-900 truncate">
                            {dataset.name}
                          </span>
                          {dataset.description ? (
                            <span className="text-xs text-slate-500 font-normal block truncate mt-0.5">
                              {dataset.description}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic block mt-0.5">
                              Structured telemetry dataset
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Data Source */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(dataset.data_source_type)}
                        <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">
                          {dataset.data_source_name || 'Direct Upload'}
                        </span>
                        {getSourceBadge(dataset.data_source_type)}
                      </div>
                    </td>

                    {/* Status Pill */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(status)}
                    </td>

                    {/* Record Count */}
                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-xs font-semibold text-slate-800">
                      {Number(dataset.row_count || 0).toLocaleString()} rows
                    </td>

                    {/* Columns Count */}
                    <td className="py-3 px-4 text-right whitespace-nowrap text-xs text-slate-600">
                      {dataset.column_count || 0} fields
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {dataset.created_at ? new Date(dataset.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/data-quality?datasetId=${dataset.id}`)}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition shadow-2xs"
                          title="View Data Quality & Observability profile"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Quality</span>
                        </button>

                        <button
                          onClick={() => onPreview(dataset.id)}
                          id={`preview-dataset-${dataset.id}`}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition shadow-2xs"
                          title="Preview records and schema"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </button>

                        {!isViewer && onRefreshDataset && (
                          <button
                            onClick={() => onRefreshDataset(dataset.id)}
                            disabled={isRefreshingDataset === dataset.id}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-40"
                            title="Refresh & re-sync dataset ingestion"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshingDataset === dataset.id ? 'animate-spin text-blue-600' : ''}`} />
                            <span>Refresh</span>
                          </button>
                        )}

                        {!isViewer && (
                          <button
                            onClick={() => onDelete(dataset)}
                            disabled={isDeleting === dataset.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                            title="Delete Dataset"
                            aria-label="Delete Dataset"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
