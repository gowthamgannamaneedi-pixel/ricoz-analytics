import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
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
  Database,
  LayoutDashboard,
  Star,
  Edit3,
  Trash2,
  Sparkles,
  Lock,
  Layers,
  Activity,
  Gauge,
  Share2,
  MessageSquare,
  Bookmark
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import DatasetSelector from '../components/DatasetSelector';
import DynamicFilterBar from '../components/DynamicFilterBar';
import DynamicDataTable from '../components/DynamicDataTable';
import DashboardModal from '../components/DashboardModal';
import AddWidgetModal from '../components/AddWidgetModal';
import ShareModal from '../components/ShareModal';
import CommentsPanel from '../components/CommentsPanel';
import {
  getDashboards,
  getDashboardById,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  addWidget,
  updateWidget,
  deleteWidget,
  exportDashboardDirect,
  toggleFavoriteApi,
  getFavoritesApi,
  recordRecentlyViewedApi,
  createSavedViewApi,
  getSavedViewsApi,
  deleteSavedViewApi,
  API_BASE_URL
} from '../services/api';

const PIE_COLORS = ['#2563eb', '#0891b2', '#0d9488', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

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
  { order_id: 1010, region: 'Chennai', category: 'Software', channel: 'Retail Partners', sales_amount: 110000.0, units_sold: 7, profit: 29000.0, is_discounted: false, order_date: '2025-01-24' }
];

