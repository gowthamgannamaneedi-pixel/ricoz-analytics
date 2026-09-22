import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  Download,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Loader2,
  Table2,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import DatasetSelector from '../components/DatasetSelector';
import DynamicFilterBar from '../components/DynamicFilterBar';
import DynamicDataTable from '../components/DynamicDataTable';

/**
 * High-Contrast Professional Tooltip Formatter
 */
const EnterpriseTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-3 shadow-lg text-xs font-sans">
        <p className="font-bold text-slate-800 mb-1.5 text-[11px] uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={`entry-${index}`} className="flex items-center justify-between gap-5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-500 text-xs font-medium">{entry.name}:</span>
              </div>
              <span className="font-mono text-slate-900 font-bold text-xs">
                {prefix}{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}{suffix}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Fallback sample data when backend is not connected
const FALLBACK_DATASETS = [
  {
    id: 1,
    name: 'Indian Enterprise Sales Telemetry (Q4)',
    type: 'csv',
    row_count: 45200,
    column_count: 8,
    created_at: '2025-01-15T10:30:00Z'
  },
  {
    id: 2,
    name: 'Product Inventory & Logistics',
    type: 'json',
    row_count: 8400,
    column_count: 6,
    created_at: '2025-01-18T14:15:00Z'
  },
  {
    id: 3,
    name: 'Production PostgreSQL Hub',
    type: 'postgresql',
    row_count: 125000,
    column_count: 9,
    created_at: '2025-01-20T09:00:00Z'
  }
];

const FALLBACK_SCHEMA = [
  { name: 'order_id', type: 'number' },
  { name: 'region', type: 'string' },
  { name: 'category', type: 'string' },
  { name: 'channel', type: 'string' },
  { name: 'sales_amount', type: 'number' },
  { name: 'units_sold', type: 'number' },
  { name: 'profit', type: 'number' },
  { name: 'is_discounted', type: 'boolean' },
  { name: 'order_date', type: 'date' }
];

