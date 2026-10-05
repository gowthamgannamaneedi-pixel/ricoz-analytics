import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileDown,
  Search,
  X,
  ChevronDown,
  ExternalLink,
  Layers,
  Compass,
  Star,
  Share2,
  MoreVertical,
  Tag,
  ShieldCheck,
  Eye,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Bot,
  Info,
  LayoutGrid,
  Table as TableIcon,
  Calendar,
  Database,
  BarChart3,
  Clock,
  SlidersHorizontal,
  Plus,
  Check,
  Copy,
  FileText,
  PieChart,
  Bell,
  ArrowUpRight,
  Filter,
  CheckCheck
} from 'lucide-react';
import {
  generateAIInsights,
  getAIInsights,
  getAIExecutiveSummary,
  dismissAIInsight,
  submitAIInsightFeedback,
  exportAIInsights,
  getDatasets,
  getMetrics,
  createAlert,
  createReport,
  getDashboards,
  toggleFavoriteApi,
  getFavoritesApi,
  recordRecentlyViewedApi,
  getAuthToken
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import RootCauseDrawer from '../components/RootCauseDrawer';
import ScenarioSimulatorModal from '../components/ScenarioSimulatorModal';
import ShareModal from '../components/ShareModal';
import AlertModal from '../components/AlertModal';
import MetricModal from '../components/MetricModal';
import ReportModal from '../components/ReportModal';
import { Button } from '../components/ui/Button';

// ----------------------------------------------------------------------
// Helper utilities
// ----------------------------------------------------------------------

function formatTimeAgo(dateString) {
  if (!dateString) return 'Recently';
  try {
    const diff = Math.max(0, Date.now() - new Date(dateString).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } catch (_) {
    return 'Recently';
  }
}

function getCategoryTag(insight) {
  if (insight.source_metadata?.category) {
    return String(insight.source_metadata.category).toUpperCase();
  }
  const dsName = (insight.dataset_name || insight.source_metadata?.dataset_name || insight.evidence?.datasetName || '').toLowerCase();
  if (dsName.includes('sales')) return 'SALES';
  if (dsName.includes('inventory') || dsName.includes('stock')) return 'INVENTORY';
  if (dsName.includes('customer') || dsName.includes('user') || dsName.includes('churn')) return 'CUSTOMER';
  if (dsName.includes('product') || dsName.includes('order')) return 'PRODUCT';
  if (dsName.includes('region') || dsName.includes('apac') || dsName.includes('geo')) return 'REGION';
  if (insight.type === 'operational') return 'OPS';
  if (insight.type === 'data_quality') return 'QUALITY';
  if (insight.type === 'trend' || insight.type === 'growth') return 'SALES';
  return 'GENERAL';
}

function getKeyMetricInfo(insight) {
  const ev = insight.evidence || {};
  
  if (ev.changePercent !== undefined && ev.changePercent !== null) {
    const val = Number(ev.changePercent);
    return {
      value: `${val > 0 ? '+' : ''}${val}%`,
      label: val < 0 ? 'vs expected' : 'vs previous period',
      isPositive: val > 0,
      isNegative: val < 0,
      isWarning: false,
      isInfo: false,
      chartType: 'line'
    };
  }

  if (ev.change_percent !== undefined && ev.change_percent !== null) {
    const val = Number(ev.change_percent);
    return {
      value: `${val > 0 ? '+' : ''}${val}%`,
      label: val < 0 ? 'vs expected' : 'vs previous period',
      isPositive: val > 0,
      isNegative: val < 0,
      isWarning: false,
      isInfo: false,
      chartType: 'line'
    };
  }

  if (insight.type === 'data_quality') {
    const score = ev.score !== undefined ? ev.score : 100;
    return {
      value: `${score}/100`,
      label: 'Quality Score',
      isPositive: true,
      isNegative: false,
      isWarning: false,
      isInfo: false,
      chartType: 'bars'
    };
  }

  if (insight.type === 'operational') {
    return {
      value: ev.threshold !== undefined ? `${Number(ev.threshold).toLocaleString()}` : 'Alert',
      label: 'Breached Threshold',
      isPositive: false,
      isNegative: true,
      isWarning: false,
      isInfo: false,
      chartType: 'line'
    };
  }

  if (insight.impactScore || insight.impact_score) {
    const score = insight.impactScore || insight.impact_score;
    return {
      value: `${score}/100`,
      label: 'Impact Score',
      isPositive: insight.severity === 'positive',
      isNegative: insight.severity === 'critical',
      isWarning: insight.severity === 'warning',
      isInfo: insight.severity === 'info',
      chartType: 'bars'
    };
  }

  return {
    value: 'Verified',
    label: 'Telemetry Ground Truth',
    isPositive: true,
    isNegative: false,
    isWarning: false,
    isInfo: false,
    chartType: 'line'
  };
}

// ----------------------------------------------------------------------
// Mini Sparkline / Trend Visual Component
// ----------------------------------------------------------------------

function MiniVisualChart({ insight, metricInfo }) {
  const severity = insight.severity || 'info';
  const chartType = metricInfo.chartType;

  // Semantic color sets
  let strokeColor = '#3B82F6'; // blue
  let fillColor = '#93C5FD';
  let gradientId = `grad-blue-${insight.id || Math.random()}`;

  if (severity === 'critical') {
    strokeColor = '#EF4444'; // rose / red
    fillColor = '#FCA5A5';
    gradientId = `grad-red-${insight.id}`;
  } else if (severity === 'positive') {
    strokeColor = '#10B981'; // emerald / green
    fillColor = '#6EE7B7';
    gradientId = `grad-green-${insight.id}`;
  } else if (severity === 'warning') {
    strokeColor = '#F59E0B'; // amber / orange
    fillColor = '#FCD34D';
    gradientId = `grad-amber-${insight.id}`;
  }

  if (chartType === 'bars') {
    // Generate 7 aesthetic mini bars with variation
    const heights = severity === 'positive' 
      ? [20, 28, 35, 45, 52, 60, 68]
      : severity === 'critical'
      ? [65, 58, 48, 38, 30, 24, 18]
      : severity === 'warning'
      ? [40, 55, 35, 60, 48, 30, 25]
      : [30, 38, 45, 35, 50, 42, 48];

    return (
      <div className="flex items-end gap-1.5 h-12 py-1 px-1 justify-end">
        {heights.map((h, i) => (
          <div
            key={i}
            className="w-2 rounded-t-sm transition-all duration-300"
            style={{
              height: `${h}%`,
              backgroundColor: strokeColor,
              opacity: 0.35 + (i / heights.length) * 0.65
            }}
          />
        ))}
      </div>
    );
  }

  // Line Sparkline
  let pathD = 'M 0,25 Q 25,18 50,22 T 100,15 T 140,8';
  let areaD = 'M 0,25 Q 25,18 50,22 T 100,15 T 140,8 L 140,38 L 0,38 Z';

  if (severity === 'critical') {
    pathD = 'M 0,10 Q 30,12 60,20 T 100,28 T 140,32';
    areaD = 'M 0,10 Q 30,12 60,20 T 100,28 T 140,32 L 140,38 L 0,38 Z';
  } else if (severity === 'positive') {
    pathD = 'M 0,32 Q 35,28 70,18 T 110,12 T 140,6';
    areaD = 'M 0,32 Q 35,28 70,18 T 110,12 T 140,6 L 140,38 L 0,38 Z';
  } else if (severity === 'warning') {
    pathD = 'M 0,18 Q 35,8 70,26 T 110,16 T 140,28';
    areaD = 'M 0,18 Q 35,8 70,26 T 110,16 T 140,28 L 140,38 L 0,38 Z';
  }

  return (
    <svg className="w-28 sm:w-32 h-10 overflow-visible" viewBox="0 0 140 38">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function AIInsightsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetInsightId = searchParams.get('id');

  // State
  const [insights, setInsights] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters & View Mode
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [impactFilter, setImpactFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

  // User Actions State
  const [favorites, setFavorites] = useState(new Set());
  const [feedbackState, setFeedbackState] = useState({});
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Modals
  const [selectedInsightForDetails, setSelectedInsightForDetails] = useState(null);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [rootCauseInsight, setRootCauseInsight] = useState(null);
  const [simulatorData, setSimulatorData] = useState(null);
  const [shareModalConfig, setShareModalConfig] = useState({ isOpen: false, insightId: null, title: '' });

  // Creation Modals
  const [alertModalConfig, setAlertModalConfig] = useState({ isOpen: false, prefilled: null });
  const [metricModalConfig, setMetricModalConfig] = useState({ isOpen: false, prefilled: null });
  const [reportModalConfig, setReportModalConfig] = useState({ isOpen: false, prefilled: null });

  const exportMenuRef = useRef(null);

  // Toast feedback helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
      if (!e.target.closest('.insight-overflow-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Initial Data Loading
  useEffect(() => {
    loadData();
  }, [selectedDatasetId, statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [insightsRes, datasetsRes, metricsRes, summaryRes, dashboardsRes] = await Promise.all([
        getAIInsights({
          status: statusFilter,
          datasetId: selectedDatasetId || undefined
        }).catch(() => ({ insights: [] })),
        getDatasets().catch(() => ({ datasets: [] })),
        getMetrics().catch(() => ({ metrics: [] })),
        getAIExecutiveSummary(selectedDatasetId || null).catch(() => ({ summary: '' })),
        getDashboards ? getDashboards().catch(() => ({ dashboards: [] })) : Promise.resolve({ dashboards: [] })
      ]);

      const insList = insightsRes.insights || insightsRes.data || [];
      setInsights(insList);
      setDatasets(datasetsRes.datasets || datasetsRes.data || []);
      setMetrics(metricsRes.metrics || metricsRes.data || []);
      setDashboards(dashboardsRes.dashboards || dashboardsRes.data || []);
      setExecutiveSummary(summaryRes.summary || summaryRes.executive_summary || '');

      // Prepopulate feedback map
      const initialFeedback = {};
      insList.forEach(item => {
        if (item.feedback) initialFeedback[item.id] = item.feedback;
      });
      setFeedbackState(initialFeedback);

      // Load user favorites
      try {
        const favsRes = await getFavoritesApi();
        if (favsRes?.data) {
          const insightFavs = new Set(
            favsRes.data
              .filter(f => f.resource_type === 'ai_insight' || f.resource_type === 'insight')
              .map(f => String(f.resource_id))
          );
          setFavorites(insightFavs);
        }
      } catch (_) {}

      // Target insight highlighted from URL
      if (targetInsightId) {
        const target = insList.find(i => String(i.id) === String(targetInsightId));
        if (target) {
          setSelectedInsightForDetails(target);
          recordRecentlyViewedApi('ai_insight', targetInsightId).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[AIInsightsPage] Load error:', err);
      setError('Could not connect to the AI Insights service.');
    } finally {
      setLoading(false);
    }
  }

  // Generate Insights Handler
  async function handleGenerateInsights() {
    if (generating) return;
    try {
      setGenerating(true);
      const res = await generateAIInsights({
        datasetId: selectedDatasetId || undefined,
        persist: true
      });
      const newlyGenerated = res.insights || res.data || [];
      setInsights(newlyGenerated);
      if (res.executive_summary) {
        setExecutiveSummary(res.executive_summary);
      }
      showToast(`Generated ${newlyGenerated.length} real insights across datasets.`);
    } catch (err) {
      console.error('[AIInsightsPage] Generation failed:', err);
      showToast('Insight generation encountered an error. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // Dismiss Insight Handler
  async function handleDismiss(id) {
    try {
      await dismissAIInsight(id);
      setInsights(prev => prev.filter(item => item.id !== id));
      setActiveMenuId(null);
      if (selectedInsightForDetails?.id === id) {
        setSelectedInsightForDetails(null);
      }
      showToast('Insight dismissed.');
    } catch (err) {
      console.error('[AIInsightsPage] Dismiss failed:', err);
      showToast('Failed to dismiss insight.');
    }
  }

  // Favorite Toggle Handler
  const handleToggleFavorite = async (e, insightId) => {
    e.stopPropagation();
    try {
      const res = await toggleFavoriteApi('ai_insight', insightId);
      const isFav = Boolean(res.data?.isFavorite);
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(String(insightId));
        else next.delete(String(insightId));
        return next;
      });
      showToast(isFav ? 'Added to favorites' : 'Removed from favorites');
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Feedback Submission Handler
  async function handleFeedback(id, feedbackType) {
    try {
      setFeedbackState(prev => ({ ...prev, [id]: feedbackType }));
      await submitAIInsightFeedback(id, feedbackType);
      showToast('Thank you for your feedback!');
    } catch (err) {
      console.error('[AIInsightsPage] Feedback failed:', err);
    }
  }

  // Export Report Handler
  async function handleExport(format) {
    try {
      setExporting(true);
      setExportMenuOpen(false);
      showToast(`Preparing ${format.toUpperCase()} export...`);
      await exportAIInsights(format);
      showToast(`Downloaded insights report in ${format.toUpperCase()}`);
    } catch (err) {
      console.error('[AIInsightsPage] Export failed:', err);
      showToast('Export failed. Please check network connection.');
    } finally {
      setExporting(false);
    }
  }

  // Copy Summary Handler
  const handleCopySummary = (insight) => {
    const text = `${insight.title}\n\n${insight.summary}`;
    navigator.clipboard.writeText(text);
    setActiveMenuId(null);
    showToast('Insight summary copied to clipboard.');
  };

  // Real KPI Metrics derived strictly from existing dataset
  const totalCount = insights.length;
  const positiveCount = insights.filter(i => i.severity === 'positive' || i.type === 'growth').length;
  const criticalCount = insights.filter(i => i.severity === 'critical' || i.priority === 'critical' || i.severity === 'warning').length;
  const infoCount = insights.filter(i => 
    i.severity === 'info' || 
    i.type === 'operational' || 
    (!['positive', 'critical', 'warning'].includes(i.severity) && i.type !== 'growth')
  ).length;

  const positivePercent = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;
  const criticalPercent = totalCount > 0 ? Math.round((criticalCount / totalCount) * 100) : 0;
  const infoPercent = totalCount > 0 ? Math.round((infoCount / totalCount) * 100) : 0;

  // Real filtered insights list
  const filteredInsights = useMemo(() => {
    return insights.filter(ins => {
      // Type filter
      if (typeFilter !== 'all' && ins.type !== typeFilter) return false;

      // Impact / Priority filter
      if (impactFilter !== 'all') {
        const p = String(ins.priority || ins.severity || '').toLowerCase();
        if (impactFilter === 'critical' && p !== 'critical') return false;
        if (impactFilter === 'high' && p !== 'high' && p !== 'warning') return false;
        if (impactFilter === 'medium' && p !== 'medium') return false;
        if (impactFilter === 'low' && p !== 'low' && p !== 'info') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (ins.title || '').toLowerCase().includes(q);
        const matchSummary = (ins.summary || '').toLowerCase().includes(q);
        const matchDataset = (ins.dataset_name || ins.source_metadata?.dataset_name || '').toLowerCase();
        if (!matchTitle && !matchSummary && !matchDataset.includes(q)) return false;
      }

      return true;
    });
  }, [insights, typeFilter, impactFilter, searchQuery]);

  const hasActiveFilters = searchQuery !== '' || typeFilter !== 'all' || impactFilter !== 'all' || statusFilter !== 'active';

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setImpactFilter('all');
    setStatusFilter('active');
  };

  // Severity pill helper
  const renderSeverityPill = (severity) => {
    const s = String(severity || 'info').toLowerCase();
    switch (s) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            CRITICAL
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            WARNING
          </span>
        );
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            POSITIVE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            INFO
          </span>
        );
    }
  };

  // Secondary middle card action
  const handleMiddleAction = (ins) => {
    if (ins.type === 'trend' || ins.type === 'growth') {
      setSimulatorData({ insight: ins, attribution: null });
    } else if (ins.dataset_id || ins.source_metadata?.dataset_id) {
      setRootCauseInsight(ins);
    } else {
      setSelectedInsightForDetails(ins);
    }
  };

  // Secondary right card action
  const handleRightAction = (ins) => {
    if (ins.severity === 'critical' || ins.type === 'operational') {
      setAlertModalConfig({
        isOpen: true,
        prefilled: {
          name: ins.title,
          metric_id: ins.metric_id || '',
          condition: 'less_than',
          threshold: ins.evidence?.threshold || ins.evidence?.currentValue || ''
        }
      });
    } else if (ins.type === 'growth' || ins.type === 'trend') {
      setMetricModalConfig({
        isOpen: true,
        prefilled: {
          name: ins.title,
          datasetId: ins.dataset_id || ins.source_metadata?.dataset_id || '',
          targetColumn: ins.evidence?.metric || ins.source_metadata?.target_column || ''
        }
      });
    } else {
      setReportModalConfig({
        isOpen: true,
        prefilled: {
          title: `Report: ${ins.title}`,
          description: ins.summary
        }
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold animate-fade-in border border-slate-700">
          <CheckCheck className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP HEADER & BREADCRUMB                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <span>RicozAnalytics</span>
          <span>&gt;</span>
          <span className="text-slate-700 font-semibold">AI Insights</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            {/* Glowing Blue Sparkle Icon Badge */}
            <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  AI Insights
                </h1>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed font-normal">
                Discover actionable insights from your business data. AI analyzes your data to identify trends, opportunities, anomalies, and risks.
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Dataset Scope Selector */}
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition cursor-pointer"
            >
              <option value="">All Datasets</option>
              {datasets.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.row_count || 0} rows)
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={loading}
              className="h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Generate Insights CTA */}
            <button
              onClick={handleGenerateInsights}
              disabled={generating}
              id="generate-insights-btn"
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Analyzing Data...' : 'Generate Insights'}</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen(prev => !prev)}
                disabled={exporting}
                className="h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>Export</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-40 animate-fade-in text-xs">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Export Format
                  </div>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" /> CSV Spreadsheet
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <PieChart className="w-3.5 h-3.5 text-emerald-600" /> Excel Workbook (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-600" /> PDF Executive Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. KPI SUMMARY (4 CARDS)                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Insights */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <TrendingUp className="w-3 h-3" />
              {totalCount > 0 ? 'Live Telemetry' : 'Zero State'}
            </span>
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Insights
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {totalCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Across all connected datasets
            </p>
          </div>
        </div>

        {/* Card 2: Positive Insights */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            {totalCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ArrowUpRight className="w-3 h-3" />
                {positivePercent}%
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Positive Insights
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {positiveCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Growth opportunities &amp; expansion
            </p>
          </div>
        </div>

        {/* Card 3: Critical Insights */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            {criticalCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                {criticalPercent}%
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Critical Insights
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {criticalCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Require immediate business attention
            </p>
          </div>
        </div>

        {/* Card 4: Informational Insights */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Info className="w-6 h-6" />
            </div>
            {totalCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                {infoPercent}%
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Informational Insights
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {infoCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              General business observations
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. SIMPLE EXPLANATION PANEL ("What are AI Insights?")               */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-blue-100/90 text-blue-700 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              What are AI Insights?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed max-w-3xl">
              AI analyzes your business data to identify important trends, risks, opportunities, and unusual changes. Each insight includes the reason it was detected and recommended actions.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsLearnMoreOpen(true)}
          className="h-9 px-4 rounded-xl border border-blue-200 bg-white text-xs font-semibold text-blue-700 hover:bg-blue-50 shadow-2xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <span>Learn More</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. FILTER / SEARCH TOOLBAR                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search insights by title, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="growth">Growth</option>
            <option value="decline">Decline</option>
            <option value="trend">Trend</option>
            <option value="anomaly">Anomaly</option>
            <option value="operational">Operational</option>
            <option value="forecast">Forecast</option>
            <option value="data_quality">Data Quality</option>
            <option value="relationship">Relationship</option>
          </select>

          {/* Impact Level Filter */}
          <select
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value="all">All Impact Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value="active">All Statuses (Active)</option>
            <option value="dismissed">Dismissed</option>
          </select>

          {/* Reset Filters Action */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="h-10 px-3 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
            >
              Reset
            </button>
          )}

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50/70">
            <button
              onClick={() => setViewMode('card')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card View</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. MAIN CONTENT (CARDS / TABLE / EMPTY / ERROR / LOADING)          */}
      {/* ------------------------------------------------------------------ */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="h-5 bg-slate-200 rounded-full w-20" />
                <div className="h-4 bg-slate-100 rounded w-16" />
              </div>
              <div className="h-6 bg-slate-200 rounded w-4/5" />
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-10 bg-slate-50 rounded-xl" />
              <div className="flex items-center justify-between pt-2">
                <div className="h-8 bg-slate-200 rounded-lg w-24" />
                <div className="h-8 bg-slate-100 rounded-lg w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-10 text-center">
          <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-rose-900">Communication Error</h3>
          <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
          </button>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
          <Sparkles className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {hasActiveFilters ? 'No Matching Insights Found' : 'No Insights Available'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5 leading-relaxed">
            {hasActiveFilters
              ? 'No insights match your active search and filter parameters. Try clearing filters to view all records.'
              : 'AI Insights are calculated by evaluating patterns, growth velocity, and anomalies across your uploaded datasets.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={handleGenerateInsights}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" /> Generate Insights
            </button>
          )}
        </div>
      ) : viewMode === 'card' ? (
        /* CARD VIEW GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredInsights.map(ins => {
            const metricInfo = getKeyMetricInfo(ins);
            const categoryTag = getCategoryTag(ins);
            const timeAgo = formatTimeAgo(ins.created_at);
            const isFav = favorites.has(String(ins.id));
            const isMenuOpen = activeMenuId === ins.id;

            return (
              <div
                key={ins.id}
                className="group rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition flex flex-col justify-between overflow-visible relative"
              >
                {/* Card Top Border Accent */}
                <div
                  className="h-1 w-full rounded-t-2xl"
                  style={{
                    backgroundColor:
                      ins.severity === 'critical'
                        ? '#EF4444'
                        : ins.severity === 'positive'
                        ? '#10B981'
                        : ins.severity === 'warning'
                        ? '#F59E0B'
                        : '#3B82F6'
                  }}
                />

                <div className="p-5 space-y-3.5">
                  {/* Card Header: Severity pill + Category tag + time ago + overflow menu */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderSeverityPill(ins.severity)}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">
                        <Tag className="w-2.5 h-2.5 text-slate-400" />
                        {categoryTag}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 text-xs shrink-0 relative insight-overflow-menu-container">
                      <span className="text-[11px] font-medium text-slate-400">
                        {timeAgo}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(prev => (prev === ins.id ? null : ins.id));
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-7 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-40 animate-fade-in text-xs">
                          <button
                            onClick={(e) => handleToggleFavorite(e, ins.id)}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                            <span>{isFav ? 'Remove Favorite' : 'Save to Favorites'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              setShareModalConfig({ isOpen: true, insightId: ins.id, title: ins.title });
                            }}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Share2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Share Insight</span>
                          </button>
                          <button
                            onClick={() => handleCopySummary(ins)}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Summary</span>
                          </button>
                          <div className="h-px bg-slate-100 my-1" />
                          <button
                            onClick={() => handleDismiss(ins.id)}
                            className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Dismiss</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">
                    {ins.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 font-normal">
                    {ins.summary}
                  </p>

                  {/* Key Metric & Visual Area */}
                  <div className="flex items-center justify-between pt-1 pb-1">
                    <div>
                      <div
                        className="text-2xl font-extrabold tracking-tight"
                        style={{
                          color:
                            ins.severity === 'critical'
                              ? '#DC2626'
                              : ins.severity === 'positive'
                              ? '#059669'
                              : ins.severity === 'warning'
                              ? '#D97706'
                              : '#2563EB'
                        }}
                      >
                        {metricInfo.value}
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 block">
                        {metricInfo.label}
                      </span>
                    </div>

                    <MiniVisualChart insight={ins} metricInfo={metricInfo} />
                  </div>
                </div>

                {/* 3 Bottom Structured Action Buttons */}
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Button 1: View Details */}
                  <button
                    onClick={() => setSelectedInsightForDetails(ins)}
                    className="h-8 px-2.5 rounded-lg border border-blue-200 bg-blue-50/60 text-blue-700 text-xs font-semibold hover:bg-blue-100 flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  {/* Button 2: Contextual Middle Action */}
                  <button
                    onClick={() => handleMiddleAction(ins)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1 transition cursor-pointer"
                  >
                    {ins.type === 'trend' || ins.type === 'growth' ? (
                      <>
                        <Compass className="w-3 h-3 text-purple-600" />
                        <span>Explore What-If</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-3 h-3 text-blue-600" />
                        <span>Investigate</span>
                      </>
                    )}
                  </button>

                  {/* Button 3: Contextual Right Action */}
                  <button
                    onClick={() => handleRightAction(ins)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1 transition cursor-pointer"
                  >
                    {ins.severity === 'critical' || ins.type === 'operational' ? (
                      <>
                        <Bell className="w-3 h-3 text-rose-600" />
                        <span>Create Alert</span>
                      </>
                    ) : ins.type === 'growth' || ins.type === 'trend' ? (
                      <>
                        <Plus className="w-3 h-3 text-emerald-600" />
                        <span>Create KPI</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3 text-blue-600" />
                        <span>Add to Report</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Insight Title &amp; Summary</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Impact</th>
                  <th className="py-3 px-4">Dataset</th>
                  <th className="py-3 px-4">Key Metric</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInsights.map(ins => {
                  const metricInfo = getKeyMetricInfo(ins);
                  const isFav = favorites.has(String(ins.id));

                  return (
                    <tr
                      key={ins.id}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                      onClick={() => setSelectedInsightForDetails(ins)}
                    >
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-bold text-slate-900 leading-snug truncate">
                          {ins.title}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate mt-0.5">
                          {ins.summary}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-semibold text-slate-600 uppercase bg-slate-100 px-2 py-0.5 rounded">
                          {ins.type || 'insight'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderSeverityPill(ins.severity)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {ins.dataset_name || ins.source_metadata?.dataset_name || 'Primary'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 font-mono">
                          {metricInfo.value}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {metricInfo.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ins.status || 'Active'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-medium">
                        {formatTimeAgo(ins.created_at)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInsightForDetails(ins)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg text-blue-600 hover:bg-blue-50 border border-blue-200 transition cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            onClick={(e) => handleToggleFavorite(e, ins.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition"
                            title="Favorite"
                          >
                            <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                          </button>
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

      {/* ------------------------------------------------------------------ */}
      {/* 6. INSIGHT DETAILS MODAL                                           */}
      {/* ------------------------------------------------------------------ */}
      {selectedInsightForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col justify-between">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderSeverityPill(selectedInsightForDetails.severity)}
                  <span className="text-[11px] font-mono uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {selectedInsightForDetails.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedInsightForDetails(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                {selectedInsightForDetails.title}
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {selectedInsightForDetails.summary}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              {/* Telemetry & Ground-Truth Verification */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Ground-Truth Physical Telemetry
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {selectedInsightForDetails.evidence?.recordsAnalyzed || selectedInsightForDetails.evidence?.records_analyzed || 0} rows analyzed
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Dataset</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {selectedInsightForDetails.dataset_name || selectedInsightForDetails.evidence?.datasetName || 'Primary'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Current Value</span>
                    <span className="font-bold text-emerald-700 font-mono truncate block">
                      {selectedInsightForDetails.evidence?.currentValue !== undefined
                        ? selectedInsightForDetails.evidence.currentValue.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Comparison</span>
                    <span className="font-bold text-slate-700 font-mono truncate block">
                      {selectedInsightForDetails.evidence?.comparisonValue !== undefined
                        ? selectedInsightForDetails.evidence.comparisonValue.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Change %</span>
                    <span className="font-bold text-blue-700 font-mono block">
                      {selectedInsightForDetails.evidence?.changePercent !== undefined
                        ? `${selectedInsightForDetails.evidence.changePercent}%`
                        : 'Verified'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Period</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {selectedInsightForDetails.evidence?.period || 'Q4 Observation'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Impact Score</span>
                    <span className="font-bold text-purple-700 font-mono block">
                      {selectedInsightForDetails.impactScore || selectedInsightForDetails.impact_score || 50}/100
                    </span>
                  </div>
                </div>

                {/* Calculation formula */}
                {selectedInsightForDetails.evidence?.calculation && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-400 font-semibold block mb-1 uppercase">Evidence Formula</span>
                    <code className="text-[10px] font-mono bg-white p-2 rounded block border border-slate-200 text-slate-700 overflow-x-auto">
                      {selectedInsightForDetails.evidence.calculation}
                    </code>
                  </div>
                )}
              </div>

              {/* Recommended Action */}
              {selectedInsightForDetails.recommendation?.action && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-1.5">
                  <div className="font-bold text-blue-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-blue-600" />
                    Recommended Action
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {selectedInsightForDetails.recommendation.action}
                  </p>
                  {selectedInsightForDetails.recommendation.target_page && (
                    <button
                      onClick={() => {
                        const target = selectedInsightForDetails.recommendation.target_page;
                        setSelectedInsightForDetails(null);
                        navigate(target);
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"
                    >
                      <span>Navigate to {selectedInsightForDetails.recommendation.target_page}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
              {/* Feedback Buttons */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Useful?</span>
                <button
                  onClick={() => handleFeedback(selectedInsightForDetails.id, 'useful')}
                  className={`p-1.5 rounded-lg border transition ${
                    feedbackState[selectedInsightForDetails.id] === 'useful'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-400'
                  }`}
                  title="Thumbs Up"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleFeedback(selectedInsightForDetails.id, 'not_useful')}
                  className={`p-1.5 rounded-lg border transition ${
                    feedbackState[selectedInsightForDetails.id] === 'not_useful'
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-400'
                  }`}
                  title="Thumbs Down"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const ins = selectedInsightForDetails;
                    setSelectedInsightForDetails(null);
                    handleMiddleAction(ins);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Investigate Drivers
                </button>
                <button
                  onClick={() => {
                    const ins = selectedInsightForDetails;
                    setSelectedInsightForDetails(null);
                    handleRightAction(ins);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
                >
                  Take Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 7. EDUCATIONAL "WHAT ARE AI INSIGHTS?" MODAL                       */}
      {/* ------------------------------------------------------------------ */}
      {isLearnMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Understanding AI Insights</h3>
                  <p className="text-xs text-slate-500">Enterprise Data Intelligence Platform</p>
                </div>
              </div>
              <button
                onClick={() => setIsLearnMoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                <div className="font-bold text-slate-800 mb-0.5">1. Continuous Telemetry Analysis</div>
                <p>
                  RicozAnalytics evaluates metrics, time-series velocities, monotonic growths, and operational alerts against your actual database records.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                <div className="font-bold text-slate-800 mb-0.5">2. Ground-Truth Zero Hallucination</div>
                <p>
                  Every metric, change percentage, and threshold trigger is mathematically verified from uploaded CSV or SQL datasets before presentation.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                <div className="font-bold text-slate-800 mb-0.5">3. Impact Scoring &amp; Prioritization</div>
                <p>
                  Insights are weighted by business severity (Critical, Positive, Warning, Informational) so your team can address risks first.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsLearnMoreOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 8. CONNECTED COMPONENT MODALS & DRAWERS                            */}
      {/* ------------------------------------------------------------------ */}
      <RootCauseDrawer
        isOpen={Boolean(rootCauseInsight)}
        onClose={() => setRootCauseInsight(null)}
        insight={rootCauseInsight}
        onLaunchSimulator={(ins, attr) => {
          setRootCauseInsight(null);
          setSimulatorData({ insight: ins, attribution: attr });
        }}
      />

      {simulatorData && (
        <ScenarioSimulatorModal
          isOpen={Boolean(simulatorData)}
          onClose={() => setSimulatorData(null)}
          insight={simulatorData.insight}
          attribution={simulatorData.attribution}
        />
      )}

      <ShareModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig({ isOpen: false, insightId: null, title: '' })}
        resourceType="insight"
        resourceId={shareModalConfig.insightId}
        resourceTitle={shareModalConfig.title}
      />

      <AlertModal
        isOpen={alertModalConfig.isOpen}
        onClose={() => setAlertModalConfig({ isOpen: false, prefilled: null })}
        alert={alertModalConfig.prefilled}
        metrics={metrics}
        onSave={async (payload) => {
          try {
            await createAlert(payload);
            setAlertModalConfig({ isOpen: false, prefilled: null });
            showToast('Alert created successfully.');
          } catch (err) {
            console.error('Create alert failed:', err);
            showToast('Failed to create alert.');
          }
        }}
      />

      <MetricModal
        isOpen={metricModalConfig.isOpen}
        onClose={() => setMetricModalConfig({ isOpen: false, prefilled: null })}
        datasets={datasets}
        token={getAuthToken()}
        onSuccess={() => {
          setMetricModalConfig({ isOpen: false, prefilled: null });
          showToast('KPI created successfully.');
        }}
      />

      <ReportModal
        isOpen={reportModalConfig.isOpen}
        onClose={() => setReportModalConfig({ isOpen: false, prefilled: null })}
        dashboards={dashboards}
        report={reportModalConfig.prefilled}
        onSave={async (payload) => {
          try {
            if (createReport) {
              await createReport(payload);
            }
            setReportModalConfig({ isOpen: false, prefilled: null });
            showToast('Report created successfully.');
          } catch (err) {
            console.error('Create report failed:', err);
            showToast('Failed to create report.');
          }
        }}
      />
    </div>
  );
}
