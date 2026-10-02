import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  Plus, 
  RefreshCw, 
  Search, 
  Trash2, 
  Edit3, 
  Loader2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MetricModal from '../components/MetricModal';
import { API_BASE_URL } from '../services/api';

const FALLBACK_METRICS = [
  {
    id: 'm1',
    name: 'Total Revenue (Q4)',
    description: 'Total revenue generated across all regional sales channels.',
    formula: 'SUM(sales_amount)',
    type: 'currency',
    unit: '₹',
    target_value: 3500000,
    current_value: 3200000,
    dataset_name: 'Indian Enterprise Sales Telemetry (Q4)',
    status: 'on_track',
    progress_percentage: 91,
    formatting: {
      aggregation_type: 'SUM',
      target_column: 'sales_amount',
      warning_threshold: 2500000,
      critical_threshold: 1500000
    },
    created_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'm2',
    name: 'Average Order Value (AOV)',
    description: 'Average transaction spend per customer order.',
    formula: 'AVG(sales_amount)',
    type: 'currency',
    unit: '₹',
    target_value: 700,
    current_value: 640,
    dataset_name: 'Indian Enterprise Sales Telemetry (Q4)',
    status: 'on_track',
    progress_percentage: 91,
    formatting: {
      aggregation_type: 'AVG',
      target_column: 'sales_amount',
      warning_threshold: 500,
      critical_threshold: 400
    },
    created_at: '2025-01-16T11:00:00Z'
  },
  {
    id: 'm3',
    name: 'Total Units Dispatched',
    description: 'Total quantity of product units sold and fulfilled.',
    formula: 'SUM(units_sold)',
    type: 'count',
    unit: 'units',
    target_value: 15,
    current_value: 11,
    dataset_name: 'Indian Enterprise Sales Telemetry (Q4)',
    status: 'at_risk',
    progress_percentage: 73,
    formatting: {
      aggregation_type: 'SUM',
      target_column: 'units_sold',
      warning_threshold: 12,
      critical_threshold: 8
    },
    created_at: '2025-01-17T12:00:00Z'
  },
  {
    id: 'm4',
    name: 'Gross Margin Percentage',
    description: 'Average profit margin earned across product categories.',
    formula: 'AVG(profit_margin)',
    type: 'percentage',
    unit: '%',
    target_value: 30,
    current_value: 26.5,
    dataset_name: 'Indian Enterprise Sales Telemetry (Q4)',
    status: 'on_track',
    progress_percentage: 88,
    formatting: {
      aggregation_type: 'AVG',
      target_column: 'profit_margin',
      warning_threshold: 20,
      critical_threshold: 15
    },
    created_at: '2025-01-18T14:00:00Z'
  }
];