const FALLBACK_ROWS = [
  { order_id: 1001, region: 'Bengaluru', category: 'Hardware', channel: 'Direct Online', sales_amount: 45000.5, units_sold: 12, profit: 6500.0, is_discounted: false, order_date: '2025-01-15' },
  { order_id: 1002, region: 'Mumbai', category: 'Software', channel: 'Retail Partners', sales_amount: 125000.0, units_sold: 5, profit: 35000.0, is_discounted: true, order_date: '2025-01-16' },
  { order_id: 1003, region: 'Delhi NCR', category: 'Cloud SaaS', channel: 'B2B Enterprise', sales_amount: 89000.0, units_sold: 20, profit: 22000.0, is_discounted: false, order_date: '2025-01-17' },
  { order_id: 1004, region: 'Hyderabad', category: 'Hardware', channel: 'Direct Online', sales_amount: 62000.0, units_sold: 18, profit: 9400.0, is_discounted: true, order_date: '2025-01-18' },
  { order_id: 1005, region: 'Chennai', category: 'Services', channel: 'B2B Enterprise', sales_amount: 34000.0, units_sold: 8, profit: 7100.0, is_discounted: false, order_date: '2025-01-19' },
  { order_id: 1006, region: 'Bengaluru', category: 'Software', channel: 'Direct Online', sales_amount: 195000.0, units_sold: 10, profit: 48000.0, is_discounted: false, order_date: '2025-01-20' },
  { order_id: 1007, region: 'Mumbai', category: 'Cloud SaaS', channel: 'B2B Enterprise', sales_amount: 142000.0, units_sold: 25, profit: 38000.0, is_discounted: true, order_date: '2025-01-21' },
  { order_id: 1008, region: 'Delhi NCR', category: 'Services', channel: 'Retail Partners', sales_amount: 48000.0, units_sold: 15, profit: 11200.0, is_discounted: false, order_date: '2025-01-22' },
  { order_id: 1009, region: 'Hyderabad', category: 'Hardware', channel: 'Direct Online', sales_amount: 78000.0, units_sold: 22, profit: 14500.0, is_discounted: true, order_date: '2025-01-23' },
  { order_id: 1010, region: 'Chennai', category: 'Software', channel: 'Retail Partners', sales_amount: 110000.0, units_sold: 7, profit: 29000.0, is_discounted: false, order_date: '2025-01-24' },
  { order_id: 1011, region: 'Bengaluru', category: 'Cloud SaaS', channel: 'B2B Enterprise', sales_amount: 215000.0, units_sold: 30, profit: 62000.0, is_discounted: false, order_date: '2025-01-25' },
  { order_id: 1012, region: 'Mumbai', category: 'Hardware', channel: 'Direct Online', sales_amount: 94000.0, units_sold: 16, profit: 18000.0, is_discounted: true, order_date: '2025-01-26' },
  { order_id: 1013, region: 'Delhi NCR', category: 'Software', channel: 'Retail Partners', sales_amount: 165000.0, units_sold: 9, profit: 41000.0, is_discounted: false, order_date: '2025-01-27' },
  { order_id: 1014, region: 'Hyderabad', category: 'Services', channel: 'B2B Enterprise', sales_amount: 53000.0, units_sold: 11, profit: 12800.0, is_discounted: false, order_date: '2025-01-28' },
  { order_id: 1015, region: 'Chennai', category: 'Cloud SaaS', channel: 'Direct Online', sales_amount: 138000.0, units_sold: 24, profit: 36000.0, is_discounted: true, order_date: '2025-01-29' },
  { order_id: 1016, region: 'Bengaluru', category: 'Services', channel: 'B2B Enterprise', sales_amount: 67000.0, units_sold: 14, profit: 15400.0, is_discounted: false, order_date: '2025-01-30' },
  { order_id: 1017, region: 'Mumbai', category: 'Cloud SaaS', channel: 'Direct Online', sales_amount: 182000.0, units_sold: 28, profit: 44000.0, is_discounted: false, order_date: '2025-01-31' },
  { order_id: 1018, region: 'Delhi NCR', category: 'Hardware', channel: 'Retail Partners', sales_amount: 81000.0, units_sold: 19, profit: 13200.0, is_discounted: true, order_date: '2025-02-01' },
  { order_id: 1019, region: 'Hyderabad', category: 'Software', channel: 'Direct Online', sales_amount: 145000.0, units_sold: 11, profit: 37500.0, is_discounted: false, order_date: '2025-02-02' },
  { order_id: 1020, region: 'Chennai', category: 'Hardware', channel: 'Retail Partners', sales_amount: 72000.0, units_sold: 17, profit: 11800.0, is_discounted: false, order_date: '2025-02-03' }
];

