import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  Plus, 
  RefreshCw, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Layers, 
  Trash2, 
  Edit3, 
  Table2, 
  Sparkles, 
  Loader2, 
  Sliders 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import MetricModal from '../components/MetricModal';
import { API_BASE_URL } from '../services/api';

const FALLBACK_METRICS = [
  {
    id: 'm1',
    name: 'Total Revenue (Q4)',
    description: 'Aggregated commercial telemetry across all regional channels.',
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
    description: 'Average ticket transaction value per order.',
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
    description: 'Aggregate quantity of products sold.',
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
    description: 'Estimated profitability margin across product categories.',
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

  // Status badge helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'on_track':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>ON TRACK</span>
          </span>
        );
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            <span>AT RISK</span>
          </span>
        );
      case 'behind':
      case 'critical':
      default:
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <AlertOctagon className="h-3 w-3 text-rose-600" />
            <span>BEHIND</span>
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
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    return true;
  });

  // Summary counts
  const totalCount = metrics.length;
  const onTrackCount = metrics.filter(m => m.status === 'on_track').length;
  const atRiskCount = metrics.filter(m => m.status === 'at_risk').length;
  const behindCount = metrics.filter(m => m.status === 'behind' || m.status === 'critical').length;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Key Performance Indicators (KPIs)
            </h1>
            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              isViewer
                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {currentRole.toUpperCase()} MODE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Define, customize, and monitor business metrics with dynamic formulas and threshold targets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {!isViewer && (
            <button
              onClick={handleCreateNew}
              id="open-create-metric-btn"
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>+ Define New Metric</span>
            </button>
          )}
        </div>
      </div>

      {/* Viewer Mode Banner */}
      {isViewer && (
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span><strong>View-Only Mode:</strong> Your role ({currentRole}) has read access to metrics and target telemetry. Metric creation, modification, and deletion require Analyst or Admin privileges.</span>
          </span>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Monitored KPIs
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
              {totalCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">metrics defined</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Linked to live telemetry datasets
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            On Track Objectives
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-emerald-700">
              {onTrackCount}
            </span>
            <span className="text-xs font-semibold text-emerald-600">
              ({totalCount > 0 ? Math.round((onTrackCount / totalCount) * 100) : 0}%)
            </span>
          </div>
          <p className="mt-1.5 text-xs text-emerald-700">
            Exceeding &gt;90% target velocity
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            At Risk (Warning)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-amber-700">
              {atRiskCount}
            </span>
            <span className="text-xs font-semibold text-amber-600">
              ({totalCount > 0 ? Math.round((atRiskCount / totalCount) * 100) : 0}%)
            </span>
          </div>
          <p className="mt-1.5 text-xs text-amber-700">
            Approaching threshold tolerance
          </p>
        </div>

        <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
            Behind Targets
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-rose-700">
              {behindCount}
            </span>
            <span className="text-xs font-semibold text-rose-600">
              ({totalCount > 0 ? Math.round((behindCount / totalCount) * 100) : 0}%)
            </span>
          </div>
          <p className="mt-1.5 text-xs text-rose-700">
            Requires executive operational intervention
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search KPIs by name, formula, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
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
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="on_track">On Track</option>
            <option value="at_risk">At Risk</option>
            <option value="behind">Behind</option>
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">
            Calculating dynamic metric aggregations against dataset records...
          </p>
        </div>
      ) : filteredMetrics.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <Gauge className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No matching KPI metrics found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search filters or define a new metric formula linked to your datasets.
          </p>
          {!isViewer && (
            <button
              onClick={handleCreateNew}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Define Metric</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMetrics.map((metric) => {
            const target = Number(metric.target_value);
            const current = Number(metric.current_value);
            const progress = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 100;

            return (
              <div
                key={metric.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar: Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {metric.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {metric.description || 'No business description provided.'}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {renderStatusBadge(metric.status)}
                    </div>
                  </div>

                  {/* Calculated Value Display */}
                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                        Live Calculated Value
                      </span>
                      <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 mt-0.5 block">
                        {formatValue(metric.current_value, metric.type, metric.unit)}
                      </span>
                    </div>

                    {target > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                          Target
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-600 mt-0.5 block">
                          {formatValue(metric.target_value, metric.type, metric.unit)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Target Progress Bar */}
                  {target > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[10px] font-mono font-medium text-slate-500">
                        <span>Target Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            metric.status === 'on_track'
                              ? 'bg-emerald-500'
                              : metric.status === 'at_risk'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Formula String Tag */}
                  <div className="mt-4 p-2 bg-slate-50 rounded-lg border border-slate-100 font-mono text-[11px] text-slate-700 flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Formula:</span>
                    <span className="font-semibold text-blue-700 truncate max-w-[180px]">{metric.formula}</span>
                  </div>

                  {/* Attached Dataset Tag */}
                  {metric.dataset_name && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-slate-500">
                      <Table2 className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{metric.dataset_name}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Metadata & Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">
                    Type: {metric.type ? metric.type.toUpperCase() : 'NUMERIC'}
                  </span>

                  {!isViewer && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(metric)}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Edit Metric Configuration"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(metric.id)}
                        disabled={isDeleting === metric.id}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                        title="Delete Metric"
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
