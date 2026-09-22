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

export default function DashboardPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // Datasets List & Active Selection
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(() => {
    const saved = localStorage.getItem('ricoz_active_dataset_id');
    return saved ? Number(saved) : null;
  });

  // Active Dataset Metadata & Filters
  const [summaryData, setSummaryData] = useState(null);
  const [filters, setFilters] = useState({ dateRange: 'all' });
  const [kpiData, setKpiData] = useState(null);
  const [trendsData, setTrendsData] = useState([]);
  const [regionBreakdown, setRegionBreakdown] = useState([]);
  const [channelBreakdown, setChannelBreakdown] = useState([]);
  const [productBreakdown, setProductBreakdown] = useState([]);

  // Table State
  const [tableData, setTableData] = useState({ rows: [], totalCount: 0 });
  const [tablePage, setTablePage] = useState(1);
  const [tableLimit, setTableLimit] = useState(20);
  const [tableSortKey, setTableSortKey] = useState('');
  const [tableSortOrder, setTableSortOrder] = useState('desc');
  const [tableSearch, setTableSearch] = useState('');

  // Loading & Error States
  const [isDatasetsLoading, setIsDatasetsLoading] = useState(true);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // 1. Fetch available datasets for authenticated user
  const fetchDatasets = async () => {
    setIsDatasetsLoading(true);
    try {
      const res = await fetch('/api/datasets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok) {
        const list = json.data || [];
        setDatasets(list);
        if (list.length > 0) {
          // If no active selection or selected dataset is missing, select the first
          if (!selectedDatasetId || !list.some(d => d.id === selectedDatasetId)) {
            setSelectedDatasetId(list[0].id);
            localStorage.setItem('ricoz_active_dataset_id', String(list[0].id));
          }
        } else {
          setSelectedDatasetId(null);
          localStorage.removeItem('ricoz_active_dataset_id');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load datasets.');
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

  // 2. Load Dataset Summary & Schema
  const fetchDatasetSummary = async (id) => {
    try {
      const res = await fetch(`/api/analytics/datasets/${id}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setSummaryData(json.data);
    } catch (err) {
      setError(err.message);
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
        kpisRes.json(),
        trendsRes.json(),
        regionRes.json(),
        channelRes.json(),
        productRes.json(),
        rowsRes.json()
      ]);

      if (!kpisRes.ok) throw new Error(kpisJson.message);

      setKpiData(kpisJson.data?.kpis || null);
      setTrendsData(trendsJson.data?.trends || []);
      setRegionBreakdown(regionJson.data?.breakdown || []);
      setChannelBreakdown(channelJson.data?.breakdown || []);
      setProductBreakdown(productJson.data?.breakdown || []);
      setTableData({
        rows: rowsJson.data?.rows || [],
        totalCount: rowsJson.data?.totalCount || 0
      });

    } catch (err) {
      setError(err.message || 'Failed to calculate analytics.');
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
    }
  }, [selectedDatasetId, filters, tablePage, tableLimit, tableSortKey, tableSortOrder, tableSearch]);

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
    }
  };

  const activeDataset = datasets.find(d => d.id === selectedDatasetId);

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
