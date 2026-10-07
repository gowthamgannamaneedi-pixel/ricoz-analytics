import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  Plus, 
  RefreshCw, 
  Search, 
  Trash2, 
  Edit3, 
  Loader2,
  X,
  ChevronRight,
  TrendingUp,
  Percent,
  Package,
  Hash,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Database,
  Code2,
  MoreVertical,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  Info,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MetricModal from '../components/MetricModal';
import MetricDetailsModal from '../components/MetricDetailsModal';
import { Button } from '../components/ui/Button';
import { RefreshButton } from '../components/ui/RefreshButton';
import { API_BASE_URL } from '../services/api';

/**
 * Format currency and metric numbers cleanly
 */
function formatMetricValue(val, type, unit) {
  if (val === null || val === undefined || isNaN(Number(val))) return '—';
  const num = Number(val);
  const isCurrency = type === 'currency' || unit === '₹' || unit === '$';
  const isPercentage = type === 'percentage' || unit === '%';

  if (isCurrency) {
    const symbol = unit === '$' ? '$' : '₹';
    return `${symbol} ${num.toLocaleString()}`;
  }
  if (isPercentage) {
    return `${num}%`;
  }
  if (unit) {
    return `${num.toLocaleString()} ${unit}`;
  }
  return num.toLocaleString();
}

