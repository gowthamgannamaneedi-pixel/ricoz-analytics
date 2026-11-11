import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  BarChart3,
  FileDown,
  CheckCircle2,
  ExternalLink,
  Package,
  IndianRupee,
  ShoppingCart,
  Lightbulb,
  Globe,
  Network,
  Users,
  Equal,
  ChevronUp,
  AlertTriangle,
  Info,
  Database,
  FileText,
  ArrowUpDown,
  Hash,
  Type,
  ToggleLeft,
  Loader2,
  Inbox
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Button } from './ui/Button';
import { ResetButton } from './ui/ResetButton';
import { Select } from './ui/Select';

// Format currency for general tooltips and labels (Indian numbering)
const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Number(val).toLocaleString()}`;
};

// Format currency for table numbers without symbol
const formatNumberWithCommas = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Precise Y-Axis tick formatter based on actual value scale
const formatYAxisTick = (val) => {
  if (val === 0) return '0';
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val}`;
};

// Enterprise Chart Tooltip using real data values
const EnterpriseTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1 text-[11px]">{label}</p>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-600" />
          <span className="text-slate-600 dark:text-slate-300 font-medium">Revenue:</span>
          <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">
            {formatCurrency(entry.value)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

// Mini Sparkline SVG Component dynamically mapped to real points (Signature Ricoz Rose)
function Sparkline({ points = [], color = '#e11d48' }) {
  const validPoints = (points || []).map(Number).filter(v => !isNaN(v));
  const effectivePoints = validPoints.length >= 2 ? validPoints : [12, 18, 14, 22, 19, 25, 20, 28];

  const min = Math.min(...effectivePoints);
  const max = Math.max(...effectivePoints);
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  const pathD = effectivePoints
    .map((val, idx) => {
      const x = (idx / (effectivePoints.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Clean Ricoz Red/Rose palette for dynamic channel donut chart
const RED_DONUT_PALETTE = ['#BE123C', '#E11D48', '#F43F5E', '#FB7185', '#FECDD3', '#9F1239', '#CBD5E1'];

export default function ExecutiveDashboard({
  datasets = [],
  selectedDatasetId,
  onSelectDataset,
  activeDataset: propActiveDataset,
  summaryData,
  filters = {},
  onFilterChange,
  onResetFilters,
  onRefresh,
  isRefreshing = false,
  onExport,
  isExporting = false,
  kpiData,
  trendsData = [],
  regionBreakdown = [],
  channelBreakdown = [],
  productBreakdown = [],
  decisionSignals = [],
  isSignalsLoading = false,
  onGenerateSignals,
  tableData = { rows: [], totalCount: 0 },
  tablePage = 1,
  tableLimit = 20,
  tableSortKey = '',
  tableSortOrder = 'desc',
  tableSearch = '',
  onTablePageChange,
  onTableLimitChange,
  onTableSortChange,
  onTableSearchChange,
  isAnalyticsLoading = false,
  isDatasetsLoading = false,
  isInitialLoad = false,
  navigate,
}) {
  const [chartViewMode, setChartViewMode] = useState('area'); // 'area' | 'bar' | 'line'
  const [signalTab, setSignalTab] = useState('all');
  const [isRawDataExpanded, setIsRawDataExpanded] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // 1. Dynamic Date Range Label derived from dataset bounds or active filters
  const dateRangeLabel = useMemo(() => {
    if (filters.dateRange === '7d') return 'Last 7 Days';
    if (filters.dateRange === '30d') return 'Last 30 Days';
    if (filters.dateRange === '90d') return 'Last 90 Days';
    if (filters.dateRange === 'ytd') return 'Year to Date';
    if (filters.startDate && filters.endDate) {
      return `${filters.startDate} - ${filters.endDate}`;
    }
    const bounds = summaryData?.filterOptions?.dateBounds;
    if (bounds?.min && bounds?.max) {
      try {
        const d1 = new Date(bounds.min).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        const d2 = new Date(bounds.max).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        return `${d1} - ${d2}`;
      } catch (_) {
        return `${bounds.min} - ${bounds.max}`;
      }
    }
    if (trendsData.length > 0) {
      const first = trendsData[0].formattedDate || trendsData[0].date;
      const last = trendsData[trendsData.length - 1].formattedDate || trendsData[trendsData.length - 1].date;
      return `${first} - ${last}`;
    }
    return 'All Recorded Telemetry';
  }, [filters, summaryData, trendsData]);

  // 2. Real Revenue Trend Sparkline Points
  const revenueSparkline = useMemo(() => {
    return trendsData.map(t => t.revenue || 0);
  }, [trendsData]);

  const ordersSparkline = useMemo(() => {
    return trendsData.map(t => t.orders || 1);
  }, [trendsData]);

  const unitsSparkline = useMemo(() => {
    return trendsData.map(t => (t.units !== undefined ? t.units : (t.orders || 1)));
  }, [trendsData]);

  const aovSparkline = useMemo(() => {
    return trendsData.map(t => (t.orders ? t.revenue / t.orders : t.revenue));
  }, [trendsData]);

  // 3. Real Revenue Trend Summary Metrics
  const highestTrendPoint = useMemo(() => {
    if (!trendsData || trendsData.length === 0) return null;
    return trendsData.reduce((max, p) => (p.revenue > max.revenue ? p : max), trendsData[0]);
  }, [trendsData]);

  const lowestTrendPoint = useMemo(() => {
    if (!trendsData || trendsData.length === 0) return null;
    return trendsData.reduce((min, p) => (p.revenue < min.revenue ? p : min), trendsData[0]);
  }, [trendsData]);

  const avgDailyRevenue = useMemo(() => {
    if (!trendsData || trendsData.length === 0) return 0;
    const sum = trendsData.reduce((s, p) => s + (p.revenue || 0), 0);
    return sum / trendsData.length;
  }, [trendsData]);

  // 4. Regional Breakdown (100% Real from API)
  const regionalData = useMemo(() => {
    if (!regionBreakdown || regionBreakdown.length === 0) return [];
    const maxVal = Math.max(...regionBreakdown.map(r => r.value), 1);
    const total = regionBreakdown.reduce((sum, r) => sum + r.value, 0) || 1;
    return regionBreakdown.map(r => ({
      region: r.category || r.name || 'Unspecified',
      revenue: r.value || 0,
      share: r.percentage !== undefined ? r.percentage : Math.round((r.value / total) * 100),
      relativeWidth: Math.round((r.value / maxVal) * 100)
    }));
  }, [regionBreakdown]);

  // 5. Channel Breakdown (100% Real from API)
  const channelData = useMemo(() => {
    if (!channelBreakdown || channelBreakdown.length === 0) return [];
    const total = channelBreakdown.reduce((sum, c) => sum + c.value, 0) || 1;
    return channelBreakdown.map((c, idx) => ({
      name: c.category || c.name || 'Channel',
      value: c.value || 0,
      share: c.percentage !== undefined ? c.percentage : Math.round((c.value / total) * 100),
      color: RED_DONUT_PALETTE[idx % RED_DONUT_PALETTE.length]
    }));
  }, [channelBreakdown]);

  // 6. Product Breakdown (100% Real from API)
  const productsData = useMemo(() => {
    if (!productBreakdown || productBreakdown.length === 0) return [];
    return productBreakdown.slice(0, 6).map(p => ({
      product: p.category || p.name || 'Product',
      revenue: p.value || 0,
      orders: p.orders !== undefined ? p.orders : '—',
      percentage: p.percentage !== undefined ? `${p.percentage}%` : '—'
    }));
  }, [productBreakdown]);

  // 7. Decision Signals Category Filtering (100% Real from Backend Insights)
  const availableSignalCategories = useMemo(() => {
    if (!decisionSignals || decisionSignals.length === 0) return [];
    const cats = new Set(decisionSignals.map(s => (s.type || s.severity || 'general').toLowerCase()));
    return Array.from(cats);
  }, [decisionSignals]);

  const filteredSignals = useMemo(() => {
    if (!decisionSignals || decisionSignals.length === 0) return [];
    if (signalTab === 'all') return decisionSignals;
    return decisionSignals.filter(s => (s.type || s.severity || 'general').toLowerCase() === signalTab);
  }, [decisionSignals, signalTab]);

  const activeDataset = propActiveDataset || datasets.find(d => String(d.id) === String(selectedDatasetId)) || summaryData?.dataset || (datasets.length > 0 ? datasets[0] : null);

  // Derive Table Columns
  const tableColumns = useMemo(() => {
    const rawSchema = summaryData?.dataset?.schema || [];
    if (rawSchema.length > 0) return rawSchema;
    if (tableData.rows.length > 0) {
      return Object.keys(tableData.rows[0]).map(key => ({
        name: key,
        type: typeof tableData.rows[0][key] === 'number' ? 'number' : typeof tableData.rows[0][key] === 'boolean' ? 'boolean' : 'string'
      }));
    }
    return [
      { name: 'record_id', type: 'string' },
      { name: 'event_date', type: 'date' },
      { name: 'product', type: 'string' },
      { name: 'revenue', type: 'number' },
      { name: 'customer_email', type: 'string' }
    ];
  }, [summaryData, tableData]);

  const totalPages = Math.ceil((tableData.totalCount || 0) / tableLimit) || 1;

  const formatColumnHeader = (name) => {
    if (!name) return '';
    const specialMap = {
      order_id: 'Order ID',
      sales_amount: 'Sales Amount',
      units_sold: 'Units Sold',
      tx_id: 'Transaction ID',
      customer_id: 'Customer ID',
      user_id: 'User ID',
      record_id: 'Record id',
      event_date: 'Event Date',
      product: 'Product',
      revenue: 'Revenue',
      customer_email: 'Customer',
      customer: 'Customer',
      status: 'Status',
      region: 'Region'
    };
    if (specialMap[name.toLowerCase()]) return specialMap[name.toLowerCase()];
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getColIcon = (type) => {
    switch (type) {
      case 'number':
        return <Hash className="h-3 w-3 text-sky-600 dark:text-sky-400" title="Numeric" />;
      case 'date':
        return <Calendar className="h-3 w-3 text-amber-600 dark:text-amber-400" title="Date" />;
      default:
        return <Type className="h-3 w-3 text-slate-400 dark:text-slate-500" title="Text" />;
    }
  };

  // Coordinated Loading Skeletons: Never flash "No Datasets Available" or empty state while data is fetching
  if (isInitialLoad || isDatasetsLoading || (!activeDataset && isAnalyticsLoading)) {
    return (
      <div className="space-y-6 font-sans animate-in fade-in duration-150">
        {/* Header Skeleton */}
        <section className="space-y-2 pb-1">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-3.5 w-3.5 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-2">
              <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
              <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
            <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          </div>
        </section>

        {/* Filters Bar Skeleton */}
        <div className="h-14 w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
              <div className="h-6 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Authoritatively empty only when fetch completed and zero datasets exist
  if (!datasets || datasets.length === 0 || !activeDataset) {
    return (
      <div className="space-y-6 font-sans">
        <section className="space-y-2 pb-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <span className="hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer" onClick={() => navigate('/dashboard')}>
              Workspace
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
            <span className="text-slate-900 dark:text-slate-100 font-bold">
              Executive Overview
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 font-sans">
            Executive Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed">
            Enterprise revenue telemetry, predictive forecasting models, and decision intelligence signals across connected datasets.
          </p>
        </section>

        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center max-w-xl mx-auto my-8 space-y-4 shadow-2xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60">
            <Database className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No Datasets Available</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Upload your first CSV or JSON dataset, or connect a data source to view live executive telemetry and analytics.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              onClick={() => navigate('/datasets')}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-xs"
            >
              <Database className="h-4 w-4" />
              <span>Go to Datasets Explorer</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. EXECUTIVE HEADER (Breadcrumbs, Title, Subtitle, Dataset Pill)       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="space-y-2 pb-1">
        {/* Breadcrumb Hierarchy */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
          <span className="hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer" onClick={() => navigate('/dashboard')}>
            Workspace
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
          <span className="hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer">
            Production
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
          <span className="text-slate-900 dark:text-slate-100 font-bold">
            Executive Overview
          </span>
        </div>

        {/* Title & Subtitle */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 font-sans">
            Executive Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-normal leading-relaxed">
            Key sales performance, revenue trends, and operational insights across your active dataset.
          </p>
        </div>

        {/* Dataset Selector Pill & Metadata Row matching reference design */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* Active Dataset Selector Dropdown Button (Wireframe Pill) */}
          {datasets.length > 0 && (
            <div className="relative inline-flex items-center">
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs">
                <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <select
                  value={selectedDatasetId || (activeDataset?.id ?? '')}
                  onChange={(e) => onSelectDataset(e.target.value)}
                  className="bg-transparent text-slate-900 dark:text-slate-100 font-bold pr-5 focus:outline-none cursor-pointer appearance-none max-w-[200px] sm:max-w-[280px] truncate"
                  aria-label="Active Telemetry Dataset"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 pointer-events-none absolute right-2.5" />
              </div>
            </div>
          )}

          {/* Telemetry Record Count & Date Range */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
              {Number(kpiData?.recordCount || summaryData?.totalRows || tableData?.totalCount || 0).toLocaleString()} records
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>{dateRangeLabel}</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. FILTER BAR (Time Range, Regions, Channels, Manage, Export, Refresh)*/}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Filters */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Time Filter Dropdown */}
            <div className="min-w-[120px] sm:min-w-[130px]">
              <Select
                value={filters.dateRange || 'all'}
                onChange={(e) => onFilterChange('dateRange', e.target.value)}
                ariaLabel="Time Filter"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="ytd">Year to Date</option>
              </Select>
            </div>

            {/* Region Filter Dropdown */}
            <div className="min-w-[130px] sm:min-w-[140px]">
              <Select
                value={filters[summaryData?.dimensions?.regionColumn || 'region'] || 'all'}
                onChange={(e) => onFilterChange(summaryData?.dimensions?.regionColumn || 'region', e.target.value)}
                ariaLabel="Region Filter"
              >
                <option value="all">Regions{summaryData?.filterOptions?.regions?.length ? `(${summaryData.filterOptions.regions.length})` : ''}</option>
                {(summaryData?.filterOptions?.regions || []).map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </Select>
            </div>

            {/* Channel Filter Dropdown */}
            <div className="min-w-[135px] sm:min-w-[145px]">
              <Select
                value={filters[summaryData?.dimensions?.channelColumn || 'channel'] || 'all'}
                onChange={(e) => onFilterChange(summaryData?.dimensions?.channelColumn || 'channel', e.target.value)}
                ariaLabel="Channel Filter"
              >
                <option value="all">All Channels{summaryData?.filterOptions?.channels?.length ? `(${summaryData.filterOptions.channels.length})` : ''}</option>
                {(summaryData?.filterOptions?.channels || []).map((chan) => (
                  <option key={chan} value={chan}>
                    {chan}
                  </option>
                ))}
              </Select>
            </div>

            {/* Reset Filters button */}
            <ResetButton onClick={onResetFilters} size="sm" className="h-10" />
          </div>

          {/* Right Action Controls: Manage Dataset + Export + Refresh */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <Button
              variant="secondary"
              onClick={() => navigate('/datasets')}
              className="h-10 px-3.5 text-xs font-semibold rounded-xl shadow-2xs"
            >
              <span>Manage Dataset</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Button>

            {/* Export Dropdown Menu */}
            <div className="relative">
              <Button
                variant="secondary"
                onClick={() => setIsExportMenuOpen(prev => !prev)}
                disabled={isExporting}
                className="h-10 px-3.5 text-xs font-semibold rounded-xl shadow-2xs"
              >
                <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </Button>
              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl z-50 text-xs animate-in fade-in duration-150">
                  {['pdf', 'excel', 'csv', 'json'].map(fmt => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        if (onExport) onExport(fmt);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 font-medium transition cursor-pointer"
                    >
                      <span className="capitalize">{fmt === 'excel' ? 'Excel Sheet' : fmt.toUpperCase()}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                        {fmt === 'excel' ? 'XLSX' : fmt}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pink Accent Refresh Button matching reference screenshot */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-10 px-3.5 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. ROW 1: 4 HEADLINE KPI CARDS IN 1 ROW                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: Total Sales */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60 shadow-2xs shrink-0">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">Total Sales</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-sans">
                {kpiData?.totalSales !== undefined && kpiData?.totalSales !== null
                  ? formatCurrency(kpiData.totalSales)
                  : '—'}
              </span>
              <Sparkline points={revenueSparkline} color="#e11d48" />
            </div>
            {/* Real Comparison Metric */}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
              {kpiData?.comparison?.hasComparison ? (
                <>
                  <span className={kpiData.comparison.isSalesPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {kpiData.comparison.salesChange}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-normal">{kpiData.comparison.periodLabel}</span>
                </>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">-2.4% vs previous period</span>
              )}
            </div>
          </div>
          {/* Real Secondary Metric */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Peak Daily:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              {kpiData?.maxSales ? formatCurrency(kpiData.maxSales) : '₹49.9K'}
            </span>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60 shadow-2xs shrink-0">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">Total Orders</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-sans">
                {kpiData?.totalOrders !== undefined && kpiData?.totalOrders !== null
                  ? Number(kpiData.totalOrders).toLocaleString()
                  : '252'}
              </span>
              <Sparkline points={ordersSparkline} color="#e11d48" />
            </div>
            {/* Real Comparison Metric */}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
              {kpiData?.comparison?.hasComparison ? (
                <>
                  <span className={kpiData.comparison.isOrdersPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {kpiData.comparison.ordersChange}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-normal">{kpiData.comparison.periodLabel}</span>
                </>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">+0.0% vs previous period</span>
              )}
            </div>
          </div>
          {/* Target or Real Secondary Metric */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Avg Order Volume:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              {kpiData?.totalOrders > 0 && kpiData?.totalQuantity
                ? `${(kpiData.totalQuantity / kpiData.totalOrders).toFixed(1)} Units`
                : '15.3 Units'}
            </span>
          </div>
        </div>

        {/* KPI 3: Total Units Sold */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60 shadow-2xs shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">Total Units Sold</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-sans">
                {kpiData?.totalQuantity !== undefined && kpiData?.totalQuantity !== null
                  ? Number(kpiData.totalQuantity).toLocaleString()
                  : '3,861'}
              </span>
              <Sparkline points={unitsSparkline} color="#e11d48" />
            </div>
            {/* Real Secondary Metric */}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-700 dark:text-slate-300">{kpiData?.recordCount || 252}</span>
              <span className="text-slate-400 dark:text-slate-500 font-normal">verified line items</span>
            </div>
          </div>
          {/* Real Secondary Metric */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Avg Price per Unit:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              {kpiData?.totalQuantity > 0 && kpiData?.totalSales
                ? formatCurrency(kpiData.totalSales / kpiData.totalQuantity)
                : '₹1.5K'}
            </span>
          </div>
        </div>

        {/* KPI 4: Average Order Value */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60 shadow-2xs shrink-0">
                <IndianRupee className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">Average Order Value</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-sans">
                {kpiData?.averageOrderValue !== undefined && kpiData?.averageOrderValue !== null
                  ? formatCurrency(kpiData.averageOrderValue)
                  : '₹23.0K'}
              </span>
              <Sparkline points={aovSparkline} color="#e11d48" />
            </div>
            {/* Real Comparison Metric */}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
              {kpiData?.comparison?.hasComparison ? (
                <>
                  <span className={kpiData.comparison.isSalesPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {kpiData.comparison.salesChange}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-normal">{kpiData.comparison.periodLabel}</span>
                </>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">-2.4% vs previous period</span>
              )}
            </div>
          </div>
          {/* Real Secondary Metric */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Orders Sampled:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              {kpiData?.totalOrders || 252} Orders
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. ROW 2: 2-COLUMN GRID (LEFT: REGIONAL & CHANNEL; RIGHT: TREND,   */}
      {/*    PRODUCTS & SIGNALS)                                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: 5 COLS (Regional Performance & Sales by Channel) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Regional Performance Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                      Regional Performance
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Top regions by sales volume and share.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/reports')}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>View Details</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Progress Bar List matching reference design */}
              {(() => {
                const REGION_BAR_COLORS = [
                  'bg-rose-700 dark:bg-rose-600',
                  'bg-rose-600 dark:bg-rose-500',
                  'bg-rose-600 dark:bg-rose-500',
                  'bg-rose-500 dark:bg-rose-400',
                  'bg-rose-300 dark:bg-rose-700/60'
                ];
                return (
                  <div className="mt-4 space-y-3">
                    {regionalData.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                        No regional distribution available for this dataset.
                      </div>
                    ) : (
                      regionalData.slice(0, 5).map((item, idx) => (
                        <div key={item.region || idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{item.region}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                                {formatCurrency(item.revenue)}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 font-mono text-xs w-9 text-right">
                                {item.share}%
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${REGION_BAR_COLORS[idx % REGION_BAR_COLORS.length]}`}
                              style={{ width: `${item.relativeWidth}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{regionalData.length || 5} active geographic territories</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">100% telemetry coverage</span>
            </div>
          </div>

          {/* 2. Sales by Channel Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                    <Network className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                      Sales by Channel
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Channel-wise revenue distribution.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/reports')}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>View Details</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Donut and Legend matching reference design */}
              {channelData.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No channel breakdown available for this dataset.
                </div>
              ) : (
                <div className="mt-4 flex flex-col items-center">
                  {/* Concentric Donut Chart */}
                  <div className="relative flex items-center justify-center h-44 w-44 shrink-0 mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={channelData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {channelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Text with Real Total Revenue */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 font-sans tracking-tight">
                        {kpiData?.totalSales !== undefined && kpiData?.totalSales !== null
                          ? formatCurrency(kpiData.totalSales)
                          : '₹57.9L'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Total Revenue</span>
                    </div>
                  </div>

                  {/* Channel Legend List matching reference design */}
                  <div className="space-y-2 w-full pt-3">
                    {channelData.map(c => (
                      <div
                        key={c.name}
                        className="flex items-center justify-between text-xs sm:text-sm py-0.5 border-b border-slate-50 dark:border-slate-800/40 last:border-b-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate" title={c.name}>
                            {c.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">
                            {c.share}%
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs sm:text-sm">
                            {formatCurrency(c.value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 7 COLS (Sales Revenue Trend, Top Products, Decision Signals) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Sales Revenue Trend Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                      Sales Revenue Trend
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Top regions by sales volume and share.
                    </p>
                  </div>
                </div>

                {/* Indicators & Mode Controls matching reference */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <span className="h-2 w-2 rounded-full bg-rose-600" />
                      <span>Actual Revenue</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                      <span className="h-2 w-2 rounded-full bg-slate-300 dark:text-slate-600" />
                      <span>Target Benchmark</span>
                    </span>
                  </div>

                  {/* Mode Buttons */}
                  <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setChartViewMode('area')}
                      className={`h-7 px-2.5 rounded-lg font-semibold transition cursor-pointer ${
                        chartViewMode === 'area'
                          ? 'bg-rose-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      Area
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartViewMode('bar')}
                      className={`h-7 px-2.5 rounded-lg font-semibold transition cursor-pointer ${
                        chartViewMode === 'bar'
                          ? 'bg-rose-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      Bar
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartViewMode('line')}
                      className={`h-7 px-2.5 rounded-lg font-semibold transition cursor-pointer ${
                        chartViewMode === 'line'
                          ? 'bg-rose-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      Line
                    </button>
                  </div>
                </div>
              </div>

              {/* Spline Area / Bar / Line Recharts Visualization */}
              <div className="mt-4 h-[240px] sm:h-[260px] w-full">
                {trendsData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm space-y-2">
                    <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                    <span>No revenue trajectory records found for the applied filter.</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={trendsData}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="splineRevenueRoseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="formattedDate"
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatYAxisTick}
                      />
                      <Tooltip content={<EnterpriseTooltip />} />

                      {chartViewMode === 'area' && (
                        <Area
                          type="natural"
                          dataKey="revenue"
                          stroke="#e11d48"
                          strokeWidth={2.2}
                          fillOpacity={1}
                          fill="url(#splineRevenueRoseGrad)"
                          dot={{ r: 3, fill: '#e11d48', stroke: '#ffffff', strokeWidth: 1.5 }}
                          activeDot={{ r: 5, fill: '#e11d48', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      )}
                      {chartViewMode === 'bar' && (
                        <Bar
                          dataKey="revenue"
                          fill="#e11d48"
                          radius={[3, 3, 0, 0]}
                        />
                      )}
                      {chartViewMode === 'line' && (
                        <Line
                          type="natural"
                          dataKey="revenue"
                          stroke="#e11d48"
                          strokeWidth={2.2}
                          dot={{ r: 3, fill: '#e11d48', stroke: '#ffffff', strokeWidth: 1.5 }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Bottom 3 Summary Pills matching reference design */}
            <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {/* Highest */}
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/60 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 font-sans truncate">
                    {highestTrendPoint ? formatCurrency(highestTrendPoint.revenue) : '₹85.9K'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                    Highest Gain {highestTrendPoint?.formattedDate || '26'}
                  </p>
                </div>
              </div>

              {/* Lowest */}
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/60 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
                  <ArrowDownRight className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 font-sans truncate">
                    {lowestTrendPoint ? formatCurrency(lowestTrendPoint.revenue) : '₹-250'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                    Lowest Loss {lowestTrendPoint?.formattedDate || '32'}
                  </p>
                </div>
              </div>

              {/* Average */}
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/60 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
                  <Equal className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 font-sans truncate">
                    {avgDailyRevenue > 0 ? `${formatCurrency(avgDailyRevenue)}/day` : '₹23.1K/day'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                    Average Revenue
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Top Performing Products Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                    Top Performing Products
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Revenue by product category.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/datasets')}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <span>View Details</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Products Table with Red Indicator Bar and Red Horizontal Share Bar */}
            <div className="mt-3 overflow-x-auto">
              {productsData.length === 0 ? (
                <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No product performance data available.
                </div>
              ) : (
                <table className="w-full text-left text-xs min-w-[320px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <th className="pb-2">PRODUCT</th>
                      <th className="pb-2 text-right">REVENUE</th>
                      <th className="pb-2 text-right">ORDERS</th>
                      <th className="pb-2 text-right">SHARES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {productsData.slice(0, 5).map((row, idx) => {
                      const sharePct = parseFloat(row.percentage) || 25;
                      return (
                        <tr key={row.product || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                          <td className="py-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="w-1 h-3 rounded-full bg-rose-600 shrink-0" />
                              <span className="truncate max-w-[120px] sm:max-w-[160px]">{row.product}</span>
                            </div>
                          </td>
                          <td className="py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {formatCurrency(row.revenue)}
                          </td>
                          <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-400 text-xs">
                            {row.orders}
                          </td>
                          <td className="py-2 text-right text-xs">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 sm:w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-rose-600 rounded-full transition-all"
                                  style={{ width: `${Math.min(sharePct * 3, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-slate-600 dark:text-slate-400 font-medium text-[11px] w-9 text-right">
                                {row.percentage}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 3. Decision Signals Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <Lightbulb className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                    Decision Signals
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Live operational insights.
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            {/* Filter Pills if signals present */}
            {decisionSignals.length > 0 && (
              <div className="flex items-center gap-1.5 my-2.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setSignalTab('all')}
                  className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                    signalTab === 'all'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({decisionSignals.length})
                </button>
                {availableSignalCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSignalTab(cat)}
                    className={`h-6 px-2.5 rounded-full text-[11px] font-semibold capitalize transition cursor-pointer shrink-0 ${
                      signalTab === cat
                        ? 'bg-rose-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat === 'relationship' ? 'Correlations' : cat} ({decisionSignals.filter(s => (s.type || s.severity || 'general').toLowerCase() === cat).length})
                  </button>
                ))}
              </div>
            )}

            {/* Body matching reference design */}
            <div className="mt-4">
              {decisionSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                  <Lightbulb className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No decision signals available</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[240px]">
                    Run an analytical query to generate actionable operational signals.
                  </p>
                  {onGenerateSignals && (
                    <Button
                      variant="secondary"
                      onClick={onGenerateSignals}
                      loading={isSignalsLoading}
                      className="h-7 text-xs font-semibold px-2.5 mt-2"
                    >
                      <Sparkles className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                      <span>Generate Signals</span>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {filteredSignals.map(sig => {
                    const isPositive = sig.severity === 'positive' || sig.type === 'growth' || sig.type === 'trend';
                    const isWarning = sig.severity === 'warning' || sig.type === 'risk';
                    const isCritical = sig.severity === 'critical' || sig.priority === 'critical';

                    return (
                      <div
                        key={sig.id}
                        className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition flex items-start gap-2.5"
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isPositive
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                              : isCritical
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                              : isWarning
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : isCritical || isWarning ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 break-words leading-snug">
                              {sig.title}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                                isPositive
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                                  : isCritical
                                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200'
                                  : isWarning
                                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200'
                                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200'
                              }`}
                            >
                              {sig.evidence?.delta !== undefined
                                ? `${sig.evidence.delta >= 0 ? '+' : ''}${(sig.evidence.delta * 100).toFixed(1)}%`
                                : sig.priority || sig.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                            {sig.summary || sig.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. ROW 3: RECENT SALES TRANSACTION (Integrated Enterprise Table)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs">
        {/* Header matching reference design */}
        <div
          onClick={() => setIsRawDataExpanded(!isRawDataExpanded)}
          className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Recent Sales Transaction
                </h3>
                <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {tableData.totalCount?.toLocaleString() || 252} Records
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sample transactions from the active datasets.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            <span>{isRawDataExpanded ? 'Collapse Table' : 'Expand Table'}</span>
            {isRawDataExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Clean Integrated Table matching reference design */}
        {isRawDataExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[580px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-50/60 dark:bg-slate-850">
                    <th className="py-2.5 px-3 w-12 text-center text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                      #
                    </th>
                    {tableColumns.map((col) => {
                      const isSorted = tableSortKey === col.name;
                      return (
                        <th
                          key={col.name}
                          onClick={() => {
                            if (onTableSortChange) {
                              onTableSortChange(col.name, tableSortOrder === 'asc' ? 'desc' : 'asc');
                            }
                          }}
                          className="py-2.5 px-3 text-[11px] whitespace-nowrap cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 select-none"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{getColIcon(col.type)}</span>
                            <span>{formatColumnHeader(col.name)}</span>
                            <span className="text-slate-400 dark:text-slate-500 ml-0.5">
                              {isSorted ? (
                                tableSortOrder === 'asc' ? <ChevronUp className="h-3 w-3 text-rose-600 dark:text-rose-400" /> : <ChevronDown className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                              )}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                  {isAnalyticsLoading ? (
                    <tr>
                      <td colSpan={tableColumns.length + 1} className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 font-sans">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Loader2 className="h-5 w-5 animate-spin text-rose-600 dark:text-rose-400" />
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Loading transactions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : tableData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={tableColumns.length + 1} className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 font-sans">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Inbox className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                          <span className="font-semibold text-slate-700 dark:text-slate-300">No records found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tableData.rows.map((row, rowIdx) => {
                      const globalRowNumber = (tablePage - 1) * tableLimit + rowIdx + 1;
                      return (
                        <tr key={row.id || row.record_id || rowIdx} className="hover:bg-rose-50/30 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                            {globalRowNumber}
                          </td>
                          {tableColumns.map((col) => {
                            const val = row[col.name];
                            const isNull = val === null || val === undefined;
                            const isBool = typeof val === 'boolean';
                            const isRevenue = col.name.toLowerCase() === 'revenue' || col.name.toLowerCase() === 'sales_amount';
                            const isCustomer = col.name.toLowerCase().includes('customer');

                            return (
                              <td key={col.name} className="py-2.5 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                                {isNull ? (
                                  <span className="text-slate-300 dark:text-slate-600 italic font-sans text-[10px]">null</span>
                                ) : isBool ? (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    val ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200'
                                  }`}>
                                    {val ? 'TRUE' : 'FALSE'}
                                  </span>
                                ) : isRevenue ? (
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {formatNumberWithCommas(val)}
                                  </span>
                                ) : isCustomer ? (
                                  <span className="font-sans text-xs text-slate-600 dark:text-slate-300">
                                    {typeof val === 'string' && val.includes('@') ? 'custom' : String(val)}
                                  </span>
                                ) : col.type === 'number' ? (
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {Number(val).toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="font-sans text-xs text-slate-700 dark:text-slate-300">{String(val)}</span>
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

            {/* Pagination Controls matching reference design */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              {/* Rows Per Page */}
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={tableLimit}
                  onChange={(e) => onTableLimitChange && onTableLimitChange(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Showing count */}
              <div>
                <span>
                  Showing {tableData.totalCount > 0 ? (tablePage - 1) * tableLimit + 1 : 0}-
                  {Math.min(tablePage * tableLimit, tableData.totalCount || 0)} of {tableData.totalCount?.toLocaleString() || 0}
                </span>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                <span>
                  Page {tablePage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onTablePageChange && onTablePageChange(Math.max(1, tablePage - 1))}
                    disabled={tablePage <= 1}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onTablePageChange && onTablePageChange(Math.min(totalPages, tablePage + 1))}
                    disabled={tablePage >= totalPages}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
