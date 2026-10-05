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
  Info
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
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-500 mb-1 text-[11px]">{label}</p>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          <span className="text-slate-600 font-medium">Revenue:</span>
          <span className="font-mono text-slate-900 font-bold">
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
      {/* 1. EXECUTIVE HEADER (Title, Description & Right Action Cluster)      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="space-y-3 pb-2">
        {/* Breadcrumb Hierarchy */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span className="hover:text-slate-600 transition cursor-pointer" onClick={() => navigate('/dashboard')}>
            RicozAnalytics
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="hover:text-slate-600 transition cursor-pointer">
            Ricoz Primary Organization
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-blue-600 font-semibold">
            Dashboard
          </span>
        </div>

        {/* Title Row with Action Cluster */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pt-1">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Executive Overview
              </h1>
              <p className="text-sm sm:text-base text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Monitor revenue, sales performance, regional growth, and operational signals across your business.
              </p>
            </div>
          </div>

          {/* Action Cluster (Dynamic Date Range, Export, AI Intelligence Brief) */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Real Date Range Dropdown Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsDateDropdownOpen(!isDateDropdownOpen);
                  setIsExportMenuOpen(false);
                }}
                className="flex items-center gap-2.5 h-11 px-4 rounded-xl bg-white border border-slate-200/90 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                title={`Active dataset date coverage: ${dateRangeLabel}`}
              >
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{dateRangeLabel}</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-30 font-sans">
                  <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Filter Date Coverage
                  </div>
                  {[
                    { label: 'Last 7 Days', value: '7d' },
                    { label: 'Last 30 Days', value: '30d' },
                    { label: 'Last 90 Days', value: '90d' },
                    { label: 'Year to Date', value: 'ytd' },
                    { label: 'All Recorded Telemetry', value: 'all' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        onFilterChange('dateRange', preset.value);
                        setIsDateDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                        (filters.dateRange || 'all') === preset.value
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {(filters.dateRange || 'all') === preset.value && (
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export Button Popover */}
            <div className="relative">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsExportMenuOpen(!isExportMenuOpen);
                  setIsDateDropdownOpen(false);
                }}
                className="h-11 text-sm font-semibold px-4"
                title="Export Executive Report"
              >
                <FileDown className="h-4 w-4 text-slate-500" />
                <span>Export</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </Button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-30 font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      window.print();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <FileDown className="h-4 w-4 text-blue-600" />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      if (tableData?.rows?.length > 0) {
                        const headers = Object.keys(tableData.rows[0]);
                        const csvRows = [headers.join(',')];
                        tableData.rows.forEach(r => {
                          csvRows.push(headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
                        });
                        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `ricoz_executive_analytics_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } else {
                        window.print();
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <FileDown className="h-4 w-4 text-emerald-600" />
                    <span>Export CSV Dataset</span>
                  </button>
                </div>
              )}
            </div>

            {/* AI Intelligence Brief Button */}
            <Button
              variant="primary"
              onClick={() => navigate('/ai-insights')}
              className="h-11 text-sm font-semibold px-4.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              id="executive-ai-brief-btn"
            >
              <Sparkles className="h-4 w-4" />
              <span>AI Intelligence Brief</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. FILTER BAR (Segmented Date Range + Dimension Dropdowns + Reset)  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-2xs">
        <DynamicFilterBar
          filters={filters}
          filterOptions={summaryData?.filterOptions || {}}
          dimensions={summaryData?.dimensions || {}}
          onFilterChange={onFilterChange}
          onResetFilters={onResetFilters}
        />
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. FOUR KPI CARDS (Populated 100% from Real API Data)               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* KPI 1: Revenue */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all flex flex-col justify-between min-h-[195px]">
          <div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Revenue</span>
            </div>
            <div className="mt-3.5 flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
                {kpiData?.totalSales !== undefined && kpiData?.totalSales !== null
                  ? formatCurrency(kpiData.totalSales)
                  : '—'}
              </span>
              <Sparkline points={revenueSparkline} color="#2563EB" />
            </div>
            {/* Real Comparison Metric */}
            <div className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold">
              {kpiData?.comparison?.hasComparison ? (
                <>
                  <span className={kpiData.comparison.isSalesPositive ? 'text-emerald-600' : 'text-rose-600'}>
                    {kpiData.comparison.salesChange}
                  </span>
                  <span className="text-slate-400 font-normal">{kpiData.comparison.periodLabel}</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">Active baseline period</span>
              )}
            </div>
          </div>
          {/* Target or Real Secondary Metric */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 font-medium">
            {kpiData?.target ? (
              <>
                <span>Target {formatCurrency(kpiData.target)}</span>
                <div className="flex items-center gap-2 flex-1 max-w-[100px] mx-2">
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${Math.min(Math.round((kpiData.totalSales / kpiData.target) * 100), 100)}%` }}
                    />
                  </div>
                </div>
                <span className="font-bold text-slate-800">
                  {Math.round((kpiData.totalSales / kpiData.target) * 100)}%
                </span>
              </>
            ) : (
              <>
                <span>Peak Daily:</span>
                <span className="font-bold text-slate-800 font-mono text-sm">
                  {kpiData?.maxSales ? formatCurrency(kpiData.maxSales) : '—'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-xs hover:border-emerald-200 transition-all flex flex-col justify-between min-h-[195px]">
          <div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Orders</span>
            </div>
            <div className="mt-3.5 flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
                {kpiData?.totalOrders !== undefined && kpiData?.totalOrders !== null
                  ? Number(kpiData.totalOrders).toLocaleString()
                  : '—'}
              </span>
              <Sparkline points={ordersSparkline} color="#059669" />
            </div>
            {/* Real Comparison Metric */}
            <div className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold">
              {kpiData?.comparison?.hasComparison ? (
                <>
                  <span className={kpiData.comparison.isOrdersPositive ? 'text-emerald-600' : 'text-rose-600'}>
                    {kpiData.comparison.ordersChange}
                  </span>
                  <span className="text-slate-400 font-normal">{kpiData.comparison.periodLabel}</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">Active baseline period</span>
              )}
            </div>
          </div>
          {/* Target or Real Secondary Metric */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 font-medium">
            <span>Avg Order Volume:</span>
            <span className="font-bold text-slate-800 font-mono text-sm">
              {kpiData?.totalOrders > 0
                ? `${(kpiData.totalQuantity / kpiData.totalOrders).toFixed(1)} units`
                : '—'}
            </span>
          </div>
        </div>

        {/* KPI 3: Units Sold */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-xs hover:border-amber-200 transition-all flex flex-col justify-between min-h-[195px]">
          <div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Package className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Units Sold</span>
            </div>
            <div className="mt-3.5 flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
                {kpiData?.totalQuantity !== undefined && kpiData?.totalQuantity !== null
                  ? Number(kpiData.totalQuantity).toLocaleString()
                  : '—'}
              </span>
              <Sparkline points={unitsSparkline} color="#d97706" />
            </div>
            {/* Real Secondary Metric */}
            <div className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
              <span className="font-bold text-slate-700">{kpiData?.recordCount || 0}</span>
              <span className="text-slate-400 font-normal">verified line transactions</span>
            </div>
          </div>
          {/* Real Secondary Metric */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 font-medium">
            <span>Avg Unit Realization:</span>
            <span className="font-bold text-slate-800 font-mono text-sm">
              {kpiData?.totalQuantity > 0
                ? formatCurrency(kpiData.totalSales / kpiData.totalQuantity)
                : '—'}
            </span>
          </div>
        </div>

        {/* KPI 4: Average Order Value */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-xs hover:border-purple-200 transition-all flex flex-col justify-between min-h-[195px]">
          <div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <IndianRupee className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Average Order Value</span>
            </div>
            <div className="mt-3.5 flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
                {kpiData?.averageOrderValue !== undefined && kpiData?.averageOrderValue !== null
                  ? formatCurrency(kpiData.averageOrderValue)
                  : '—'}
              </span>
              <Sparkline points={aovSparkline} color="#7c3aed" />
            </div>
            {/* Real Comparison Metric */}
            <div className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold">
              {kpiData?.comparison?.hasComparison ? (
                <>
                  <span className={kpiData.comparison.isSalesPositive ? 'text-emerald-600' : 'text-rose-600'}>
                    {kpiData.comparison.salesChange}
                  </span>
                  <span className="text-slate-400 font-normal">{kpiData.comparison.periodLabel}</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal text-xs">Dataset performance benchmark</span>
              )}
            </div>
          </div>
          {/* Real Secondary Metric */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 font-medium">
            <span>Orders Sampled:</span>
            <span className="font-bold text-slate-800 font-mono text-sm">
              {kpiData?.totalOrders || 0} orders
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. MAIN ANALYTICS AREA (Col 8: Real Revenue Trend | Col 4: Real Signals) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Real Revenue Trend (Compact, snug, NO bottom gap) */}
        <div className="xl:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div>
            {/* Header with Title and Mode Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                    Revenue Trend
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Daily revenue performance over the selected period.
                  </p>
                </div>
              </div>

              {/* Chart Mode Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setChartViewMode('area')}
                    className={`h-7 sm:h-8 px-3 rounded-lg font-semibold transition cursor-pointer ${
                      chartViewMode === 'area'
                        ? 'bg-blue-600 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
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
                        : 'text-slate-600 hover:text-slate-900'
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
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Line
                  </button>
                </div>

                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs">
                    <span>Daily</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Spline Area Visualization with Real Data — compact & snug with NO gap at bottom */}
            <div className="mt-3 h-[290px] w-full">
              {trendsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm space-y-2">
                  <BarChart3 className="h-10 w-10 text-slate-300" />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
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

          {/* Bottom Summary Strip (Calculated 100% from Real Trend Records) — positioned directly beneath chart without gap */}
          <div className="mt-3 pt-3.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-extrabold text-slate-900 font-sans leading-tight">
                  {highestTrendPoint ? formatCurrency(highestTrendPoint.revenue) : '—'}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Highest ({highestTrendPoint ? highestTrendPoint.formattedDate : '—'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <ArrowDownRight className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-extrabold text-slate-900 font-sans leading-tight">
                  {lowestTrendPoint ? formatCurrency(lowestTrendPoint.revenue) : '—'}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Lowest ({lowestTrendPoint ? lowestTrendPoint.formattedDate : '—'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Equal className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-extrabold text-slate-900 font-sans leading-tight">
                  {avgDailyRevenue > 0 ? `${formatCurrency(avgDailyRevenue)}/day` : '—'}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">Average Revenue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Real Decision Signals from Backend AI Engine with Internal Scrolling */}
        <div className="xl:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                    Decision Signals
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Key insights detected across sales channels.
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>

            {/* Filter Pills derived dynamically from real signals */}
            {decisionSignals.length > 0 && (
              <div className="flex items-center gap-1.5 my-3 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setSignalTab('all')}
                  className={`h-7 px-3 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
                    signalTab === 'all'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({decisionSignals.length})
                </button>
                {availableSignalCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSignalTab(cat)}
                    className={`h-7 px-3 rounded-full text-xs font-semibold capitalize transition cursor-pointer shrink-0 ${
                      signalTab === cat
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat} ({decisionSignals.filter(s => (s.type || s.severity || 'general').toLowerCase() === cat).length})
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable Signals Container — Prevents disturbing adjacent cards or page layout */}
            <div className="flex-1 overflow-y-auto max-h-[290px] pr-1 space-y-3">
              {decisionSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                  <Lightbulb className="h-8 w-8 text-slate-300" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">No decision signals available</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                      Run automated AI analysis on this dataset to extract actionable operational signals.
                    </p>
                  </div>
                  {onGenerateSignals && (
                    <Button
                      variant="secondary"
                      onClick={onGenerateSignals}
                      loading={isSignalsLoading}
                      className="h-8 text-xs font-semibold px-3"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                      <span>Generate AI Signals</span>
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
                      className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition flex items-start gap-3"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isPositive
                            ? 'bg-emerald-50 text-emerald-600'
                            : isCritical
                            ? 'bg-rose-50 text-rose-600'
                            : isWarning
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : isCritical || isWarning ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {sig.title}
                          </h4>
                          <span
                            className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                              isPositive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isCritical
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isWarning
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {sig.evidence?.delta !== undefined
                              ? `${sig.evidence.delta >= 0 ? '+' : ''}${(sig.evidence.delta * 100).toFixed(1)}%`
                              : sig.priority || sig.type}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
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
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/ai-insights')}
              className="w-full flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 py-1 transition cursor-pointer"
            >
              <span>Explore All Decision Insights</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. LOWER ANALYTICS (Three 4-Column Cards Populated 100% from API)   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Sales by Region */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col justify-between min-h-[390px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                    Sales by Region
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Revenue contribution across regions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>View Details</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Horizontal Bar Chart List with Real Data */}
            <div className="mt-5 space-y-4">
              {regionalData.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  No regional distribution available for this dataset.
                </div>
              ) : (
                regionalData.map((item, idx) => (
                  <div key={item.region || idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">{item.region}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 font-mono">
                          {formatCurrency(item.revenue)}
                        </span>
                        <span className="text-slate-400 font-mono text-xs w-8 text-right">
                          {item.share}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${item.relativeWidth}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Sales by Channel (Donut Chart + Legend with Real Data) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col justify-between min-h-[390px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                    Sales by Channel
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Channel-wise revenue distribution.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>View Details</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Donut and Legend Side-by-Side with Real Channels */}
            {channelData.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No channel breakdown available for this dataset.
              </div>
            ) : (
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-6">
                {/* Donut Chart with Real Total Revenue */}
                <div className="relative flex items-center justify-center h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={channelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={74}
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
                    <span className="text-lg font-black text-slate-900 font-sans tracking-tight">
                      {kpiData?.totalSales !== undefined && kpiData?.totalSales !== null
                        ? formatCurrency(kpiData.totalSales)
                        : '—'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Total Revenue</span>
                  </div>
                </div>

                {/* Real Channel Legend List */}
                <div className="space-y-3 flex-1 w-full min-w-0">
                  {channelData.map(c => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-slate-700 font-medium truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-slate-400 font-mono text-xs">{c.share}%</span>
                        <span className="font-bold text-slate-900 font-mono text-sm">
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

        {/* Card 3: Top Performing Products (Enterprise Table with Real Data) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col justify-between min-h-[390px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                    Top Performing Products
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Revenue by product category.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/datasets')}
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Table with Real Products Data */}
            <div className="mt-4 overflow-x-auto">
              {productsData.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  No product performance data available.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3">Product</th>
                      <th className="pb-3 text-right">Revenue</th>
                      <th className="pb-3 text-right">Orders</th>
                      <th className="pb-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productsData.map((row, idx) => (
                      <tr key={row.product || idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 font-semibold text-slate-800 truncate max-w-[130px]" title={row.product}>
                          {row.product}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(row.revenue)}
                        </td>
                        <td className="py-3 text-right font-mono text-slate-600">
                          {row.orders}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-emerald-600">
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
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. DATA PROVENANCE / RAW TRANSACTION LOGS (Collapsible Section)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div
          onClick={() => setIsRawDataExpanded(!isRawDataExpanded)}
          className="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Recent Sales Transactions (Source Dataset)</span>
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {tableData.totalCount?.toLocaleString() || 0} Records
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live transactional records and order-level audit logs from the active enterprise database.
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
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
          <div className="mt-5 pt-4 border-t border-slate-100">
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