export default function KpisPage() {
  const { token, isViewer, currentRole } = useAuth();

  const [metrics, setMetrics] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [datasetFilter, setDatasetFilter] = useState('all');
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState(null);
  const [detailsMetric, setDetailsMetric] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Delete modal state
  const [metricToDelete, setMetricToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);

  // Action menu dropdown
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const actionMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setOpenActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch metrics & datasets
  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError('');

    try {
      // 1. Fetch real metrics from backend
      const metricRes = await fetch(`${API_BASE_URL}/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (metricRes.ok) {
        const mData = await metricRes.json();
        const list = Array.isArray(mData?.data) ? mData.data : (Array.isArray(mData) ? mData : []);
        setMetrics(list);
      } else {
        const errJson = await metricRes.json().catch(() => null);
        throw new Error(errJson?.message || `Failed to fetch metrics (HTTP ${metricRes.status})`);
      }

      // 2. Fetch datasets for dropdown binding
      const dsRes = await fetch(`${API_BASE_URL}/datasets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (dsRes.ok) {
        const dData = await dsRes.json();
        const dsList = Array.isArray(dData?.data) ? dData.data : (Array.isArray(dData) ? dData : []);
        setDatasets(dsList);
      }
    } catch (err) {
      setError(err?.message || 'Error connecting to KPI analytics service.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData(false);
  };

  const handleCreateNew = () => {
    setEditingMetric(null);
    setIsModalOpen(true);
  };

  const handleEdit = (metric) => {
    setOpenActionMenuId(null);
    setEditingMetric(metric);
    setIsModalOpen(true);
  };

  const handleOpenDetails = (metric) => {
    setOpenActionMenuId(null);
    setDetailsMetric(metric);
    setIsDetailsOpen(true);
  };

  const handleDeleteClick = (metric) => {
    setOpenActionMenuId(null);
    if (isViewer) {
      setError('Viewers do not have permission to delete KPIs.');
      return;
    }
    setMetricToDelete(metric);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!metricToDelete) return;
    const id = metricToDelete.id;
    setIsDeleting(id);
    setDeleteError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/metrics/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete KPI metric.');
      }

      setDeleteSuccess(`Metric "${metricToDelete.name}" deleted successfully.`);
      setMetrics(prev => prev.filter(m => m.id !== id));
      setShowDeleteConfirm(false);
      setMetricToDelete(null);
      await fetchData(false);
      setTimeout(() => setDeleteSuccess(null), 3500);
    } catch (err) {
      setDeleteError(err?.message || 'Failed to delete metric.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleModalSuccess = () => {
    fetchData(false);
  };

  // Status badge helper (Accessible, semantic enterprise indicator)
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'on_track':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 whitespace-nowrap shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>On Track</span>
          </span>
        );
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/90 whitespace-nowrap shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>At Risk</span>
          </span>
        );
      case 'behind':
      case 'critical':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/90 whitespace-nowrap shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>Behind Target</span>
          </span>
        );
    }
  };

  // Get icon by metric type
  const getMetricIcon = (type, unit) => {
    const t = String(type || '').toLowerCase();
    if (t === 'currency' || unit === '₹' || unit === '$') {
      return (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
          <TrendingUp className="h-5 w-5" />
        </div>
      );
    }
    if (t === 'percentage' || unit === '%') {
      return (
        <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 shrink-0">
          <Percent className="h-5 w-5" />
        </div>
      );
    }
    if (t === 'count') {
      return (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 shrink-0">
          <Package className="h-5 w-5" />
        </div>
      );
    }
    if (t === 'decimal') {
      return (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 shrink-0">
          <Hash className="h-5 w-5" />
        </div>
      );
    }
    return (
      <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 shrink-0">
        <Gauge className="h-5 w-5" />
      </div>
    );
  };

  // Dynamically calculated KPI summaries
  const totalCount = metrics.length;
  const onTrackCount = metrics.filter(m => m.status === 'on_track').length;
  const atRiskCount = metrics.filter(m => m.status === 'at_risk').length;
  const behindCount = metrics.filter(m => m.status === 'behind' || m.status === 'critical').length;

  const onTrackPercentage = totalCount > 0 ? Math.round((onTrackCount / totalCount) * 100) : 0;
  const atRiskPercentage = totalCount > 0 ? Math.round((atRiskCount / totalCount) * 100) : 0;
  const behindPercentage = totalCount > 0 ? Math.round((behindCount / totalCount) * 100) : 0;

  // Filtered metrics
  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name?.toLowerCase().includes(q);
        const matchFormula = m.formula?.toLowerCase().includes(q);
        const matchDesc = m.description?.toLowerCase().includes(q);
        const matchDataset = m.dataset_name?.toLowerCase().includes(q);
        if (!matchName && !matchFormula && !matchDesc && !matchDataset) return false;
      }
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'behind') {
          if (m.status !== 'behind' && m.status !== 'critical') return false;
        } else if (m.status !== statusFilter) {
          return false;
        }
      }
      if (datasetFilter !== 'all') {
        if (String(m.dataset_id) !== String(datasetFilter)) return false;
      }
      return true;
    });
  }, [metrics, searchQuery, typeFilter, statusFilter, datasetFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || typeFilter !== 'all' || statusFilter !== 'all' || datasetFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setDatasetFilter('all');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link to="/dashboard" className="hover:text-slate-800 transition">
          RicozAnalytics
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="text-slate-800 font-semibold">KPIs</span>
      </nav>

      {/* 2. Top Header with Icon, Title, Subtitle, and Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3.5">
          {/* Main Rose Header Icon */}
          <div className="h-12 w-12 rounded-2xl bg-rose-600 text-white shadow-xs flex items-center justify-center shrink-0">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Key Performance Indicators
              </h1>
              {currentRole && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                  {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
              Define, customize, and monitor business metrics with targets and performance thresholds.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            id="refresh-kpis-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-rose-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {!isViewer && (
            <button
              onClick={handleCreateNew}
              id="define-metric-header-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Define Metric</span>
            </button>
          )}
        </div>
      </div>

      {/* Viewer Mode Notice */}
      {isViewer && (
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span><strong>View-Only Mode:</strong> Your role ({currentRole}) has read access to metrics and target telemetry. Metric creation, modification, and deletion require Analyst or Admin privileges.</span>
          </span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-700">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Failed to load KPIs</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="px-3 py-1 bg-white border border-rose-200 rounded-lg font-semibold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Success Alerts */}
      {deleteSuccess && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{deleteSuccess}</span>
        </div>
      )}

      {/* 3. Summary KPI Cards (4 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total KPIs */}
        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-2xs ring-1 ring-rose-500/10">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <BarChart3 className="h-5 w-5" />
            </div>
            {totalCount > 0 && (
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 block">Total KPIs</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 block">
              {totalCount}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              All defined metrics
            </p>
          </div>
        </div>

        {/* Card 2: On Track */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            {totalCount > 0 && (
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                {onTrackPercentage}%
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 block">On Track</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 block">
              {onTrackCount}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              Meeting targets
            </p>
          </div>
        </div>

        {/* Card 3: At Risk */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <AlertTriangle className="h-5 w-5" />
            </div>
            {totalCount > 0 && atRiskCount > 0 && (
              <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                {atRiskPercentage}%
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 block">At Risk</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 block">
              {atRiskCount}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              Below target range
            </p>
          </div>
        </div>

        {/* Card 4: Behind Target */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertCircle className="h-5 w-5" />
            </div>
            {totalCount > 0 && behindCount > 0 && (
              <span className="inline-flex items-center text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full">
                {behindPercentage}%
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 block">Behind Target</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 block">
              {behindCount}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              Significantly below target
            </p>
          </div>
        </div>
      </div>

      {/* 4. Search + Filter Controls Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 sm:w-80 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            id="kpis-search-input"
            placeholder="Search KPIs by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-100 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 transition"
              title="Clear search"
              id="clear-kpis-search-btn"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns & View Mode */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric Type */}
          <div className="relative">
            <select
              id="kpis-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by metric type"
              className="appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-3 pr-8 text-xs font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:border-rose-600 focus:outline-none cursor-pointer transition-all"
            >
              <option value="all">All Metric Types</option>
              <option value="currency">Currency (₹)</option>
              <option value="percentage">Percentage (%)</option>
              <option value="count">Count (Volume)</option>
              <option value="decimal">Decimal Number</option>
              <option value="custom">Custom Calculation</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Status */}
          <div className="relative">
            <select
              id="kpis-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by performance status"
              className="appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-3 pr-8 text-xs font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:border-rose-600 focus:outline-none cursor-pointer transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="behind">Behind Target</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Dataset */}
          <div className="relative">
            <select
              id="kpis-dataset-filter"
              value={datasetFilter}
              onChange={(e) => setDatasetFilter(e.target.value)}
              aria-label="Filter by linked dataset"
              className="appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-3 pr-8 text-xs font-medium text-slate-700 hover:bg-slate-100/70 focus:bg-white focus:border-rose-600 focus:outline-none cursor-pointer transition-all max-w-[180px] truncate"
            >
              <option value="all">All Datasets</option>
              {datasets.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              id="reset-kpi-filters-btn"
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1.5 rounded-lg hover:bg-rose-50 transition"
            >
              Reset
            </button>
          )}

          {/* View Mode Toggle (Card View vs Table View) */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-1 ml-auto sm:ml-0">
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'card'
                  ? 'bg-white text-rose-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Card View</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-white text-rose-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table View</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Main KPI Content Area */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-16 flex flex-col items-center justify-center space-y-3 shadow-2xs">
          <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
          <p className="text-xs font-medium text-slate-500">
            Calculating metric telemetry and targets...
          </p>
        </div>
      ) : filteredMetrics.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-16 text-center space-y-3 shadow-2xs">
          {hasActiveFilters ? (
            <div className="space-y-3 max-w-sm mx-auto">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <Search className="h-5 w-5" />
              </div>
              <p className="font-semibold text-slate-800">No matching KPIs found</p>
              <p className="text-slate-500 text-xs">
                No metrics matched "{searchQuery}" with the selected filters.
              </p>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100 transition text-xs"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-w-sm mx-auto">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                <Gauge className="h-6 w-6" />
              </div>
              <p className="font-bold text-slate-900 text-sm">No KPIs defined yet</p>
              <p className="text-slate-500 text-xs">
                Define business metrics and track targets linked to your datasets.
              </p>
              {!isViewer && (
                <button
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Define Metric</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : viewMode === 'card' ? (
        /* Card Grid View (3 Columns on Desktop) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMetrics.map((metric) => {
            const target = Number(metric.target_value);
            const current = Number(metric.current_value);
            const progress = target > 0 ? Number(((current / target) * 100).toFixed(1)) : 100;
            const isMenuOpen = openActionMenuId === metric.id;
            const isAboveTarget = target > 0 && current >= target;

            return (
              <div
                key={metric.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Icon + KPI Name & Description + Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {getMetricIcon(metric.type, metric.unit)}
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => handleOpenDetails(metric)}
                          className="text-left font-bold text-slate-900 hover:text-rose-600 transition truncate block text-sm"
                          title={metric.name}
                        >
                          {metric.name}
                        </button>
                        <p className="text-xs text-slate-500 truncate mt-0.5 font-normal">
                          {metric.description || 'Enterprise metric telemetry'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {renderStatusBadge(metric.status)}
                    </div>
                  </div>

                  {/* Main Metric Value & Target Section (Strongest Visual Element) */}
                  <div className="mt-4">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                        {formatMetricValue(metric.current_value, metric.type, metric.unit)}
                      </span>
                      {target > 0 && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                            isAboveTarget ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isAboveTarget ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )}
                          <span>{Math.abs(Math.round(progress - 100))}%</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 font-normal mt-0.5">
                      {target > 0 ? (
                        <span>Target: {formatMetricValue(metric.target_value, metric.type, metric.unit)}</span>
                      ) : (
                        <span className="text-slate-400">No target defined</span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {target > 0 && (
                    <div className="mt-3.5 flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            metric.status === 'on_track'
                              ? 'bg-emerald-500'
                              : metric.status === 'at_risk'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 shrink-0 font-mono">
                        {progress}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Metadata & Action Bar */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2 text-xs text-slate-500 overflow-hidden">
                    {/* Formula Pill */}
                    <span 
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0 max-w-[140px] truncate" 
                      title={`Formula: ${metric.formula}`}
                    >
                      <Code2 className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{metric.formula}</span>
                    </span>

                    {/* Dataset Pill */}
                    {metric.dataset_name && (
                      <span 
                        className="inline-flex items-center gap-1 text-[11px] text-slate-600 truncate max-w-[120px]" 
                        title={`Dataset: ${metric.dataset_name}`}
                      >
                        <Database className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{metric.dataset_name}</span>
                      </span>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center gap-1 shrink-0 relative" ref={isMenuOpen ? actionMenuRef : null}>
                    {!isViewer && (
                      <>
                        <button
                          onClick={() => handleEdit(metric)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          title="Edit KPI"
                          aria-label={`Edit ${metric.name}`}
                          id={`edit-metric-${metric.id}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteClick(metric)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Delete KPI"
                          aria-label={`Delete ${metric.name}`}
                          id={`delete-metric-${metric.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    {/* More Action Menu Button */}
                    <button
                      onClick={() => setOpenActionMenuId(isMenuOpen ? null : metric.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="More actions"
                      aria-label="More actions"
                      id={`more-menu-metric-${metric.id}`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>

                    {/* Action Dropdown */}
                    {isMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-1.5 w-40 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100 font-sans">
                        <button
                          onClick={() => handleOpenDetails(metric)}
                          className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                        >
                          <Info className="h-3.5 w-3.5 text-slate-500" />
                          <span>View Details</span>
                        </button>

                        {!isViewer && (
                          <>
                            <button
                              onClick={() => handleEdit(metric)}
                              className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                              <span>Edit Metric</span>
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            <button
                              onClick={() => handleDeleteClick(metric)}
                              className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition font-medium"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                              <span>Delete Metric</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Alternative Table View */
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[850px]">
              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">KPI Name</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Current Value</th>
                  <th className="py-3 px-4 font-semibold text-right">Target</th>
                  <th className="py-3 px-4 font-semibold">Progress</th>
                  <th className="py-3 px-4 font-semibold">Dataset</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredMetrics.map((metric) => {
                  const target = Number(metric.target_value);
                  const current = Number(metric.current_value);
                  const progress = target > 0 ? Number(((current / target) * 100).toFixed(1)) : 100;

                  return (
                    <tr key={metric.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOpenDetails(metric)}
                          className="font-bold text-slate-900 hover:text-rose-600 text-left block"
                        >
                          {metric.name}
                        </button>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs font-normal">
                          {metric.description || 'Enterprise metric telemetry'}
                        </p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusBadge(metric.status)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatMetricValue(metric.current_value, metric.type, metric.unit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                        {target > 0 ? formatMetricValue(metric.target_value, metric.type, metric.unit) : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 w-32">
                          <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                metric.status === 'on_track' ? 'bg-emerald-500' : metric.status === 'at_risk' ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-slate-700 font-semibold text-[11px]">{progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 truncate max-w-[140px]">
                        {metric.dataset_name || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDetails(metric)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="View Details"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                          {!isViewer && (
                            <>
                              <button
                                onClick={() => handleEdit(metric)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                title="Edit"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(metric)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Define / Edit Metric Modal */}
      <MetricModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        token={token}
        metricToEdit={editingMetric}
        datasets={datasets}
      />

      {/* Metric Details Modal */}
      <MetricDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setDetailsMetric(null);
        }}
        metric={detailsMetric}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        isViewer={isViewer}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && metricToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs font-sans">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200/90 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete KPI Metric?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This will remove the metric definition and disconnect it from dashboard widgets and reports.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Metric Name:</span>
                <span className="font-semibold text-slate-800">{metricToDelete.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Calculation:</span>
                <span className="font-mono text-slate-700 font-semibold">{metricToDelete.formula}</span>
              </div>
              {metricToDelete.target_value && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Target Value:</span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {formatMetricValue(metricToDelete.target_value, metricToDelete.type, metricToDelete.unit)}
                  </span>
                </div>
              )}
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setMetricToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting !== null}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting !== null}
                id="confirm-delete-kpi-btn"
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition flex items-center gap-1.5 shadow-2xs"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{isDeleting ? 'Deleting...' : 'Delete KPI'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
