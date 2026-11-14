import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Server,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
  Plus
} from 'lucide-react';
import { Select } from './ui/Select';

/**
 * Format relative time (e.g. 'Updated 2 hours ago')
 */
function formatRelativeTime(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Recently';

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Updated just now';
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Updated ${diffDays}d ago`;
  return `Updated on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/**
 * Format date (e.g. 'Jan 15, 2026')
 */
function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Windowed pagination helper to prevent horizontal row blowout
 */
function getPaginationItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

/**
 * Enterprise Datasets Table Component
 * Matches the reference layout, typography, controls, actions, and pagination
 */
export default function DatasetTable({
  datasets = [],
  onPreview,
  onViewDetails,
  onDelete,
  onRefreshDataset,
  isRefreshingDataset = null,
  isDeleting = null,
  onOpenUploadModal,
  isViewer = false
}) {
  const navigate = useNavigate();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Sorting state
  const [sortKey, setSortKey] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');


  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Active Action Menu (dropdown)
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const actionMenuRef = useRef(null);
  const triggerButtonRefs = useRef({});

  // Close action dropdown on outside click, Escape, or viewport scroll/resize
  useEffect(() => {
    if (!openActionMenuId) return;

    function handleClickOutside(event) {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target) &&
        !triggerButtonRefs.current[openActionMenuId]?.contains(event.target)
      ) {
        setOpenActionMenuId(null);
        setMenuPosition(null);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        const id = openActionMenuId;
        setOpenActionMenuId(null);
        setMenuPosition(null);
        triggerButtonRefs.current[id]?.focus();
      }
    }

    function handleScrollOrResize() {
      setOpenActionMenuId(null);
      setMenuPosition(null);
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openActionMenuId]);

  const handleToggleMenu = (datasetId, event) => {
    event.stopPropagation();
    if (openActionMenuId === datasetId) {
      setOpenActionMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const menuHeight = 160;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;
      setMenuPosition({
        top: openUpwards ? Math.max(10, rect.top - menuHeight - 4) : Math.min(window.innerHeight - menuHeight - 10, rect.bottom + 4),
        right: Math.max(12, window.innerWidth - rect.right)
      });
      setOpenActionMenuId(datasetId);
    }
  };

  // Compute status for a dataset
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

  // Source Icon - Red outline icons inside burgundy badges with red borders (Handoff Page 5)
  const getSourceIcon = (type) => {
    const t = String(type || '').toLowerCase();
    let IconComp = Database;
    if (t === 'csv') IconComp = FileSpreadsheet;
    else if (t === 'json') IconComp = FileCode;
    else if (t === 'postgresql' || t === 'postgres' || t === 'mysql') IconComp = Database;
    else if (t === 'rest_api' || t === 'api') IconComp = Server;

    return (
      <div className="p-2 rounded-xl bg-[#FFF1F3] dark:bg-[#2B0B1B] border border-rose-200 dark:border-[#BE123C] text-[#D91542] dark:text-[#FB7185] shrink-0">
        <IconComp className="h-4 w-4" strokeWidth={1.8} />
      </div>
    );
  };

  // Source Badge Pill
  const renderSourceBadge = (type) => {
    const t = String(type || 'csv').toLowerCase();
    if (t === 'csv') {
      return (
        <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 whitespace-nowrap">
          CSV File
        </span>
      );
    }
    if (t === 'postgresql' || t === 'postgres') {
      return (
        <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 whitespace-nowrap">
          PostgreSQL Database
        </span>
      );
    }
    if (t === 'mysql') {
      return (
        <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200/80 dark:border-sky-800/60 whitespace-nowrap">
          MySQL Database
        </span>
      );
    }
    if (t === 'json') {
      return (
        <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 whitespace-nowrap">
          JSON File
        </span>
      );
    }
    if (t === 'rest_api' || t === 'api') {
      return (
        <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/60 whitespace-nowrap">
          REST API Endpoint
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 whitespace-nowrap">
        {String(type || 'Connector').toUpperCase()}
      </span>
    );
  };

  // Status Badge Pill with Dot
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/90 dark:border-emerald-800/60 whitespace-nowrap shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Ready to Process</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/90 dark:border-amber-800/60 whitespace-nowrap shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Processing Pipeline</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/90 dark:border-rose-800/60 whitespace-nowrap shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>Ingestion Error</span>
          </span>
        );
      case 'empty':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700 whitespace-nowrap shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>No Records</span>
          </span>
        );
    }
  };

  // Handle Sort Toggle
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder(key === 'name' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  // Render Sort Header Indicator
  const renderSortIndicator = (key) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-rose-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-rose-600" />
    );
  };

  // Filter & Sort datasets
  const filteredAndSortedDatasets = useMemo(() => {
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
      result = result.filter(d => {
        const type = String(d?.data_source_type || 'csv').toLowerCase();
        return type === sourceFilter.toLowerCase();
      });
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

        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
    }

    return result;
  }, [datasets, searchQuery, statusFilter, sourceFilter, sortKey, sortOrder]);

  // Pagination calculation
  const totalItems = filteredAndSortedDatasets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Ensure current page is valid when dataset count changes
  const validPage = Math.min(currentPage, totalPages);
  if (validPage !== currentPage && totalPages > 0) {
    setCurrentPage(validPage);
  }

  const startIndex = (validPage - 1) * pageSize;
  const currentPaginatedDatasets = filteredAndSortedDatasets.slice(
    startIndex,
    startIndex + pageSize
  );


  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || sourceFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSourceFilter('all');
    setCurrentPage(1);
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs font-sans transition-colors">
      {/* Table Card Header / Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-t-2xl">
        {/* Left: Datasets count title */}
        <div className="flex items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Available Datasets
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700">
            {datasets.length} {datasets.length === 1 ? 'Dataset' : 'Datasets'}
          </span>
        </div>

        {/* Right: Search + Status filter + Source filter (Responsive toolbar) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Search bar */}
          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              id="datasets-search-input"
              placeholder="Search dataset schema, origin, or name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] pl-9 pr-8 text-xs text-slate-800 dark:text-[#CBD5E1] placeholder-slate-400 dark:placeholder-[#94A3B8] focus:bg-white dark:focus:bg-[#0F172A] focus:border-rose-600 dark:focus:border-[#E11D48] focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/40 focus:outline-hidden transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                title="Clear search"
                id="clear-search-btn"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2.5 w-full sm:w-auto">
            {/* Status Dropdown */}
            <Select
              id="datasets-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter datasets by status"
              className="w-full sm:w-36 md:w-40 shrink-0"
              size="md"
            >
              <option value="all">All Statuses</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="error">Error</option>
              <option value="empty">Empty</option>
            </Select>

            {/* Source Dropdown */}
            <Select
              id="datasets-source-filter"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter datasets by source type"
              className="w-full sm:w-36 md:w-40 shrink-0"
              size="md"
            >
              <option value="all">All Sources</option>
              <option value="csv">CSV File</option>
              <option value="postgresql">PostgreSQL Database</option>
              <option value="json">JSON File</option>
              <option value="rest_api">REST API</option>
            </Select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              id="reset-filters-btn"
              className="h-10 inline-flex items-center justify-center text-xs font-semibold text-rose-600 dark:text-[#FB7185] hover:text-rose-700 dark:hover:text-rose-300 px-3 rounded-xl hover:bg-rose-50 dark:hover:bg-[#2A1422] transition shrink-0 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ─── MOBILE CARD VIEW (< 768px) ─── */}
      <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {currentPaginatedDatasets.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {hasActiveFilters ? (
              <div className="space-y-3 max-w-xs mx-auto">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                  <Search className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">No matching datasets found</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  No datasets matched "{searchQuery}" with the selected filters.
                </p>
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-xs mx-auto">
                <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900">
                  <Table2 className="h-6 w-6" />
                </div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">No datasets available yet</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  Ingest a CSV or connect a database source to create your first analysis-ready table.
                </p>
                {onOpenUploadModal && !isViewer && (
                  <button
                    onClick={onOpenUploadModal}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                    <span>Upload Dataset</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          currentPaginatedDatasets.map((dataset) => {
            const status = getDatasetStatus(dataset);
            const isMenuOpen = openActionMenuId === dataset.id;

            return (
              <div
                key={dataset.id}
                className="p-4 space-y-3 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
              >
                {/* Header: Type icon + Full dataset name + Overflow menu button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shrink-0 mt-0.5">
                      {getSourceIcon(dataset.data_source_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => onPreview && onPreview(dataset.id)}
                        className="text-left font-bold text-slate-900 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 transition text-sm leading-snug break-words block cursor-pointer w-full"
                        title={dataset.name}
                      >
                        {dataset.name}
                      </button>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed break-words">
                        {dataset.description || 'Enterprise analysis dataset'}
                      </p>
                    </div>
                  </div>

                  {/* Overflow Action Trigger */}
                  <div className="relative shrink-0">
                    <button
                      ref={(el) => { triggerButtonRefs.current[dataset.id] = el; }}
                      onClick={(e) => handleToggleMenu(dataset.id, e)}
                      className={`p-2 rounded-xl border transition shadow-2xs cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                        isMenuOpen
                          ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800'
                      }`}
                      title="More actions"
                      aria-label={`More actions for ${dataset.name}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Badge Strip: Source and Status in dedicated area */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {renderSourceBadge(dataset.data_source_type)}
                  {renderStatusBadge(status)}
                </div>

                {/* Stat Grid: Record Count and Column Count */}
                <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
                      Record Count
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5 block">
                      {Number(dataset.row_count || 0).toLocaleString()} records
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider block">
                      Fields / Schema
                    </span>
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs mt-0.5 block">
                      {dataset.column_count || 0} fields
                    </span>
                  </div>
                </div>

                {/* Footer: Last synced / Created date + Action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Updated {formatRelativeTime(dataset.updated_at || dataset.created_at)}</span>
                    <span className="block text-[10px] text-slate-400">Created {formatDate(dataset.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/data-quality?datasetId=${dataset.id}`)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-[#BE123C] bg-[#FFF1F3]/50 dark:bg-[#2B0B1B] text-xs font-semibold text-[#D91542] dark:text-[#FB7185] hover:bg-rose-100 dark:hover:bg-[#3D1026] transition shadow-2xs cursor-pointer min-h-[38px]"
                    >
                      <ShieldCheck className="h-4 w-4 text-[#D91542] dark:text-[#FB7185] shrink-0" strokeWidth={1.8} />
                      <span>Quality</span>
                    </button>
                    <button
                      onClick={() => onPreview && onPreview(dataset.id)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-[#BE123C] bg-[#FFF1F3]/50 dark:bg-[#2B0B1B] text-xs font-semibold text-[#D91542] dark:text-[#FB7185] hover:bg-rose-100 dark:hover:bg-[#3D1026] transition shadow-2xs cursor-pointer min-h-[38px]"
                    >
                      <Eye className="h-4 w-4 text-[#D91542] dark:text-[#FB7185] shrink-0" strokeWidth={1.8} />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── DESKTOP & TABLET TABLE VIEW (>= 768px) ─── */}
      <div className="hidden md:block w-full overflow-x-auto overflow-y-visible">
        <table className="w-full text-left border-collapse text-xs min-w-[860px]">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-[#334155] bg-slate-50/60 dark:bg-[#1E293B] text-slate-600 dark:text-[#CBD5E1]">
              {/* Dataset Name */}
              <th
                onClick={() => handleSort('name')}
                className="py-3 pl-4 sm:pl-5 pr-3 min-w-[240px] font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 select-none group whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Dataset Name</span>
                  {renderSortIndicator('name')}
                </div>
              </th>

              {/* Source Pipeline */}
              <th className="py-3 px-3 min-w-[120px] font-semibold whitespace-nowrap">
                Source Pipeline
              </th>

              {/* Status */}
              <th className="py-3 px-3 min-w-[140px] font-semibold whitespace-nowrap">
                Status
              </th>

              {/* Record Count */}
              <th
                onClick={() => handleSort('row_count')}
                className="py-3 px-3 min-w-[110px] font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 select-none group whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Record Count</span>
                  {renderSortIndicator('row_count')}
                </div>
              </th>

              {/* Fields */}
              <th
                onClick={() => handleSort('column_count')}
                className="py-3 px-3 min-w-[90px] font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 select-none group whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Fields</span>
                  {renderSortIndicator('column_count')}
                </div>
              </th>

              {/* Created / Updated */}
              <th
                onClick={() => handleSort('created_at')}
                className="py-3 px-3 min-w-[140px] font-semibold cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 select-none group whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Created / Updated</span>
                  {renderSortIndicator('created_at')}
                </div>
              </th>

              {/* Actions */}
              <th className="py-3 px-4 min-w-[120px] font-semibold text-right whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {currentPaginatedDatasets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                  {hasActiveFilters ? (
                    <div className="space-y-3 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                        <Search className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">No matching datasets found</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        No datasets matched "{searchQuery}" with the selected filters.
                      </p>
                      <button
                        onClick={resetFilters}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-w-sm mx-auto">
                      <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900">
                        <Table2 className="h-6 w-6" />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">No datasets available yet</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        Ingest a CSV or connect a database source to create your first analysis-ready table.
                      </p>
                      {onOpenUploadModal && !isViewer && (
                        <button
                          onClick={onOpenUploadModal}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs cursor-pointer"
                        >
                          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                          <span>Upload Dataset</span>
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              currentPaginatedDatasets.map((dataset, idx) => {
                const status = getDatasetStatus(dataset);
                const isMenuOpen = openActionMenuId === dataset.id;
                const isNearBottom = idx >= currentPaginatedDatasets.length - 2 || currentPaginatedDatasets.length <= 3;

                return (
                  <tr
                    key={dataset.id}
                    className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/60 group ${
                      isMenuOpen ? 'relative z-30' : ''
                    }`}
                  >
                    {/* Dataset Name & Description */}
                    <td className="py-3 pl-4 sm:pl-5 pr-3 min-w-[240px]">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="shrink-0 mt-0.5">
                          {getSourceIcon(dataset.data_source_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => onPreview && onPreview(dataset.id)}
                            className="text-left font-bold text-slate-900 dark:text-slate-100 hover:text-rose-600 dark:hover:text-rose-400 transition break-words block text-xs sm:text-sm w-full leading-snug cursor-pointer"
                            title={dataset.name}
                          >
                            {dataset.name}
                          </button>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words mt-1 font-normal w-full leading-relaxed" title={dataset.description || 'Enterprise analysis dataset'}>
                            {dataset.description || 'Enterprise analysis dataset'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Source Pipeline */}
                    <td className="py-3 px-3 whitespace-nowrap min-w-[120px]">
                      {renderSourceBadge(dataset.data_source_type)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap min-w-[140px]">
                      {renderStatusBadge(status)}
                    </td>

                    {/* Record Count */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 min-w-[110px]">
                      {Number(dataset.row_count || 0).toLocaleString()} records
                    </td>

                    {/* Fields */}
                    <td className="py-3 px-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400 font-mono min-w-[90px]">
                      {dataset.column_count || 0} fields
                    </td>

                    {/* Created / Updated */}
                    <td className="py-3 px-3 whitespace-nowrap min-w-[140px]">
                      <span className="block text-xs font-medium text-slate-800 dark:text-slate-200">
                        {formatDate(dataset.created_at)}
                      </span>
                      <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatRelativeTime(dataset.updated_at || dataset.created_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap min-w-[120px]">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quality Action Button */}
                        <button
                          onClick={() => navigate(`/data-quality?datasetId=${dataset.id}`)}
                          id={`quality-dataset-${dataset.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-[#BE123C] bg-[#FFF1F3]/50 dark:bg-[#2B0B1B] p-1.5 2xl:px-2.5 2xl:py-1 text-xs font-semibold text-[#D91542] dark:text-[#FB7185] hover:bg-rose-100 dark:hover:bg-[#3D1026] hover:border-rose-300 dark:hover:border-[#E11D48] transition shadow-2xs shrink-0 cursor-pointer"
                          title="View Data Quality profile"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-[#D91542] dark:text-[#FB7185]" strokeWidth={1.8} />
                          <span className="hidden 2xl:inline">Quality</span>
                        </button>

                        {/* Preview Action Button */}
                        <button
                          onClick={() => onPreview && onPreview(dataset.id)}
                          id={`preview-dataset-${dataset.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-[#BE123C] bg-[#FFF1F3]/50 dark:bg-[#2B0B1B] p-1.5 2xl:px-2.5 2xl:py-1 text-xs font-semibold text-[#D91542] dark:text-[#FB7185] hover:bg-rose-100 dark:hover:bg-[#3D1026] hover:border-rose-300 dark:hover:border-[#E11D48] transition shadow-2xs shrink-0 cursor-pointer"
                          title="Preview records and schema"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#D91542] dark:text-[#FB7185]" strokeWidth={1.8} />
                          <span className="hidden 2xl:inline">Preview</span>
                        </button>

                        {/* More Action Menu (...) */}
                        <div className="relative inline-block text-left">
                          <button
                            ref={(el) => { triggerButtonRefs.current[dataset.id] = el; }}
                            onClick={(e) => handleToggleMenu(dataset.id, e)}
                            id={`action-menu-${dataset.id}`}
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            className={`p-1.5 rounded-lg border transition shadow-2xs shrink-0 cursor-pointer ${
                              isMenuOpen
                                ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800'
                            }`}
                            title="More actions"
                            aria-label={`More actions for ${dataset.name}`}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400">
        {/* Left: Showing entries info */}
        <div>
          {totalItems > 0 ? (
            <span>
              Showing <strong className="text-slate-900 dark:text-slate-100">{startIndex + 1}</strong> to{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {Math.min(startIndex + pageSize, totalItems)}
              </strong>{' '}
              of <strong className="text-slate-900 dark:text-slate-100">{totalItems}</strong> {totalItems === 1 ? 'dataset' : 'datasets'}
            </span>
          ) : (
            <span>Showing 0 datasets</span>
          )}
        </div>

        {/* Right: Pagination buttons & page-size selector */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto">
          {/* Page controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={validPage <= 1}
              id="pagination-prev-btn"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page number buttons with windowing */}
            {getPaginationItems(validPage, totalPages).map((item, idx) => {
              if (item === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="h-7 min-w-[28px] px-1 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 select-none"
                  >
                    …
                  </span>
                );
              }
              const pageNum = Number(item);
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  id={`pagination-page-${pageNum}`}
                  className={`h-7 min-w-[28px] px-2 rounded-lg text-xs font-semibold transition ${
                    validPage === pageNum
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={validPage >= totalPages}
              id="pagination-next-btn"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
              Rows per page:
            </span>
            <Select
              id="pagination-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Rows per page"
              className="w-44 sm:w-48"
            >
              <option value={5}>5 rows per page</option>
              <option value={10}>10 rows per page</option>
              <option value={25}>25 rows per page</option>
              <option value={50}>50 rows per page</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Floating Action Menu Portal (escapes all table/card overflow clipping) */}
      {openActionMenuId && menuPosition && typeof document !== 'undefined' && (() => {
        const activeDataset = datasets.find(d => d.id === openActionMenuId);
        if (!activeDataset) return null;
        return createPortal(
          <div
            ref={actionMenuRef}
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
              zIndex: 9999
            }}
            role="menu"
            aria-label={`Actions for ${activeDataset.name}`}
            className="w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 shadow-2xl py-1 text-slate-700 dark:text-slate-200 text-xs text-left animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpenActionMenuId(null);
                setMenuPosition(null);
                if (onViewDetails) onViewDetails(activeDataset);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 flex items-center gap-2 transition cursor-pointer"
            >
              <Info className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>View Details</span>
            </button>

            {!isViewer && onRefreshDataset && (
              <button
                role="menuitem"
                onClick={() => {
                  setOpenActionMenuId(null);
                  setMenuPosition(null);
                  onRefreshDataset(activeDataset.id);
                }}
                disabled={isRefreshingDataset === activeDataset.id}
                className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 flex items-center gap-2 transition disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 ${isRefreshingDataset === activeDataset.id ? 'animate-spin text-rose-600' : ''}`} />
                <span>Refresh & Sync</span>
              </button>
            )}

            <button
              role="menuitem"
              onClick={() => {
                setOpenActionMenuId(null);
                setMenuPosition(null);
                navigate(`/data-quality?datasetId=${activeDataset.id}`);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 flex items-center gap-2 transition cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Data Quality</span>
            </button>

            {!isViewer && onDelete && (
              <>
                <div className="my-1 border-t border-slate-100 dark:border-slate-750" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    setMenuPosition(null);
                    onDelete(activeDataset);
                  }}
                  disabled={isDeleting === activeDataset.id}
                  className="w-full text-left px-3.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-2 transition disabled:opacity-40 font-medium cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                  <span>Delete Dataset</span>
                </button>
              </>
            )}
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
