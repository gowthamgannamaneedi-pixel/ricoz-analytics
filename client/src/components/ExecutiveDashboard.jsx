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
  Database
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
import DynamicFilterBar from './DynamicFilterBar';
import DynamicDataTable from './DynamicDataTable';
import { Button } from './ui/Button';

// Format currency for general tooltips and labels (Indian numbering)
const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Number(val).toLocaleString()}`;
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
          <span className="h-2 w-2 rounded-full bg-blue-600" />
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

// Mini Sparkline SVG Component dynamically mapped to real points
function Sparkline({ points = [], color = '#2563EB' }) {
  if (!points || points.length < 2) return null;

  const validPoints = points.map(Number).filter(v => !isNaN(v));
  if (validPoints.length < 2) return null;

  const min = Math.min(...validPoints);
  const max = Math.max(...validPoints);
  const range = max - min || 1;
  const width = 85;
  const height = 26;
  const pathD = validPoints
    .map((val, idx) => {
      const x = (idx / (validPoints.length - 1)) * width;
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
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Clean categorical palette for dynamic channels
const DYNAMIC_PALETTE = ['#2563eb', '#059669', '#d97706', '#8b5cf6', '#ec4899', '#0891b2', '#64748b'];

export default function ExecutiveDashboard({
  datasets = [],
  selectedDatasetId,
  onSelectDataset,
  activeDataset,
  summaryData,
  filters = {},
  onFilterChange,
  onResetFilters,
  onRefresh,
  isRefreshing = false,
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
  navigate,
}) {
  const [chartViewMode, setChartViewMode] = useState('area'); // 'area' | 'bar' | 'line'
  const [signalTab, setSignalTab] = useState('all');
  const [isRawDataExpanded, setIsRawDataExpanded] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
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
      color: DYNAMIC_PALETTE[idx % DYNAMIC_PALETTE.length]
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

  return (
    <div className="space-y-6 font-sans">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. EXECUTIVE HEADER (Breadcrumb, Telemetry Context, Dataset Pill)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="space-y-2 pb-1">
        {/* Breadcrumb Hierarchy */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
          <span className="hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer" onClick={() => navigate('/dashboard')}>
            Workspace
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
          <span className="hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer">
            Production
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
          <span className="text-slate-900 dark:text-slate-100 font-bold">
            Overview
          </span>
        </div>

        {/* Title & Telemetry Metadata Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 font-sans">
              Overview
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{activeDataset?.name || 'Product Inventory & Logistics'}</span>
              <span className="mx-2 text-slate-300 dark:text-slate-700">|</span>
              <span>Telemetry {dateRangeLabel}</span>
              <span className="mx-2 text-slate-300 dark:text-slate-700">|</span>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{Number(kpiData?.recordCount || summaryData?.totalRows || tableData?.totalCount || 0).toLocaleString()} records</span>
            </p>
          </div>

          {/* Active Dataset Selector Dropdown Button (Wireframe Pill) */}
          <div className="flex items-center gap-3 shrink-0">
            {datasets.length > 0 && (
              <div className="relative">
                <select
                  value={selectedDatasetId || (activeDataset?.id ?? '')}
                  onChange={(e) => onSelectDataset(Number(e.target.value))}
                  aria-label="Active Telemetry Dataset"
                  className="appearance-none pl-9 pr-9 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden focus:border-blue-500 shadow-2xs cursor-pointer transition"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id} className="dark:bg-slate-800 dark:text-slate-100">
                      {d.name}
                    </option>
                  ))}
                </select>
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. FILTER BAR (Time Range, Regions, Channels, Manage Dataset, Refresh) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          {/* Left Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Time Filter Dropdown */}
            <div className="relative">
              <select
                value={filters.dateRange || 'all'}
                onChange={(e) => onFilterChange('dateRange', e.target.value)}
                aria-label="Time Filter"
                className="appearance-none pl-8 pr-8 h-9.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden focus:border-blue-500 shadow-2xs cursor-pointer transition"
              >
                <option value="all" className="dark:bg-slate-800">All Time</option>
                <option value="7d" className="dark:bg-slate-800">Last 7 Days</option>
                <option value="30d" className="dark:bg-slate-800">Last 30 Days</option>
                <option value="90d" className="dark:bg-slate-800">Last 90 Days</option>
                <option value="ytd" className="dark:bg-slate-800">Year to Date</option>
              </select>
              <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Region Filter Dropdown */}
            <div className="relative">
              <select
                value={filters[summaryData?.dimensions?.regionColumn || 'region'] || 'all'}
                onChange={(e) => onFilterChange(summaryData?.dimensions?.regionColumn || 'region', e.target.value)}
                aria-label="Region Filter"
                className="appearance-none pl-8 pr-8 h-9.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden focus:border-blue-500 shadow-2xs cursor-pointer transition"
              >
                <option value="all" className="dark:bg-slate-800">Regions{summaryData?.filterOptions?.regions?.length ? ` (${summaryData.filterOptions.regions.length})` : ''}</option>
                {(summaryData?.filterOptions?.regions || []).map((reg) => (
                  <option key={reg} value={reg} className="dark:bg-slate-800">
                    {reg}
                  </option>
                ))}
              </select>
              <Globe className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Channel Filter Dropdown */}
            <div className="relative">
              <select
                value={filters[summaryData?.dimensions?.channelColumn || 'channel'] || 'all'}
                onChange={(e) => onFilterChange(summaryData?.dimensions?.channelColumn || 'channel', e.target.value)}
                aria-label="Channel Filter"
                className="appearance-none pl-8 pr-8 h-9.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden focus:border-blue-500 shadow-2xs cursor-pointer transition"
              >
                <option value="all" className="dark:bg-slate-800">All Channels{summaryData?.filterOptions?.channels?.length ? ` (${summaryData.filterOptions.channels.length})` : ''}</option>
                {(summaryData?.filterOptions?.channels || []).map((chan) => (
                  <option key={chan} value={chan} className="dark:bg-slate-800">
                    {chan}
                  </option>
                ))}
              </select>
              <Network className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Filters button */}
            <button
              type="button"
              onClick={onResetFilters}
              title="Reset Filters"
              className="flex items-center gap-1.5 h-9.5 px-3 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Right Action Controls: Manage Dataset + Refresh */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="secondary"
              onClick={() => navigate('/datasets')}
              className="h-9.5 px-3.5 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
            >
              <Database className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>Manage Dataset</span>
            </Button>

            <Button
              variant="secondary"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9.5 px-3.5 text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
            >
              <RotateCcw className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 ${isRefreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. TOP ANALYTICS: 2x2 HEADLINE KPIS + REGIONAL PERFORMANCE          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left 7 Cols: 2x2 Grid of Headline KPI Cards */}
        <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* KPI 1: Total Sales */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-blue-200 dark:hover:border-blue-800/60 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <BarChart3 className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Sales</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-sans">
                  {kpiData?.totalSales !== undefined && kpiData?.totalSales !== null
                    ? formatCurrency(kpiData.totalSales)
                    : '—'}
                </span>
                <Sparkline points={revenueSparkline} color="#2563EB" />
              </div>
              {/* Real Comparison Metric */}
              <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-semibold">
                {kpiData?.comparison?.hasComparison ? (
                  <>
                    <span className={kpiData.comparison.isSalesPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {kpiData.comparison.salesChange}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">{kpiData.comparison.periodLabel}</span>
                  </>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-normal">Active baseline period</span>
                )}
              </div>
            </div>
            {/* Real Secondary Metric */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              {kpiData?.target ? (
                <>
                  <span>Target {formatCurrency(kpiData.target)}</span>
                  <div className="flex items-center gap-2 flex-1 max-w-[90px] mx-2">
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.min(Math.round((kpiData.totalSales / kpiData.target) * 100), 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {Math.round((kpiData.totalSales / kpiData.target) * 100)}%
                  </span>
                </>
              ) : (
                <>
                  <span>Peak Daily:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {kpiData?.maxSales ? formatCurrency(kpiData.maxSales) : '—'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* KPI 2: Total Orders */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-emerald-200 dark:hover:border-emerald-800/60 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <ShoppingCart className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Orders</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-sans">
                  {kpiData?.totalOrders !== undefined && kpiData?.totalOrders !== null
                    ? Number(kpiData.totalOrders).toLocaleString()
                    : '—'}
                </span>
                <Sparkline points={ordersSparkline} color="#059669" />
              </div>
              {/* Real Comparison Metric */}
              <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-semibold">
                {kpiData?.comparison?.hasComparison ? (
                  <>
                    <span className={kpiData.comparison.isOrdersPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {kpiData.comparison.ordersChange}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">{kpiData.comparison.periodLabel}</span>
                  </>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-normal">Active baseline period</span>
                )}
              </div>
            </div>
            {/* Target or Real Secondary Metric */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              <span>Avg Order Volume:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                {kpiData?.totalOrders > 0
                  ? `${(kpiData.totalQuantity / kpiData.totalOrders).toFixed(1)} units`
                  : '—'}
              </span>
            </div>
          </div>

          {/* KPI 3: Total Unit Sold */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-amber-200 dark:hover:border-amber-800/60 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Package className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Unit Sold</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-sans">
                  {kpiData?.totalQuantity !== undefined && kpiData?.totalQuantity !== null
                    ? Number(kpiData.totalQuantity).toLocaleString()
                    : '—'}
                </span>
                <Sparkline points={unitsSparkline} color="#d97706" />
              </div>
              {/* Real Secondary Metric */}
              <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-300">{kpiData?.recordCount || 0}</span>
                <span className="text-slate-400 dark:text-slate-500 font-normal">verified line items</span>
              </div>
            </div>
            {/* Real Secondary Metric */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              <span>Avg Unit Realization:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                {kpiData?.totalQuantity > 0
                  ? formatCurrency(kpiData.totalSales / kpiData.totalQuantity)
                  : '—'}
              </span>
            </div>
          </div>

          {/* KPI 4: Average Order Value */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-purple-200 dark:hover:border-purple-800/60 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                  <IndianRupee className="h-4.5 w-4.5" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Average Order Value</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-sans">
                  {kpiData?.averageOrderValue !== undefined && kpiData?.averageOrderValue !== null
                    ? formatCurrency(kpiData.averageOrderValue)
                    : '—'}
                </span>
                <Sparkline points={aovSparkline} color="#7c3aed" />
              </div>
              {/* Real Comparison Metric */}
              <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-semibold">
                {kpiData?.comparison?.hasComparison ? (
                  <>
                    <span className={kpiData.comparison.isSalesPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {kpiData.comparison.salesChange}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal">{kpiData.comparison.periodLabel}</span>
                  </>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-normal">Dataset benchmark</span>
                )}
              </div>
            </div>
            {/* Real Secondary Metric */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              <span>Orders Sampled:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                {kpiData?.totalOrders || 0} orders
              </span>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Regional Performance Card (Wireframe Placement) */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <Globe className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
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

            {/* Horizontal Bar Chart List with Real Data — per-region accent colors */}
            {(() => {
              const REGION_COLORS = [
                'bg-rose-600   dark:bg-rose-500',    // 1st — Ricoz Red (primary/brand)
                'bg-blue-600   dark:bg-blue-500',    // 2nd — Blue
                'bg-amber-500  dark:bg-amber-400',   // 3rd — Amber/Orange
                'bg-violet-600 dark:bg-violet-500',  // 4th — Purple
                'bg-emerald-600 dark:bg-emerald-500' // 5th — Green
              ];
              return (
                <div className="mt-4 space-y-3.5">
                  {regionalData.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                      No regional distribution available for this dataset.
                    </div>
                  ) : (
                    regionalData.slice(0, 5).map((item, idx) => (
                      <div key={item.region || idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{item.region}</span>
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                              {formatCurrency(item.revenue)}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-xs w-8 text-right">
                              {item.share}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${REGION_COLORS[idx % REGION_COLORS.length]}`}
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

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{regionalData.length} active geographic territories</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">100% telemetry coverage</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. SALES AMOUNT REALISATION TREND (Full-Width Wireframe Layout)      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div>
          {/* Header with Title, Mode Controls & Legend (● Realized Metric, ● Target Benchmark) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                  Sales Amount Realisation Trend
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Daily revenue performance and realization against dataset baseline.
                </p>
              </div>
            </div>

            {/* Wireframe Legend & Chart Mode Controls */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Wireframe Legend Indicators */}
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  <span>Realized Metric</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>Target Benchmark</span>
                </span>
              </div>

              {/* Chart Mode Controls */}
              <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setChartViewMode('area')}
                  className={`h-7 sm:h-8 px-3 rounded-lg font-semibold transition cursor-pointer ${
                    chartViewMode === 'area'
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Area
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('bar')}
                  className={`h-7 sm:h-8 px-3 rounded-lg font-semibold transition cursor-pointer ${
                    chartViewMode === 'bar'
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Bar
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('line')}
                  className={`h-7 sm:h-8 px-3 rounded-lg font-semibold transition cursor-pointer ${
                    chartViewMode === 'line'
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Line
                </button>
              </div>
            </div>
          </div>

          {/* Spline Area / Bar / Line Visualization with Real Data */}
          <div className="mt-4 h-[300px] w-full">
            {trendsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm space-y-2">
                <BarChart3 className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <span>No revenue trajectory records found for the applied filter.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={trendsData}
                  margin={{ top: 12, right: 15, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="splineRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.25} vertical={false} />
                  <XAxis
                    dataKey="formattedDate"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatYAxisTick}
                  />
                  <Tooltip content={<EnterpriseTooltip />} />

                  {chartViewMode === 'area' && (
                    <Area
                      type="natural"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#splineRevenueGrad)"
                      dot={{ r: 3.5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  )}
                  {chartViewMode === 'bar' && (
                    <Bar
                      dataKey="revenue"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />
                  )}
                  {chartViewMode === 'line' && (
                    <Line
                      type="natural"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bottom Summary Strip (Calculated 100% from Real Trend Records) */}
        <div className="mt-3 pt-3.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 font-sans leading-tight">
                {highestTrendPoint ? formatCurrency(highestTrendPoint.revenue) : '—'}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Highest ({highestTrendPoint ? highestTrendPoint.formattedDate : '—'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 font-sans leading-tight">
                {lowestTrendPoint ? formatCurrency(lowestTrendPoint.revenue) : '—'}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Lowest ({lowestTrendPoint ? lowestTrendPoint.formattedDate : '—'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Equal className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 font-sans leading-tight">
                {avgDailyRevenue > 0 ? `${formatCurrency(avgDailyRevenue)}/day` : '—'}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Average Revenue</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. LOWER ANALYTICS: CHANNELS, PRODUCTS & DECISION SIGNALS           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Sales by Channel (Donut Chart + Legend with Real Data) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-2xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                    Sales by Channel
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Channel-wise revenue distribution.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <span>View Details</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Donut and Legend Side-by-Side with Real Channels */}
            {channelData.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                No channel breakdown available for this dataset.
              </div>
            ) : (
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-6">
                {/* Donut Chart with Real Total Revenue */}
                <div className="relative flex items-center justify-center h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={channelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={2.5}
                        dataKey="value"
                      >
                        {channelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text with Real Total Sales */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-base font-black text-slate-900 dark:text-slate-100 font-sans tracking-tight">
                      {kpiData?.totalSales !== undefined && kpiData?.totalSales !== null
                        ? formatCurrency(kpiData.totalSales)
                        : '—'}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Total Revenue</span>
                  </div>
                </div>

                {/* Real Channel Legend List */}
                <div className="space-y-2.5 flex-1 w-full min-w-0">
                  {channelData.map(c => (
                    <div key={c.name} className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2 truncate">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-2">
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">{c.share}%</span>
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

        {/* Card 2: Top Performing Products (Enterprise Table with Real Data) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-2xs flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                    Top Performing Products
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Revenue by product category.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/datasets')}
                className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Table with Real Products Data */}
            <div className="mt-4 overflow-x-auto">
              {productsData.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No product performance data available.
                </div>
              ) : (
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <th className="pb-2.5">Product</th>
                      <th className="pb-2.5 text-right">Revenue</th>
                      <th className="pb-2.5 text-right">Orders</th>
                      <th className="pb-2.5 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {productsData.slice(0, 5).map((row, idx) => (
                      <tr key={row.product || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                        <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[110px]" title={row.product}>
                          {row.product}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(row.revenue)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                          {row.orders}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {row.percentage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Real Decision Signals from Backend AI Engine */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-2xs flex flex-col justify-between min-h-[380px]">
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                    Decision Signals
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Live operational insights.
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>

            {/* Filter Pills */}
            {decisionSignals.length > 0 && (
              <div className="flex items-center gap-1.5 my-2.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setSignalTab('all')}
                  className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                    signalTab === 'all'
                      ? 'bg-blue-600 text-white font-bold'
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
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat} ({decisionSignals.filter(s => (s.type || s.severity || 'general').toLowerCase() === cat).length})
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable Signals Container */}
            <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 space-y-2.5">
              {decisionSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500 space-y-2">
                  <Lightbulb className="h-7 w-7 text-slate-300 dark:text-slate-700" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No decision signals available</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[200px]">
                      Run automated AI analysis to extract actionable operational signals.
                    </p>
                  </div>
                  {onGenerateSignals && (
                    <Button
                      variant="secondary"
                      onClick={onGenerateSignals}
                      loading={isSignalsLoading}
                      className="h-7 text-xs font-semibold px-2.5 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                    >
                      <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      <span>Generate Signals</span>
                    </Button>
                  )}
                </div>
              ) : (
                filteredSignals.map(sig => {
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
                            : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
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
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {sig.title}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                              isPositive
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                                : isCritical
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                                : isWarning
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                                : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
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
                })
              )}
            </div>
          </div>

          {/* AI Insights Link Action */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/ai-insights')}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-1 transition cursor-pointer"
            >
              <span>Explore All Decision Insights</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. DATA PROVENANCE / RAW TRANSACTION LOGS (Collapsible Section)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div
          onClick={() => setIsRawDataExpanded(!isRawDataExpanded)}
          className="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>Recent Sales Transactions (Source Dataset)</span>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                {tableData.totalCount?.toLocaleString() || 0} Records
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live transactional records and order-level audit logs from the active enterprise database.
            </p>
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

        {isRawDataExpanded && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <DynamicDataTable
              columns={summaryData?.dataset?.schema || []}
              rows={tableData.rows}
              totalCount={tableData.totalCount}
              page={tablePage}
              limit={tableLimit}
              onPageChange={onTablePageChange}
              onLimitChange={onTableLimitChange}
              onSortChange={onTableSortChange}
              onSearchChange={onTableSearchChange}
              sortKey={tableSortKey}
              sortOrder={tableSortOrder}
              searchQuery={tableSearch}
              isLoading={isAnalyticsLoading}
              datasetName={activeDataset?.name}
            />
          </div>
        )}
      </section>
    </div>
  );
}