export default function DashboardPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // Datasets List & Active Selection
  const [datasets, setDatasets] = useState(FALLBACK_DATASETS);
  const [selectedDatasetId, setSelectedDatasetId] = useState(() => {
    const saved = localStorage.getItem('ricoz_active_dataset_id');
    return saved ? Number(saved) : 1;
  });

  // Active Dataset Metadata & Filters
  const [summaryData, setSummaryData] = useState({
    dataset: { name: 'Indian Enterprise Sales Telemetry (Q4)', schema: FALLBACK_SCHEMA },
    dimensions: {
      primaryMetric: 'Sales Amount',
      quantityMetric: 'Units Sold',
      dateColumn: 'order_date',
      regionColumn: 'region',
      channelColumn: 'channel',
      productColumn: 'category'
    },
    filterOptions: {
      regions: ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai'],
      channels: ['Direct Online', 'Retail Partners', 'B2B Enterprise'],
      categories: ['Hardware', 'Software', 'Cloud SaaS', 'Services'],
      dateBounds: { min: '2025-01-15', max: '2025-02-03' }
    }
  });

  const [filters, setFilters] = useState({ dateRange: 'all' });
  const [kpiData, setKpiData] = useState(null);
  const [trendsData, setTrendsData] = useState([]);
  const [regionBreakdown, setRegionBreakdown] = useState([]);
  const [channelBreakdown, setChannelBreakdown] = useState([]);
  const [productBreakdown, setProductBreakdown] = useState([]);

  // Table State
  const [tableData, setTableData] = useState({ rows: FALLBACK_ROWS, totalCount: FALLBACK_ROWS.length });
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit, setTableLimit] = useState(20);
  const [tableSortKey, setTableSortKey] = useState('');
  const [tableSortOrder, setTableSortOrder] = useState('desc');
  const [tableSearch, setTableSearch] = useState('');

  // Loading & Error States
  const [isDatasetsLoading, setIsDatasetsLoading] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Client-Side Mock Analytics Calculator
  const computeFallbackAnalytics = useCallback(() => {
    let filtered = [...FALLBACK_ROWS];

    // Filter by Region
    if (filters.region && filters.region !== 'all') {
      filtered = filtered.filter(r => r.region.toLowerCase() === filters.region.toLowerCase());
    }

    // Filter by Channel
    if (filters.channel && filters.channel !== 'all') {
      filtered = filtered.filter(r => r.channel.toLowerCase() === filters.channel.toLowerCase());
    }

    // Filter by Category
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(r => r.category.toLowerCase() === filters.category.toLowerCase());
    }

    // Search query
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      filtered = filtered.filter(r =>
        Object.values(r).some(val => String(val).toLowerCase().includes(q))
      );
    }

    // KPIs
    const totalSales = filtered.reduce((sum, r) => sum + r.sales_amount, 0);
    const totalOrders = filtered.length;
    const totalQuantity = filtered.reduce((sum, r) => sum + r.units_sold, 0);
    const aov = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    const minSales = totalOrders > 0 ? Math.min(...filtered.map(r => r.sales_amount)) : 0;
    const maxSales = totalOrders > 0 ? Math.max(...filtered.map(r => r.sales_amount)) : 0;

    setKpiData({
      totalSales,
      totalOrders,
      totalQuantity,
      averageOrderValue: aov,
      minSales,
      maxSales,
      recordCount: 45200,
      comparison: {
        hasComparison: true,
        isSalesPositive: true,
        salesChange: '+18.2%',
        isOrdersPositive: true,
        ordersChange: '+12.4%',
        periodLabel: 'vs last month'
      }
    });

    // Trends Data (Time-series)
    const trendsMap = {};
    filtered.forEach(r => {
      const dateKey = r.order_date;
      if (!trendsMap[dateKey]) {
        trendsMap[dateKey] = { formattedDate: dateKey, revenue: 0, target: 80000 };
      }
      trendsMap[dateKey].revenue += r.sales_amount;
    });
    setTrendsData(Object.values(trendsMap));

    // Region Breakdown
    const regMap = {};
    filtered.forEach(r => {
      regMap[r.region] = (regMap[r.region] || 0) + r.sales_amount;
    });
    setRegionBreakdown(Object.entries(regMap).map(([category, value]) => ({ category, value })));

    // Channel Breakdown
    const chanMap = {};
    filtered.forEach(r => {
      chanMap[r.channel] = (chanMap[r.channel] || 0) + r.sales_amount;
    });
    setChannelBreakdown(Object.entries(chanMap).map(([category, value]) => ({ category, value })));

    // Product / Category Breakdown
    const catMap = {};
    filtered.forEach(r => {
      catMap[r.category] = (catMap[r.category] || 0) + r.sales_amount;
    });
    setProductBreakdown(Object.entries(catMap).map(([category, value]) => ({ category, value })));

    // Sorting
    if (tableSortKey) {
      filtered.sort((a, b) => {
        const valA = a[tableSortKey];
        const valB = b[tableSortKey];
        if (typeof valA === 'number') {
          return tableSortOrder === 'asc' ? valA - valB : valB - valA;
        }
        return tableSortOrder === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    // Paginated Table
    const startIdx = (tablePage - 1) * tableLimit;
    const paginated = filtered.slice(startIdx, startIdx + tableLimit);

    setTableData({
      rows: paginated,
      totalCount: filtered.length
    });
  }, [filters, tableSearch, tableSortKey, tableSortOrder, tablePage, tableLimit]);

  // 1. Fetch available datasets for authenticated user (with graceful fallback)
  const fetchDatasets = async () => {
    try {
      const res = await fetch('/api/datasets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        const list = json.data || [];
        if (list.length > 0) {
          setDatasets(list);
          if (!selectedDatasetId || !list.some(d => d.id === selectedDatasetId)) {
            setSelectedDatasetId(list[0].id);
          }
          return;
        }
      }
      // Use fallback
      setDatasets(FALLBACK_DATASETS);
    } catch (_) {
      setDatasets(FALLBACK_DATASETS);
    } finally {
      setIsDatasetsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [token]);

  // Handle Switching Active Dataset
  const handleSelectDataset = (id) => {
    setSelectedDatasetId(id);
    localStorage.setItem('ricoz_active_dataset_id', String(id));
    setFilters({ dateRange: 'all' });
    setTablePage(1);
    setTableSearch('');
  };

  // Build Query String from Filters
  const buildQueryParams = useCallback((additionalParams = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') params.append(k, v);
    });
    Object.entries(additionalParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, v);
    });
    return params.toString();
  }, [filters]);

  // 2. Load Dataset Summary & Schema (with graceful fallback)
  const fetchDatasetSummary = async (id) => {
    try {
      const res = await fetch(`/api/analytics/datasets/${id}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        setSummaryData(json.data);
      }
    } catch (_) {
      // Keep rich sample summary
    }
  };

  // 3. Load Dynamic Analytics (KPIs, Trends, Breakdowns, Table)
  const fetchAnalytics = async (id, showLoading = true) => {
    if (showLoading) setIsAnalyticsLoading(true);
    setError('');

    try {
      const queryStr = buildQueryParams();

      const [kpisRes, trendsRes, regionRes, channelRes, productRes, rowsRes] = await Promise.all([
        fetch(`/api/analytics/datasets/${id}/kpis?${queryStr}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/analytics/datasets/${id}/trends?${queryStr}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/analytics/datasets/${id}/breakdowns?${buildQueryParams({ groupBy: 'region' })}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/analytics/datasets/${id}/breakdowns?${buildQueryParams({ groupBy: 'channel' })}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/analytics/datasets/${id}/breakdowns?${buildQueryParams({ groupBy: 'product' })}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/analytics/datasets/${id}/rows?${buildQueryParams({
          page: tablePage,
          limit: tableLimit,
          sortKey: tableSortKey,
          sortOrder: tableSortOrder,
          search: tableSearch
        })}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [kpisJson, trendsJson, regionJson, channelJson, productJson, rowsJson] = await Promise.all([
        kpisRes.json().catch(() => null),
        trendsRes.json().catch(() => null),
        regionRes.json().catch(() => null),
        channelRes.json().catch(() => null),
        productRes.json().catch(() => null),
        rowsRes.json().catch(() => null)
      ]);

      if (kpisRes.ok && kpisJson?.data?.kpis) {
        setKpiData(kpisJson.data?.kpis || null);
        setTrendsData(trendsJson?.data?.trends || []);
        setRegionBreakdown(regionJson?.data?.breakdown || []);
        setChannelBreakdown(channelJson?.data?.breakdown || []);
        setProductBreakdown(productJson?.data?.breakdown || []);
        setTableData({
          rows: rowsJson?.data?.rows || [],
          totalCount: rowsJson?.data?.totalCount || 0
        });
      } else {
        // Fallback to rich client-side computed analytics
        computeFallbackAnalytics();
      }
    } catch (_) {
      computeFallbackAnalytics();
    } finally {
      setIsAnalyticsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Effect to load summary when selected dataset changes
  useEffect(() => {
    if (selectedDatasetId) {
      fetchDatasetSummary(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  // Effect to recalculate analytics when filters or dataset change
  useEffect(() => {
    if (selectedDatasetId) {
      fetchAnalytics(selectedDatasetId, false);
    } else {
      computeFallbackAnalytics();
    }
  }, [selectedDatasetId, filters, tablePage, tableLimit, tableSortKey, tableSortOrder, tableSearch, computeFallbackAnalytics]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setTablePage(1);
  };

  const handleResetFilters = () => {
    setFilters({ dateRange: 'all' });
    setTableSearch('');
    setTablePage(1);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (selectedDatasetId) {
      fetchAnalytics(selectedDatasetId, false);
    } else {
      computeFallbackAnalytics();
      setIsRefreshing(false);
    }
  };

  const activeDataset = datasets.find(d => d.id === selectedDatasetId) || datasets[0];

  // Format currency
  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val.toLocaleString()}`;
  };

  // -------------------------------------------------------------
  // Render: Initial Loading State
  // -------------------------------------------------------------
  if (isDatasetsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-3 font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs font-semibold text-slate-600">
          Loading workspace datasets...
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render: Empty State (No datasets available)
  // -------------------------------------------------------------
  if (datasets.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center max-w-xl mx-auto my-12 shadow-2xs font-sans space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100">
          <Database className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">No Datasets Connected</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Connect a PostgreSQL database or upload CSV/JSON files in Data Sources to start analyzing your business data.
          </p>
        </div>
        <button
          onClick={() => navigate('/data-sources')}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Go to Data Sources</span>
        </button>
      </div>
    );
  }

  const dimensions = summaryData?.dimensions || {};
  const filterOptions = summaryData?.filterOptions || {};
  const schema = summaryData?.dataset?.schema || [];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header: Title, Dataset Selector & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Overview
            </h1>
            <DatasetSelector
              datasets={datasets}
              selectedDatasetId={selectedDatasetId}
              onSelectDataset={handleSelectDataset}
            />
          </div>

          <p className="text-xs text-slate-500 mt-1 font-normal">
            {activeDataset ? (
              <>
                <span className="font-semibold text-slate-700">{activeDataset.name}</span>
                {filterOptions.dateBounds?.min && filterOptions.dateBounds?.max && (
                  <span> · Timeline: {filterOptions.dateBounds.min} to {filterOptions.dateBounds.max}</span>
                )}
                <span> · {activeDataset.row_count?.toLocaleString()} records ingested</span>
              </>
            ) : (
              'Multi-channel enterprise telemetry'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/datasets')}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Table2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Manage Datasets</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-bold">Analytics calculation error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Dynamic Global Filter Strip */}
      <DynamicFilterBar
        filters={filters}
        filterOptions={filterOptions}
        dimensions={dimensions}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Dynamic KPI Section */}
      {kpiData ? (
        <section className="rounded-md border border-slate-200 bg-white divide-y sm:divide-y-0 sm:divide-x divide-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden shadow-2xs">
          {/* Primary Metric: Total Sales / Revenue */}
          <StatCard
            title={`Total ${dimensions.primaryMetric || 'Sales'}`}
            value={formatCurrency(kpiData.totalSales)}
            change={kpiData.comparison?.salesChange}
            isPositive={kpiData.comparison?.isSalesPositive}
            period={kpiData.comparison?.periodLabel || 'calculated sum'}
            subtext={`Min: ${formatCurrency(kpiData.minSales)} · Max: ${formatCurrency(kpiData.maxSales)}`}
            isPrimary={true}
          />

          {/* Orders / Transactions Count */}
          <StatCard
            title="Total Orders"
            value={kpiData.totalOrders.toLocaleString()}
            change={kpiData.comparison?.ordersChange}
            isPositive={kpiData.comparison?.isOrdersPositive}
            period={kpiData.comparison?.periodLabel || 'volume count'}
            subtext={`${kpiData.recordCount.toLocaleString()} total rows`}
          />

          {/* Quantity / Units Ingested */}
          <StatCard
            title={`Total ${dimensions.quantityMetric || 'Units'}`}
            value={kpiData.totalQuantity.toLocaleString()}
            period="units processed"
            subtext={`${dimensions.quantityMetric ? 'Aggregated quantity' : 'Transaction count'}`}
          />

          {/* Average Order Value (AOV) */}
          <StatCard
            title="Average Order Value"
            value={formatCurrency(kpiData.averageOrderValue)}
            period="per transaction"
            subtext={`Avg across ${kpiData.totalOrders.toLocaleString()} orders`}
          />
        </section>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
          No numeric fields available for KPI analysis.
        </div>
      )}

      {/* Visualizations Row 1: Time-Series Trend + Regional Commercial Hubs */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Time-Series Trend (2 Cols) */}
        <ChartCard
          title={`${dimensions.primaryMetric || 'Sales'} Realization Trend`}
          subtitle="Time-series aggregation over reporting timeline"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600" /> Realized Metric
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-xs border-2 border-dashed border-slate-400" /> Target Benchmark
              </span>
            </div>
          }
        >
          {trendsData.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-xs text-slate-400">
              No date dimension available for time-series trendline.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="formattedDate"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`}
                />
                <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name={dimensions.primaryMetric || 'Revenue'}
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#2563eb', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                  activeDot={{ r: 5, fill: '#2563eb' }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Baseline Benchmark"
                  stroke="#94a3b8"
                  strokeWidth={1.75}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Regional Hubs / Top Category Distribution (1 Col) */}
        <ChartCard
          title="Regional Performance"
          subtitle={`Top ${dimensions.regionColumn || 'regions'} by volume`}
        >
          {regionBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-xs text-slate-400">
              No region column identified in dataset.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={regionBreakdown.slice(0, 6)}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                <Bar
                  dataKey="value"
                  name={dimensions.primaryMetric || 'Revenue'}
                  fill="#2563eb"
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* Visualizations Row 2: Sales Channel Breakdown + Product Performance */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Performance */}
        <ChartCard
          title="Channel Distribution"
          subtitle={`Commercial share across ${dimensions.channelColumn || 'channels'}`}
        >
          {channelBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-xs text-slate-400">
              No channel dimension detected.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={channelBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="category"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`}
                />
                <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                <Bar dataKey="value" name={dimensions.primaryMetric || 'Sales'} fill="#0891b2" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Product / Category Performance */}
        <ChartCard
          title="Product Breakdown"
          subtitle={`Revenue distribution across ${dimensions.productColumn || dimensions.categoryColumn || 'products'}`}
        >
          {productBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-xs text-slate-400">
              No product or category column detected.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={productBreakdown.slice(0, 6)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="category"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`}
                />
                <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                <Bar dataKey="value" name={dimensions.primaryMetric || 'Sales'} fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* Dynamic Paginated Data Table */}
      <section>
        <DynamicDataTable
          columns={schema}
          rows={tableData.rows}
          totalCount={tableData.totalCount}
          page={tablePage}
          limit={tableLimit}
          onPageChange={setTablePage}
          onLimitChange={(newLimit) => { setTableLimit(newLimit); setTablePage(1); }}
          onSortChange={(key, order) => { setTableSortKey(key); setTableSortOrder(order); }}
          onSearchChange={(query) => { setTableSearch(query); setTablePage(1); }}
          sortKey={tableSortKey}
          sortOrder={tableSortOrder}
          searchQuery={tableSearch}
          isLoading={isAnalyticsLoading}
          datasetName={activeDataset?.name}
        />
      </section>
    </div>
  );
}
