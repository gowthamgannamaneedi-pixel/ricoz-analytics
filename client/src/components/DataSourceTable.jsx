import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  FileSpreadsheet,
  FileCode,
  Layers,
  Trash2,
  Calendar,
  ExternalLink,
  ArrowUpDown,
  Search,
  X,
  Radio,
  FileCheck,
  Server,
  RefreshCw,
  Loader2
} from 'lucide-react';
import DataSourceStatus from './DataSourceStatus';

/**
 * Enterprise Data Sources Table
 * Answers:
 * - Where does my data come from? (Source Name & Origin)
 * - What is its ingestion/connection status? (Connection Status)
 * - What dataset(s) are produced from this source? (Datasets Produced)
 * - When was it last synced/imported? (Last Sync)
 * @param {{
 *   sources: Array<any>,
 *   onDelete: (id: number) => void,
 *   isDeleting?: number | null,
 *   onOpenAddModal?: () => void,
 *   isViewer?: boolean
 * }} props
 */
export default function DataSourceTable({
  sources = [],
  onDelete,
  onSync,
  isSyncing = null,
  isDeleting = null,
  onOpenAddModal,
  isViewer = false
}) {
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
      case 'rest_api':
      case 'api':
        return <Server className="h-4 w-4 text-purple-600" />;
      default:
        return <Layers className="h-4 w-4 text-slate-600" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'csv':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            CSV File
          </span>
        );
      case 'json':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
            JSON File
          </span>
        );
      case 'postgresql':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
            PostgreSQL DB
          </span>
        );
      case 'rest_api':
      case 'api':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80">
            REST API
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
            {(type || 'SOURCE').toUpperCase()}
          </span>
        );
    }
  };

  const getOriginSummary = (source) => {
    if (source.type === 'postgresql') {
      const host = source.config?.host || 'Cloud Database';
      const database = source.config?.database ? ` · DB: ${source.config.database}` : '';
      return `Host: ${host}${database}`;
    }
    if (source.type === 'rest_api' || source.type === 'api') {
      return source.config?.endpoint_url ? `Endpoint: ${source.config.endpoint_url}` : 'REST API Integration';
    }
    const filename = source.config?.originalFilename || source.config?.filename || 'Uploaded File';
    return `File: ${filename}`;
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
        (s.type && s.type.toLowerCase().includes(q)) ||
        (s.status && s.status.toLowerCase().includes(q)) ||
        (s.config?.host && s.config.host.toLowerCase().includes(q)) ||
        (s.config?.database && s.config.database.toLowerCase().includes(q)) ||
        (s.config?.originalFilename && s.config.originalFilename.toLowerCase().includes(q))
      );
    }

    if (sortKey) {
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? ((valA || 0) - (valB || 0)) : ((valB || 0) - (valA || 0));
      });
    }

    return result;
  }, [sources, searchQuery, sortKey, sortOrder]);

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs font-sans">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xs font-bold text-slate-800 tracking-tight">
            Connected Pipelines & Sources
          </h2>
          <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
            {filteredSources.length} {filteredSources.length === 1 ? 'source' : 'sources'}
          </span>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search sources, origins, or types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-rose-600 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 transition"
              title="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table Body with horizontal scroll for responsiveness */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[820px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/60">
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-4 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Source & Origin</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                Source Type
              </th>

              <th className="py-3 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                Connection Status
              </th>

              <th
                onClick={() => handleSort('dataset_count')}
                className="py-3 px-4 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Datasets Produced</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => handleSort('total_rows')}
                className="py-3 px-4 text-xs font-semibold text-slate-600 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Ingested Records</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => handleSort('created_at')}
                className="py-3 px-4 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Last Sync / Import</span>
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3 px-4 text-xs font-semibold text-slate-600 text-right whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredSources.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                  {searchQuery ? (
                    <div className="space-y-2">
                      <p>No data sources matched your search "{searchQuery}".</p>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-xs font-medium text-rose-600 hover:text-rose-700 underline"
                      >
                        Clear search filter
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-sm mx-auto">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Layers className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-slate-800">No data sources connected yet</p>
                      <p className="text-[11px] text-slate-500">
                        Connect external database pipelines or upload CSV/JSON files to begin ingesting data.
                      </p>
                      {onOpenAddModal && !isViewer && (
                        <button
                          onClick={onOpenAddModal}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
                        >
                          + Connect Data Source
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredSources.map((source) => (
                <tr key={source.id} className="transition-colors hover:bg-slate-50/60 group">
                  {/* Name + Origin */}
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                        {getTypeIcon(source.type)}
                      </div>
                      <div className="min-w-0 max-w-xs">
                        <span className="truncate block text-xs font-semibold text-slate-900">
                          {source.name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-normal block truncate mt-0.5">
                          {getOriginSummary(source)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Type Badge */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {getTypeBadge(source.type)}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <DataSourceStatus status={source.status} />
                  </td>

                  {/* Datasets Produced (Clearly connecting Source to Datasets) */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <Link
                      to="/datasets"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-rose-600 group/link transition-colors"
                      title="View resulting table in Datasets"
                    >
                      <FileCheck className="h-3.5 w-3.5 text-slate-400 group-hover/link:text-rose-500" />
                      <span>{source.dataset_count || 1} {source.dataset_count === 1 ? 'Dataset' : 'Datasets'}</span>
                      <ExternalLink className="h-2.5 w-2.5 opacity-40 group-hover/link:opacity-100" />
                    </Link>
                  </td>

                  {/* Ingested Records */}
                  <td className="py-3 px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                    {typeof source.total_rows === 'number'
                      ? `${source.total_rows.toLocaleString()} rows`
                      : '—'}
                  </td>

                  {/* Connected / Last Synced Timestamp */}
                  <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                    {new Date(source.created_at || Date.now()).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </td>

                  {/* Actions: Sync & Delete */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {!isViewer && (
                      <div className="flex items-center justify-end gap-1">
                        {onSync && (
                          <button
                            onClick={() => onSync(source.id)}
                            disabled={isSyncing === source.id || isDeleting === source.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                            title="Synchronize Data Source"
                            aria-label="Synchronize Data Source"
                          >
                            {isSyncing === source.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to remove data source "${source.name}" and disconnect all associated datasets?`)) {
                              onDelete(source.id);
                            }
                          }}
                          disabled={isDeleting === source.id || isSyncing === source.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                          title="Remove Data Source"
                          aria-label="Remove Data Source"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
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