export default function DashboardPage() {
  const { token, isViewer } = useAuth();
  const navigate = useNavigate();

  // Multi-Dashboard Management State
  const [dashboards, setDashboards] = useState([]);
  const [activeDashboardId, setActiveDashboardId] = useState('overview'); // 'overview' or dashboard UUID
  const [activeDashboardData, setActiveDashboardData] = useState(null);
  const [isDashboardsLoading, setIsDashboardsLoading] = useState(false);

  // Modals State
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState(null);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);

  // Phase 17 Collaboration State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [savedViews, setSavedViews] = useState([]);
  const [isSavedViewModalOpen, setIsSavedViewModalOpen] = useState(false);
  const [newSavedViewName, setNewSavedViewName] = useState('');

  // Export Controls State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Saved Metrics for Widget Linking
  const [savedMetrics, setSavedMetrics] = useState([]);

  // Datasets List & Active Selection for Overview Mode
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

  // --------------------------------------------------------------------------
  // 1. Fetch Dashboards List
  // --------------------------------------------------------------------------
  const fetchDashboardsList = async () => {
    try {
      setIsDashboardsLoading(true);
      const res = await getDashboards();
      if (res && res.success && Array.isArray(res.data)) {
        setDashboards(res.data);
        // If a default dashboard exists and activeDashboardId is not set, select it
        const defaultDash = res.data.find(d => d.is_default);
        if (defaultDash && activeDashboardId === 'overview') {
          // Keep overview or optionally switch to default
        }
      }
    } catch (_) {
      // Graceful empty dashboards
    } finally {
      setIsDashboardsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 2. Fetch Single Dashboard Data with Widgets
  // --------------------------------------------------------------------------
  const fetchActiveDashboard = async (dashboardId) => {
    if (!dashboardId || dashboardId === 'overview') {
      setActiveDashboardData(null);
      return;
    }
    try {
      setIsAnalyticsLoading(true);
      const res = await getDashboardById(dashboardId);
      if (res && res.success && res.data) {
        setActiveDashboardData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard widgets.');
    } finally {
      setIsAnalyticsLoading(false);
      setIsRefreshing(false);
    }
  };

  // --------------------------------------------------------------------------
  // 3. Fetch Saved Metrics (Phase 7) for Widget Linking
  // --------------------------------------------------------------------------
  const fetchSavedMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSavedMetrics(json.data);
        }
      }
    } catch (_) {}
  };

  // --------------------------------------------------------------------------
  // 4. Fetch Datasets for Overview & Widget Binding
  // --------------------------------------------------------------------------
  const fetchDatasets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/datasets`, {
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
      setDatasets(FALLBACK_DATASETS);
    } catch (_) {
      setDatasets(FALLBACK_DATASETS);
    } finally {
      setIsDatasetsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardsList();
    fetchDatasets();
    fetchSavedMetrics();
  }, [token]);

  useEffect(() => {
    if (activeDashboardId && activeDashboardId !== 'overview') {
      fetchActiveDashboard(activeDashboardId);
      recordRecentlyViewedApi('dashboard', activeDashboardId).catch(() => {});
      getSavedViewsApi(activeDashboardId).then(res => setSavedViews(res.data || [])).catch(() => {});
      getFavoritesApi().then(res => {
        const isFav = res.data?.some(f => f.resource_type === 'dashboard' && String(f.resource_id) === String(activeDashboardId));
        setIsFavorite(Boolean(isFav));
      }).catch(() => {});
    } else {
      setIsFavorite(false);
      setSavedViews([]);
    }
  }, [activeDashboardId]);

  const handleToggleFavorite = async () => {
    if (activeDashboardId === 'overview') return;
    try {
      const res = await toggleFavoriteApi('dashboard', activeDashboardId);
      setIsFavorite(Boolean(res.data?.isFavorite));
    } catch (_) {}
  };

  const handleSaveCurrentView = async (e) => {
    e.preventDefault();
    if (!newSavedViewName.trim() || activeDashboardId === 'overview') return;
    try {
      await createSavedViewApi({
        dashboardId: activeDashboardId,
        name: newSavedViewName.trim(),
        filters
      });
      setNewSavedViewName('');
      setIsSavedViewModalOpen(false);
      const res = await getSavedViewsApi(activeDashboardId);
      setSavedViews(res.data || []);
    } catch (err) {
      alert(err.message || 'Failed to save view.');
    }
  };

  const handleApplySavedView = (view) => {
    if (view.filters) {
      setFilters(view.filters);
      setTablePage(1);
    }
  };

  const handleDeleteSavedView = async (viewId, e) => {
    e.stopPropagation();
    try {
      await deleteSavedViewApi(viewId);
      setSavedViews(savedViews.filter(v => v.id !== viewId));
    } catch (_) {}
  };

  // Client-Side Fallback Analytics Calculator (Phase 5)
  const computeFallbackAnalytics = useCallback(() => {
    let filtered = [...FALLBACK_ROWS];

    if (filters.region && filters.region !== 'all') {
      filtered = filtered.filter(r => r.region.toLowerCase() === filters.region.toLowerCase());
    }
    if (filters.channel && filters.channel !== 'all') {
      filtered = filtered.filter(r => r.channel.toLowerCase() === filters.channel.toLowerCase());
    }
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(r => r.category.toLowerCase() === filters.category.toLowerCase());
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      filtered = filtered.filter(r =>
        Object.values(r).some(val => String(val).toLowerCase().includes(q))
      );
    }

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

    const trendsMap = {};
    filtered.forEach(r => {
      const dateKey = r.order_date;
      if (!trendsMap[dateKey]) {
        trendsMap[dateKey] = { formattedDate: dateKey, revenue: 0, target: 80000 };
      }
      trendsMap[dateKey].revenue += r.sales_amount;
    });
    setTrendsData(Object.values(trendsMap));

    const regMap = {};
    filtered.forEach(r => {
      regMap[r.region] = (regMap[r.region] || 0) + r.sales_amount;
    });
    setRegionBreakdown(Object.entries(regMap).map(([category, value]) => ({ category, value })));

    const chanMap = {};
    filtered.forEach(r => {
      chanMap[r.channel] = (chanMap[r.channel] || 0) + r.sales_amount;
    });
    setChannelBreakdown(Object.entries(chanMap).map(([category, value]) => ({ category, value })));

    const catMap = {};
    filtered.forEach(r => {
      catMap[r.category] = (catMap[r.category] || 0) + r.sales_amount;
    });
    setProductBreakdown(Object.entries(catMap).map(([category, value]) => ({ category, value })));

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

    const startIdx = (tablePage - 1) * tableLimit;
    setTableData({
      rows: filtered.slice(startIdx, startIdx + tableLimit),
      totalCount: filtered.length
    });
  }, [filters, tableSearch, tableSortKey, tableSortOrder, tablePage, tableLimit]);

  const handleSelectDataset = (id) => {
    setSelectedDatasetId(id);
    localStorage.setItem('ricoz_active_dataset_id', String(id));
    setFilters({ dateRange: 'all' });
    setTablePage(1);
    setTableSearch('');
  };

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

  const fetchDatasetSummary = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/datasets/${id}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSummaryData(json.data);
      }
    } catch (_) {}
  };

  const fetchAnalytics = async (id, showLoading = true) => {
    if (showLoading) setIsAnalyticsLoading(true);
    setError('');

    try {
      const queryStr = buildQueryParams();

      const [kpisRes, trendsRes, regionRes, channelRes, productRes, rowsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/datasets/${id}/kpis?${queryStr}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/analytics/datasets/${id}/trends?${queryStr}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/analytics/datasets/${id}/breakdowns?${buildQueryParams({ groupBy: 'region' })}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/analytics/datasets/${id}/breakdowns?${buildQueryParams({ groupBy: 'channel' })}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/analytics/datasets/${id}/breakdowns?${buildQueryParams({ groupBy: 'product' })}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/analytics/datasets/${id}/rows?${buildQueryParams({
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
        computeFallbackAnalytics();
      }
    } catch (_) {
      computeFallbackAnalytics();
    } finally {
      setIsAnalyticsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeDashboardId === 'overview' && selectedDatasetId) {
      fetchDatasetSummary(selectedDatasetId);
      fetchAnalytics(selectedDatasetId, false);
    } else if (activeDashboardId === 'overview') {
      computeFallbackAnalytics();
    }
  }, [activeDashboardId, selectedDatasetId, filters, tablePage, tableLimit, tableSortKey, tableSortOrder, tableSearch]);

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
    if (activeDashboardId !== 'overview') {
      fetchActiveDashboard(activeDashboardId);
    } else if (selectedDatasetId) {
      fetchAnalytics(selectedDatasetId, false);
    } else {
      computeFallbackAnalytics();
      setIsRefreshing(false);
    }
  };

  // --------------------------------------------------------------------------
  // Dashboard Modal Handlers
  // --------------------------------------------------------------------------
  const handleSaveDashboard = async (payload) => {
    setIsModalSubmitting(true);
    try {
      if (editingDashboard && editingDashboard.id) {
        const res = await updateDashboard(editingDashboard.id, payload);
        if (res.success) {
          setIsDashboardModalOpen(false);
          setEditingDashboard(null);
          await fetchDashboardsList();
          if (activeDashboardId === editingDashboard.id) {
            fetchActiveDashboard(editingDashboard.id);
          }
        }
      } else {
        const res = await createDashboard(payload);
        if (res.success && res.data) {
          setIsDashboardModalOpen(false);
          await fetchDashboardsList();
          setActiveDashboardId(res.data.id);
        }
      }
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const handleDeleteDashboard = async (id) => {
    if (!window.confirm('Are you sure you want to delete this dashboard and all its widgets?')) {
      return;
    }
    try {
      await deleteDashboard(id);
      setActiveDashboardId('overview');
      await fetchDashboardsList();
    } catch (err) {
      alert(err.message || 'Failed to delete dashboard.');
    }
  };

  // --------------------------------------------------------------------------
  // Widget Modal Handlers
  // --------------------------------------------------------------------------
  const handleSaveWidget = async (payload) => {
    if (!activeDashboardId || activeDashboardId === 'overview') return;
    setIsModalSubmitting(true);
    try {
      if (editingWidget && editingWidget.id) {
        await updateWidget(activeDashboardId, editingWidget.id, payload);
      } else {
        await addWidget(activeDashboardId, payload);
      }
      setIsWidgetModalOpen(false);
      setEditingWidget(null);
      await fetchActiveDashboard(activeDashboardId);
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const handleDeleteWidget = async (widgetId) => {
    if (!window.confirm('Are you sure you want to remove this widget?')) return;
    try {
      await deleteWidget(activeDashboardId, widgetId);
      await fetchActiveDashboard(activeDashboardId);
    } catch (err) {
      alert(err.message || 'Failed to remove widget.');
    }
  };

  // --------------------------------------------------------------------------
  // Dashboard Export Handler
  // --------------------------------------------------------------------------
  const handleExportDashboard = async (format) => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    try {
      const currentDash = dashboards.find(d => d.id === activeDashboardId);
      await exportDashboardDirect({
        dashboard_id: activeDashboardId !== 'overview' ? activeDashboardId : null,
        format,
        title: currentDash ? currentDash.title : 'Executive Analytics Overview'
      });
    } catch (err) {
      alert(err.message || 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const activeDataset = datasets.find(d => d.id === selectedDatasetId) || datasets[0];

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val.toLocaleString()}`;
  };

  const currentDashboard = dashboards.find(d => d.id === activeDashboardId);
  const widgets = activeDashboardData?.widgets || [];

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Multi-Dashboard Tab Switcher & Navigation Header */}
      <div className="border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Dashboard Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
            {/* Built-in Standard Overview Tab */}
            <button
              type="button"
              onClick={() => setActiveDashboardId('overview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeDashboardId === 'overview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Telemetry Overview</span>
            </button>

            {/* Custom User / Org Dashboards */}
            {dashboards.map((d) => {
              const isActive = activeDashboardId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveDashboardId(d.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {d.is_default && (
                    <Star className={`h-3 w-3 ${isActive ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'}`} />
                  )}
                  <span>{d.title}</span>
                  {d.widget_count !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                      {d.widget_count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Create Dashboard Button (Forbidden for Viewers) */}
            {!isViewer && (
              <button
                type="button"
                onClick={() => {
                  setEditingDashboard(null);
                  setIsDashboardModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Dashboard</span>
              </button>
            )}
          </div>

          {/* Action Header on the Right */}
          <div className="flex items-center gap-2">
            {activeDashboardId !== 'overview' && (
              <>
                {/* Favorite Star Button */}
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`p-1.5 rounded-lg border transition ${
                    isFavorite
                      ? 'bg-amber-50 border-amber-300 text-amber-500'
                      : 'border-slate-200 bg-white text-slate-400 hover:text-amber-500 hover:bg-slate-50'
                  }`}
                  title={isFavorite ? 'Bookmarked in Favorites' : 'Bookmark Dashboard'}
                >
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
                </button>

                {/* Saved Views Preset Dropdown */}
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value === '__save_new__') {
                        setIsSavedViewModalOpen(true);
                      } else if (e.target.value) {
                        const sv = savedViews.find(v => String(v.id) === e.target.value);
                        if (sv) handleApplySavedView(sv);
                      }
                    }}
                    defaultValue=""
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 focus:outline-none"
                  >
                    <option value="" disabled>Saved Views ({savedViews.length})</option>
                    <option value="__save_new__">+ Save Current Filters...</option>
                    {savedViews.map(sv => (
                      <option key={sv.id} value={sv.id}>{sv.name}</option>
                    ))}
                  </select>
                </div>

                {/* Share Dashboard Button */}
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  title="Share Dashboard with Teammates"
                >
                  <Share2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>Share</span>
                </button>

                {/* Threaded Discussion Comments Button */}
                <button
                  type="button"
                  onClick={() => setIsCommentsPanelOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  title="Open Discussion & Annotations"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Discussion</span>
                </button>
              </>
            )}

            {activeDashboardId !== 'overview' && currentDashboard && !isViewer && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingWidget(null);
                    setIsWidgetModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Widget</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingDashboard(currentDashboard);
                    setIsDashboardModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteDashboard(currentDashboard.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {activeDashboardId === 'overview' && (
              <button
                type="button"
                onClick={() => navigate('/datasets')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <Table2 className="h-3.5 w-3.5 text-slate-500" />
                <span>Manage Datasets</span>
              </button>
            )}

            {/* Ask AI Analytics Assistant Quick Launch */}
            <button
              type="button"
              onClick={() => navigate('/ai-insights')}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700 transition shadow-xs"
              title="Query data with AI Analytics Assistant"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask AI</span>
            </button>

            {/* Export Dropdown Menu (Phase 9) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={isExporting}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span>Export</span>
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-44 rounded-lg bg-white border border-slate-200 shadow-xl z-50 py-1 font-sans text-xs">
                  <button
                    type="button"
                    onClick={() => handleExportDashboard('pdf')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">PDF</span>
                    <span>Executive PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportDashboard('excel')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">XLSX</span>
                    <span>Excel Workbook</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportDashboard('csv')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">CSV</span>
                    <span>Raw CSV Data</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportDashboard('json')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">JSON</span>
                    <span>Structured JSON</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Current Active Dashboard Title & Description */}
        {activeDashboardId !== 'overview' && currentDashboard && (
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{currentDashboard.title}</h1>
                {currentDashboard.is_default && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Default
                  </span>
                )}
              </div>
              {currentDashboard.description && (
                <p className="text-xs text-slate-500 mt-0.5">{currentDashboard.description}</p>
              )}
            </div>
            {isViewer && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                <Lock className="h-3.5 w-3.5" /> Read-Only Mode
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-bold">Dashboard Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 3. CUSTOM DASHBOARD VIEW: Render Interactive Widgets Grid           */}
      {/* -------------------------------------------------------------------- */}
      {activeDashboardId !== 'overview' && (
        <div className="space-y-6">
          {isAnalyticsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-xs font-semibold text-slate-600">Loading dashboard widgets...</p>
            </div>
          ) : widgets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center max-w-lg mx-auto my-8 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No Widgets on this Dashboard</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Customize this view by adding KPI stat cards, time-series charts, breakdown pies, and tables.
              </p>
              {!isViewer && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingWidget(null);
                    setIsWidgetModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add First Widget</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {widgets.map((w) => {
                const spanClass = w.position?.w === 12
                  ? 'md:col-span-12'
                  : w.position?.w === 4
                  ? 'md:col-span-4'
                  : 'md:col-span-6';

                return (
                  <div
                    key={w.id}
                    className={`${spanClass} col-span-12 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between`}
                  >
                    {/* Widget Card Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{w.title}</h3>
                        <p className="text-[11px] text-slate-500">
                          {w.dataset_name ? `Dataset: ${w.dataset_name}` : (w.metric_name ? `KPI: ${w.metric_name}` : 'Live Analytics')}
                        </p>
                      </div>
                      {!isViewer && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWidget(w);
                              setIsWidgetModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="Edit Widget"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWidget(w.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Widget"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Widget Content based on Type */}
                    <div className="py-2 flex-1 flex flex-col justify-center">
                      {/* 1. KPI Card */}
                      {w.type === 'kpi_card' && (
                        <div className="space-y-3">
                          <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                              {typeof w.current_value === 'number' ? formatCurrency(w.current_value) : w.current_value}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              w.status === 'on_track'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : w.status === 'at_risk'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {w.status === 'on_track' ? 'On Track' : (w.status === 'at_risk' ? 'At Risk' : 'Behind')}
                            </span>
                          </div>

                          {w.metric_target_value && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                                <span>Goal: {formatCurrency(w.metric_target_value)}</span>
                                <span className="font-bold text-slate-800">{w.progress_pct}%</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    w.status === 'on_track' ? 'bg-emerald-500' : w.status === 'at_risk' ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(w.progress_pct || 0, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 1b. AI Automated Insights Card */}
                      {(w.type === 'ai_insights' || w.type === 'executive_insights') && (
                        <div className="p-3 bg-gradient-to-br from-indigo-950/20 via-slate-50 to-purple-950/10 rounded-xl border border-indigo-200/60 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                              <span>AI Telemetry Intelligence</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate('/ai-insights')}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              Explore Insights →
                            </button>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">
                            {w.ai_insights?.executive_summary || 'Telemetry and statistical trends are actively monitored. No anomalies detected.'}
                          </p>
                          {w.ai_insights?.insights && w.ai_insights.insights.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {w.ai_insights.insights.slice(0, 2).map((ins, idx) => (
                                <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                                  {ins.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Metric Gauge */}
                      {w.type === 'metric_gauge' && (
                        <div className="flex flex-col items-center justify-center p-4 space-y-2 text-center">
                          <div className="relative flex items-center justify-center">
                            <Gauge className="h-16 w-16 text-blue-600" />
                            <span className="absolute text-sm font-bold font-mono text-slate-900">
                              {w.progress_pct}%
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            {typeof w.current_value === 'number' ? formatCurrency(w.current_value) : w.current_value}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Target: {formatCurrency(w.metric_target_value || w.configuration?.targetValue || 0)}
                          </span>
                        </div>
                      )}

                      {/* 3. Line Chart */}
                      {w.type === 'line_chart' && (
                        <div className="h-56 w-full">
                          {w.chart_data && w.chart_data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={w.chart_data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                                <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex items-center justify-center h-full text-xs text-slate-400">
                              No data records available.
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. Bar Chart */}
                      {w.type === 'bar_chart' && (
                        <div className="h-56 w-full">
                          {w.chart_data && w.chart_data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={w.chart_data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                                <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                                <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex items-center justify-center h-full text-xs text-slate-400">
                              No data records available.
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5. Pie Chart */}
                      {w.type === 'pie_chart' && (
                        <div className="h-56 w-full">
                          {w.chart_data && w.chart_data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={w.chart_data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={75}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {w.chart_data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex items-center justify-center h-full text-xs text-slate-400">
                              No categorical records available.
                            </div>
                          )}
                        </div>
                      )}

                      {/* 6. Area Chart */}
                      {w.type === 'area_chart' && (
                        <div className="h-56 w-full">
                          {w.chart_data && w.chart_data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={w.chart_data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                <defs>
                                  <linearGradient id={`colorArea_${w.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                                <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                                <Area type="monotone" dataKey="value" stroke="#2563eb" fillOpacity={1} fill={`url(#colorArea_${w.id})`} />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex items-center justify-center h-full text-xs text-slate-400">
                              No time-series data available.
                            </div>
                          )}
                        </div>
                      )}

                      {/* 7. Table Preview */}
                      {w.type === 'table' && (
                        <div className="overflow-x-auto max-h-52">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                                <th className="p-2">Name</th>
                                <th className="p-2 text-right">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(w.chart_data || []).map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="p-2 font-medium text-slate-800">{row.name}</td>
                                  <td className="p-2 text-right font-mono text-slate-900">{formatCurrency(row.value)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 4. OVERVIEW MODE: Built-in Single Dataset Analytics Engine (Phase 5)  */}
      {/* -------------------------------------------------------------------- */}
      {activeDashboardId === 'overview' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Telemetry Overview
                </h2>
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
                    {summaryData?.filterOptions?.dateBounds?.min && summaryData?.filterOptions?.dateBounds?.max && (
                      <span> · Timeline: {summaryData.filterOptions.dateBounds.min} to {summaryData.filterOptions.dateBounds.max}</span>
                    )}
                    <span> · {activeDataset.row_count?.toLocaleString()} records ingested</span>
                  </>
                ) : (
                  'Multi-channel enterprise telemetry'
                )}
              </p>
            </div>
          </div>

          {/* Global Filter Strip */}
          <DynamicFilterBar
            filters={filters}
            filterOptions={summaryData?.filterOptions || {}}
            dimensions={summaryData?.dimensions || {}}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />

          {/* Dynamic KPI Section */}
          {kpiData ? (
            <section className="rounded-xl border border-slate-200 bg-white divide-y sm:divide-y-0 sm:divide-x divide-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden shadow-2xs">
              <StatCard
                title={`Total ${summaryData?.dimensions?.primaryMetric || 'Sales'}`}
                value={formatCurrency(kpiData.totalSales)}
                change={kpiData.comparison?.salesChange}
                isPositive={kpiData.comparison?.isSalesPositive}
                period={kpiData.comparison?.periodLabel || 'calculated sum'}
                subtext={`Min: ${formatCurrency(kpiData.minSales)} · Max: ${formatCurrency(kpiData.maxSales)}`}
                isPrimary={true}
              />
              <StatCard
                title="Total Orders"
                value={kpiData.totalOrders.toLocaleString()}
                change={kpiData.comparison?.ordersChange}
                isPositive={kpiData.comparison?.isOrdersPositive}
                period={kpiData.comparison?.periodLabel || 'volume count'}
                subtext={`${kpiData.recordCount?.toLocaleString() || 0} total rows`}
              />
              <StatCard
                title={`Total ${summaryData?.dimensions?.quantityMetric || 'Units'}`}
                value={kpiData.totalQuantity.toLocaleString()}
                period="units processed"
                subtext={`${summaryData?.dimensions?.quantityMetric ? 'Aggregated quantity' : 'Transaction count'}`}
              />
              <StatCard
                title="Average Order Value"
                value={formatCurrency(kpiData.averageOrderValue)}
                period="per transaction"
                subtext={`Avg across ${kpiData.totalOrders.toLocaleString()} orders`}
              />
            </section>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
              No numeric fields available for KPI analysis.
            </div>
          )}

          {/* Visualizations Row 1: Time-Series Trend + Regional Commercial Hubs */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              title={`${summaryData?.dimensions?.primaryMetric || 'Sales'} Realization Trend`}
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
                    <XAxis dataKey="formattedDate" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`} />
                    <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                    <Line type="monotone" dataKey="revenue" name={summaryData?.dimensions?.primaryMetric || 'Revenue'} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3.5, fill: '#2563eb', strokeWidth: 1.5, stroke: '#FFFFFF' }} activeDot={{ r: 5, fill: '#2563eb' }} />
                    <Line type="monotone" dataKey="target" name="Baseline Benchmark" stroke="#94a3b8" strokeWidth={1.75} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Regional Performance"
              subtitle={`Top ${summaryData?.dimensions?.regionColumn || 'regions'} by volume`}
            >
              {regionBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-56 text-xs text-slate-400">
                  No region column identified in dataset.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={regionBreakdown.slice(0, 6)} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`} />
                    <YAxis type="category" dataKey="category" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} width={80} />
                    <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                    <Bar dataKey="value" name={summaryData?.dimensions?.primaryMetric || 'Revenue'} fill="#2563eb" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </section>

          {/* Visualizations Row 2: Sales Channel Breakdown + Product Performance */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Channel Distribution"
              subtitle={`Commercial share across ${summaryData?.dimensions?.channelColumn || 'channels'}`}
            >
              {channelBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-56 text-xs text-slate-400">
                  No channel dimension detected.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={channelBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="category" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`} />
                    <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                    <Bar dataKey="value" name={summaryData?.dimensions?.primaryMetric || 'Sales'} fill="#0891b2" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Product Breakdown"
              subtitle={`Revenue distribution across ${summaryData?.dimensions?.productColumn || summaryData?.dimensions?.categoryColumn || 'products'}`}
            >
              {productBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-56 text-xs text-slate-400">
                  No product or category column detected.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={productBreakdown.slice(0, 6)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="category" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`} />
                    <Tooltip content={<EnterpriseTooltip prefix="₹" />} />
                    <Bar dataKey="value" name={summaryData?.dimensions?.primaryMetric || 'Sales'} fill="#2563eb" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </section>

          {/* Dynamic Paginated Data Table */}
          <section>
            <DynamicDataTable
              columns={summaryData?.dataset?.schema || []}
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
      )}

      {/* Modals */}
      <DashboardModal
        isOpen={isDashboardModalOpen}
        onClose={() => {
          setIsDashboardModalOpen(false);
          setEditingDashboard(null);
        }}
        onSave={handleSaveDashboard}
        dashboard={editingDashboard}
        isLoading={isModalSubmitting}
      />

      <AddWidgetModal
        isOpen={isWidgetModalOpen}
        onClose={() => {
          setIsWidgetModalOpen(false);
          setEditingWidget(null);
        }}
        onSave={handleSaveWidget}
        datasets={datasets}
        metrics={savedMetrics}
        widget={editingWidget}
        isLoading={isModalSubmitting}
      />

      {/* Collaboration Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        resourceType="dashboard"
        resourceId={activeDashboardId}
        resourceTitle={currentDashboard?.title || 'Dashboard'}
      />

      {/* Collaboration Threaded Comments Panel */}
      <CommentsPanel
        isOpen={isCommentsPanelOpen}
        onClose={() => setIsCommentsPanelOpen(false)}
        resourceType="dashboard"
        resourceId={activeDashboardId}
        resourceTitle={currentDashboard?.title || 'Dashboard'}
      />

      {/* Save View Modal */}
      {isSavedViewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Save Current Filter View</h3>
            <form onSubmit={handleSaveCurrentView} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">View Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. South Region Q1 Filters"
                  value={newSavedViewName}
                  onChange={(e) => setNewSavedViewName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSavedViewModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newSavedViewName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