export default function KpisPage() {
  const { token, isViewer, currentRole } = useAuth();

  const [metrics, setMetrics] = useState(FALLBACK_METRICS);
  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);

  // Fetch metrics & datasets
  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // 1. Fetch metrics
      const metricRes = await fetch(`${API_BASE_URL}/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (metricRes.ok) {
        const mData = await metricRes.json();
        if (mData.data && mData.data.length > 0) {
          setMetrics(mData.data);
        } else {
          setMetrics(FALLBACK_METRICS);
        }
      } else {
        setMetrics(FALLBACK_METRICS);
      }

      // 2. Fetch datasets for dropdown binding
      const dsRes = await fetch(`${API_BASE_URL}/datasets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (dsRes.ok) {
        const dData = await dsRes.json();
        if (dData.data) setDatasets(dData.data);
      }
    } catch (_) {
      setMetrics(FALLBACK_METRICS);
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
    setEditingMetric(metric);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (isViewer) return;
    if (!window.confirm('Are you sure you want to delete this KPI metric?')) return;

    setIsDeleting(id);
    try {
      await fetch(`${API_BASE_URL}/metrics/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMetrics(prev => prev.filter(m => m.id !== id));
    } catch (_) {
      setMetrics(prev => prev.filter(m => m.id !== id));
    } finally {
      setIsDeleting(null);
    }
  };

  const handleModalSuccess = (result) => {
    fetchData(false);
  };

  // Status badge helper (subtle, accessible enterprise indicator)
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'on_track':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>On Track</span>
          </span>
        );
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/90 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>At Risk</span>
          </span>
        );
      case 'behind':
      case 'critical':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>Behind Target</span>
          </span>
        );
    }
  };

  // Format value helper
  const formatValue = (val, type, unit) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '—';
    const num = Number(val);
    if (type === 'currency' || unit === '₹') {
      return `₹${num.toLocaleString()}`;
    }
    if (type === 'percentage' || unit === '%') {
      return `${num}%`;
    }
    return `${num.toLocaleString()} ${unit || ''}`.trim();
  };

  // Filtered metrics
  const filteredMetrics = metrics.filter(m => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name?.toLowerCase().includes(q);
      const matchFormula = m.formula?.toLowerCase().includes(q);
      const matchDesc = m.description?.toLowerCase().includes(q);
      if (!matchName && !matchFormula && !matchDesc) return false;
    }
    if (typeFilter !== 'all' && m.type !== typeFilter) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'behind') {
        if (m.status !== 'behind' && m.status !== 'critical') return false;
      } else if (m.status !== statusFilter) {
        return false;
      }
    }
    return true;
  });

  // Summary counts
  const totalCount = metrics.length;
  const onTrackCount = metrics.filter(m => m.status === 'on_track').length;
  const atRiskCount = metrics.filter(m => m.status === 'at_risk').length;
  const behindCount = metrics.filter(m => m.status === 'behind' || m.status === 'critical').length;

  return (
    <div className="space-y-5 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-0.5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Key Performance Indicators
            </h1>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
              {currentRole ? currentRole.charAt(0).toUpperCase() + currentRole.slice(1) : 'Analyst'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            Define, customize, and monitor business metrics with targets and performance thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-40 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {!isViewer && (
            <button
              onClick={handleCreateNew}
              id="open-create-metric-btn"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>+ Define Metric</span>
            </button>
          )}
        </div>
      </div>

      {/* Viewer Mode Banner */}
      {isViewer && (
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span><strong>View-Only Mode:</strong> Your role ({currentRole}) has read access to metrics and target telemetry. Metric creation, modification, and deletion require Analyst or Admin privileges.</span>
          </span>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-3 sm:gap-y-0">
          {/* Total KPIs */}
          <div className="flex items-center gap-3 sm:pr-4">
            <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 block leading-tight">Total KPIs</span>
              <span className="text-lg font-bold text-slate-900 tracking-tight leading-none mt-0.5 block font-mono">
                {totalCount}
              </span>
            </div>
          </div>

          {/* On Track */}
          <div className="flex items-center gap-3 sm:px-4">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="text-[11px] font-medium text-slate-500">On Track</span>
                {totalCount > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-600">
                    {Math.round((onTrackCount / totalCount) * 100)}%
                  </span>
                )}
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight leading-none mt-0.5 block font-mono">
                {onTrackCount}
              </span>
            </div>
          </div>

          {/* At Risk */}
          <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:px-4">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="text-[11px] font-medium text-slate-500">At Risk</span>
                {totalCount > 0 && (
                  <span className="text-[10px] font-semibold text-amber-600">
                    {Math.round((atRiskCount / totalCount) * 100)}%
                  </span>
                )}
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight leading-none mt-0.5 block font-mono">
                {atRiskCount}
              </span>
            </div>
          </div>

          {/* Behind Target */}
          <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:pl-4">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="text-[11px] font-medium text-slate-500">Behind Target</span>
                {totalCount > 0 && (
                  <span className="text-[10px] font-semibold text-rose-600">
                    {Math.round((behindCount / totalCount) * 100)}%
                  </span>
                )}
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight leading-none mt-0.5 block font-mono">
                {behindCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search KPIs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-7 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none shadow-2xs cursor-pointer"
          >
            <option value="all">All Metric Types</option>
            <option value="currency">Currency (₹)</option>
            <option value="percentage">Percentage (%)</option>
            <option value="count">Count (Volume)</option>
            <option value="decimal">Decimal Number</option>
            <option value="custom">Custom</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none shadow-2xs cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="on_track">On Track</option>
            <option value="at_risk">At Risk</option>
            <option value="behind">Behind Target</option>
          </select>

          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 flex flex-col items-center justify-center space-y-3 shadow-2xs">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="text-xs text-slate-500">
            Loading KPI metrics...
          </p>
        </div>
      ) : filteredMetrics.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center space-y-3 shadow-2xs">
          <Gauge className="h-8 w-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No matching KPI metrics found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search filters or define a new metric formula linked to your datasets.
          </p>
          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setStatusFilter('all');
              }}
              className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium inline-block"
            >
              Reset filters
            </button>
          ) : !isViewer ? (
            <button
              onClick={handleCreateNew}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Define Metric</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {filteredMetrics.map((metric) => {
            const target = Number(metric.target_value);
            const current = Number(metric.current_value);
            const progress = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 100;

            return (
              <div
                key={metric.id}
                className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between h-full"
              >
                <div>
                  {/* 1. KPI Name & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900 truncate" title={metric.name}>
                        {metric.name}
                      </h3>
                      {/* 2. Short Description */}
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {metric.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {renderStatusBadge(metric.status)}
                    </div>
                  </div>

                  {/* 3. Large Current Value & 4. Subtle Target */}
                  <div className="mt-4">
                    <div className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                      {formatValue(metric.current_value, metric.type, metric.unit)}
                    </div>
                    <div className="text-xs text-slate-500 font-normal mt-0.5">
                      {target > 0 ? (
                        <span>Target {formatValue(metric.target_value, metric.type, metric.unit)}</span>
                      ) : (
                        <span className="text-slate-400">No target defined</span>
                      )}
                    </div>
                  </div>

                  {/* 5. Thin Progress Indicator with Percentage */}
                  {target > 0 ? (
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
                  ) : (
                    <div className="mt-3.5 h-1.5" />
                  )}
                </div>

                {/* 6. Formula + Dataset Compact Metadata & 7. Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-1.5 text-xs text-slate-500 overflow-hidden">
                    <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 shrink-0" title={`Formula: ${metric.formula}`}>
                      {metric.formula}
                    </span>
                    {metric.dataset_name && (
                      <span className="truncate text-slate-400 text-[11px]" title={`Dataset: ${metric.dataset_name}`}>
                        {metric.dataset_name}
                      </span>
                    )}
                  </div>

                  {!isViewer && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handleEdit(metric)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        title="Edit Metric"
                        aria-label={`Edit ${metric.name}`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(metric.id)}
                        disabled={isDeleting === metric.id}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                        title="Delete Metric"
                        aria-label={`Delete ${metric.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Metric Modal */}
      <MetricModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        token={token}
        metricToEdit={editingMetric}
        datasets={datasets}
      />
    </div>
  );
}
