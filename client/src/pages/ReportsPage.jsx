import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileBarChart,
  Plus,
  Play,
  Clock,
  Download,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Mail,
  History,
  RefreshCw,
  Search,
  Filter,
  Check,
  Pause,
  ArrowUpRight,
  Database,
  Layers,
  Sparkles,
  Lock,
  ExternalLink,
  Star,
  Share2,
  Eye,
  User,
  X,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  FileText,
  PieChart,
  TrendingUp,
  Layout,
  Sliders,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ReportModal from '../components/ReportModal';
import ReportViewerModal from '../components/ReportViewerModal';
import ShareModal from '../components/ShareModal';
import { Button } from '../components/ui/Button';
import { RefreshButton } from '../components/ui/RefreshButton';
import {
  getReports,
  getDashboards,
  createReport,
  updateReport,
  deleteReport,
  runReport,
  getReportExecutions,
  getAllExecutions,
  downloadReportExecution,
  toggleFavoriteApi,
  getFavoritesApi,
  recordRecentlyViewedApi
} from '../services/api';

/**
 * Pre-built Enterprise Report Templates
 * Quick-start blueprints that prefill the report creation modal for real saving.
 */
const PREBUILT_TEMPLATES = [
  {
    id: 'tpl-exec-summary',
    title: 'Executive Summary',
    description: 'High-level KPIs, revenue trajectories, and decision intelligence signals.',
    format: 'pdf',
    iconBg: 'bg-blue-50 text-blue-600 border-blue-200/80',
    category: 'Executive'
  },
  {
    id: 'tpl-financial-perf',
    title: 'Financial Performance',
    description: 'Comprehensive revenue breakdown, realization rates, and channel contribution.',
    format: 'pdf',
    iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200/80',
    category: 'Finance'
  },
  {
    id: 'tpl-sales-channel',
    title: 'Sales & Channel Analysis',
    description: 'Detailed channel performance, partner distribution, and conversion volume.',
    format: 'excel',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
    category: 'Sales'
  },
  {
    id: 'tpl-operational',
    title: 'Operational Report',
    description: 'Line item transactional telemetry, fulfillment speed, and order volume.',
    format: 'csv',
    iconBg: 'bg-rose-50 text-rose-600 border-rose-200/80',
    category: 'Operations'
  },
  {
    id: 'tpl-data-quality',
    title: 'Data Quality Report',
    description: 'Dataset completeness, validation issues, schema integrity, and health score.',
    format: 'pdf',
    iconBg: 'bg-amber-50 text-amber-600 border-amber-200/80',
    category: 'Governance'
  }
];

/**
 * Mini Sparkline Bar Component for Summary Metric Cards
 * Shows subtle flat line when count is 0, and proportional bars when count > 0.
 */
function MiniSparklineBars({ count = 0, color = '#2563eb' }) {
  if (!count || count <= 0) {
    return (
      <div className="flex items-center gap-1 h-9 shrink-0 opacity-40">
        {[20, 20, 20, 20, 20, 20].map((h, i) => (
          <span key={i} className="w-1.5 rounded-xs" style={{ height: `${h}%`, backgroundColor: '#94a3b8' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1 h-9 shrink-0">
      <span className="w-1.5 rounded-xs" style={{ height: '35%', backgroundColor: color, opacity: 0.35 }} />
      <span className="w-1.5 rounded-xs" style={{ height: '55%', backgroundColor: color, opacity: 0.5 }} />
      <span className="w-1.5 rounded-xs" style={{ height: '42%', backgroundColor: color, opacity: 0.4 }} />
      <span className="w-1.5 rounded-xs" style={{ height: '80%', backgroundColor: color, opacity: 0.7 }} />
      <span className="w-1.5 rounded-xs" style={{ height: '62%', backgroundColor: color, opacity: 0.55 }} />
      <span className="w-1.5 rounded-xs" style={{ height: '100%', backgroundColor: color, opacity: 1.0 }} />
    </div>
  );
}

/**
 * Report Visual Thumbnail Preview (SVG mini-charts)
 */
function ReportVisualPreview({ type = 'bar', className = '' }) {
  if (type === 'donut') {
    return (
      <div className={`h-16 w-full flex items-center justify-center bg-slate-50/70 rounded-xl p-2 border border-slate-100/90 ${className}`}>
        <svg className="h-12 w-full" viewBox="0 0 160 48" fill="none">
          <g transform="translate(42, 24)">
            <circle cx="0" cy="0" r="17" stroke="#f1f5f9" strokeWidth="6" />
            <circle cx="0" cy="0" r="17" stroke="#0ea5e9" strokeWidth="6" strokeDasharray="30 80" strokeDashoffset="0" />
            <circle cx="0" cy="0" r="17" stroke="#2563eb" strokeWidth="6" strokeDasharray="38 80" strokeDashoffset="-30" />
            <circle cx="0" cy="0" r="17" stroke="#f59e0b" strokeWidth="6" strokeDasharray="24 80" strokeDashoffset="-68" />
          </g>
          <rect x="78" y="14" width="46" height="4.5" rx="2" fill="#2563eb" />
          <rect x="78" y="23" width="34" height="4.5" rx="2" fill="#0ea5e9" />
          <rect x="78" y="32" width="22" height="4.5" rx="2" fill="#f59e0b" />
        </svg>
      </div>
    );
  }

  if (type === 'line' || type === 'spline') {
    return (
      <div className={`h-16 w-full flex items-center justify-center bg-slate-50/70 rounded-xl p-2 border border-slate-100/90 ${className}`}>
        <svg className="h-12 w-full" viewBox="0 0 160 48" fill="none">
          <defs>
            <linearGradient id="areaDigestGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M 5 36 C 25 36, 35 14, 55 14 C 75 14, 85 30, 105 20 C 125 10, 138 18, 155 16 L 155 46 L 5 46 Z"
            fill="url(#areaDigestGrad)"
          />
          <path
            d="M 5 36 C 25 36, 35 14, 55 14 C 75 14, 85 30, 105 20 C 125 10, 138 18, 155 16"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="55" cy="14" r="3" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="105" cy="20" r="3" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  // Default: Bar Chart Preview
  return (
    <div className={`h-16 w-full flex items-center justify-center bg-slate-50/70 rounded-xl p-2 border border-slate-100/90 ${className}`}>
      <svg className="h-12 w-full" viewBox="0 0 160 48" fill="none">
        <rect x="12" y="24" width="7" height="22" rx="2" fill="#93c5fd" />
        <rect x="27" y="16" width="7" height="30" rx="2" fill="#60a5fa" />
        <rect x="42" y="8" width="7" height="38" rx="2" fill="#2563eb" />
        <rect x="57" y="20" width="7" height="26" rx="2" fill="#93c5fd" />
        <rect x="72" y="12" width="7" height="34" rx="2" fill="#3b82f6" />
        <rect x="87" y="4" width="7" height="42" rx="2" fill="#1d4ed8" />
        <rect x="102" y="18" width="7" height="28" rx="2" fill="#60a5fa" />
        <rect x="117" y="26" width="7" height="20" rx="2" fill="#bfdbfe" />
        <rect x="132" y="14" width="7" height="32" rx="2" fill="#3b82f6" />
      </svg>
    </div>
  );
}

import { getUserInitials } from '../components/ui/UserAvatar';

/**
 * Avatar Initials Helper — Using shared enterprise UserAvatar utility
 */
const getInitials = getUserInitials;

/**
 * Helper to derive clean schedule frequency badges from real cron expressions
 */
const getScheduleFrequencyBadge = (cron) => {
  if (!cron) return { label: 'DEMAND', sub: 'MANUAL' };
  const c = cron.trim().toLowerCase();
  if (c === '0 9 * * *' || c === 'daily') return { label: 'DAILY', sub: '9:00 AM' };
  if (c === '0 9 * * 1' || c === 'weekly') return { label: 'WEEKLY', sub: 'MON' };
  if (c === '0 9 1 * *' || c === 'monthly') return { label: 'MONTHLY', sub: '1ST' };
  return { label: 'CRON', sub: 'AUTO' };
};

export default function ReportsPage() {
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';
  const isAdmin = user?.role === 'admin';
  const [searchParams] = useSearchParams();
  const targetReportId = searchParams.get('id');
  const navigate = useNavigate();

  // Active Tab: 'library' | 'scheduled' | 'history' | 'templates'
  const [activeTab, setActiveTab] = useState('library');

  // Core Data State
  const [reports, setReports] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Collaboration State
  const [favorites, setFavorites] = useState(new Set());
  const [shareModalConfig, setShareModalConfig] = useState({ isOpen: false, reportId: null, title: '' });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewerReport, setViewerReport] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Execution Running State
  const [runningReportId, setRunningReportId] = useState(null);
  const [downloadingExecutionId, setDownloadingExecutionId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Action Menu Dropdown State
  const [actionMenuOpenId, setActionMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  // Click outside to close action menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActionMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Reports & Dashboards
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsData, dashboardsData, executionsData] = await Promise.all([
        getReports().catch(() => ({ success: false, reports: [] })),
        getDashboards().catch(() => ({ success: false, dashboards: [] })),
        getAllExecutions().catch(() => ({ success: false, executions: [] }))
      ]);

      if (reportsData.success && Array.isArray(reportsData.reports)) {
        setReports(reportsData.reports);
      } else {
        setReports([]);
      }

      if (dashboardsData.dashboards) {
        setDashboards(dashboardsData.dashboards);
      }

      if (executionsData.executions) {
        setExecutions(executionsData.executions);
      }

      // Load user favorites
      try {
        const favsRes = await getFavoritesApi();
        if (favsRes?.data) {
          const reportFavs = new Set(
            favsRes.data
              .filter(f => f.resource_type === 'report')
              .map(f => String(f.resource_id))
          );
          setFavorites(reportFavs);
        }
      } catch (_) {}

      // Open report directly if target ID in URL
      if (targetReportId) {
        recordRecentlyViewedApi('report', targetReportId).catch(() => {});
        const match = reportsData?.reports?.find(r => String(r.id) === String(targetReportId));
        if (match) {
          setViewerReport(match);
          setIsViewerOpen(true);
        }
      }
    } catch (err) {
      console.error('Failed to load reports pipeline:', err);
      setError('Could not connect to the backend reports service.');
    } finally {
      setLoading(false);
    }
  }, [targetReportId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCreateOrUpdateReport = async (reportData) => {
    if (selectedReport && selectedReport.id && !String(selectedReport.id).startsWith('tpl-')) {
      const res = await updateReport(selectedReport.id, reportData);
      if (res.success) {
        showToast(`Report "${res.report.title}" updated successfully.`);
      }
    } else {
      const res = await createReport(reportData);
      if (res.success) {
        showToast(`Report "${res.report.title}" created successfully.`);
      }
    }
    loadData();
  };

  const confirmDeleteReport = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeleting(true);
    try {
      await deleteReport(deleteConfirmTarget.id);
      showToast(`Report "${deleteConfirmTarget.title}" was removed.`);
      setDeleteConfirmTarget(null);
      if (viewerReport?.id === deleteConfirmTarget.id) {
        setIsViewerOpen(false);
        setViewerReport(null);
      }
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete report.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePause = async (report) => {
    const newStatus = report.status === 'active' ? 'paused' : 'active';
    try {
      await updateReport(report.id, {
        ...report,
        status: newStatus
      });
      showToast(`Report is now ${newStatus.toUpperCase()}.`);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleToggleFavorite = async (e, reportId) => {
    e.stopPropagation();
    try {
      const res = await toggleFavoriteApi('report', reportId);
      const isFav = Boolean(res.data?.isFavorite);
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(String(reportId));
        else next.delete(String(reportId));
        return next;
      });
      showToast(isFav ? 'Added to favorites.' : 'Removed from favorites.');
    } catch (err) {
      showToast('Failed to update favorite.');
    }
  };

  const handleRunReportNow = async (report) => {
    setRunningReportId(report.id);
    recordRecentlyViewedApi('report', report.id).catch(() => {});
    try {
      const result = await runReport(report.id, report.format);
      if (result.success) {
        showToast(`Report "${report.title}" generated successfully! (${Math.round((result.execution?.fileSize || 2048) / 1024)} KB)`);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Report execution failed.');
    } finally {
      setRunningReportId(null);
    }
  };

  const handleOpenViewer = (report) => {
    recordRecentlyViewedApi('report', report.id).catch(() => {});
    setViewerReport(report);
    setIsViewerOpen(true);
  };

  const handleDownloadExecution = async (exec) => {
    setDownloadingExecutionId(exec.id);
    try {
      const rawTitle = exec.report_title || 'Analytics-Report';
      const sanitizedTitle = rawTitle
        .trim()
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .replace(/\s+/g, '-');
      let ext = (exec.format || 'pdf').toLowerCase();
      if (ext === 'excel') ext = 'xlsx';
      const fallbackName = `${sanitizedTitle}.${ext}`;

      await downloadReportExecution(exec.id, fallbackName);
      showToast(`Downloaded: ${fallbackName}`);
    } catch (err) {
      alert(err.message || 'Failed to download report artifact.');
    } finally {
      setDownloadingExecutionId(null);
    }
  };

  const handleUseTemplate = (template) => {
    setSelectedReport({
      id: `tpl-${Date.now()}`,
      title: template.title,
      description: template.description,
      format: template.format,
      status: 'active',
      schedule_cron: '0 9 * * 1'
    });
    setIsModalOpen(true);
  };

  // Filtered reports list
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    const normFormat = (r.format || 'pdf').toLowerCase();
    const matchesType =
      typeFilter === 'all' ||
      normFormat === typeFilter ||
      (typeFilter === 'excel' && (normFormat === 'xlsx' || normFormat === 'excel'));

    const matchesSource =
      sourceFilter === 'all' ||
      (r.dashboard_title && r.dashboard_title.toLowerCase() === sourceFilter.toLowerCase()) ||
      (!r.dashboard_title && sourceFilter === 'unlinked');

    return matchesSearch && matchesStatus && matchesType && matchesSource;
  });

  // Scheduled reports from real data
  const scheduledReports = reports.filter(r => r.schedule_cron && r.schedule_cron.trim() !== '');

  // Format badge rendering
  const getFormatBadge = (format) => {
    const f = (format || 'pdf').toLowerCase();
    switch (f) {
      case 'pdf':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200">
            PDF
          </span>
        );
      case 'excel':
      case 'xlsx':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
            XLSX
          </span>
        );
      case 'csv':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-700 border border-amber-200">
            CSV
          </span>
        );
      case 'ppt':
      case 'powerpoint':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-orange-50 text-orange-700 border border-orange-200">
            PPT
          </span>
        );
      case 'json':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-50 text-purple-700 border border-purple-200">
            JSON
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
            {format.toUpperCase()}
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Pause className="h-2.5 w-2.5" />
            Paused
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  const formatScheduleText = (cron) => {
    if (!cron) return 'On-Demand';
    const c = cron.trim().toLowerCase();
    if (c === '0 9 * * *' || c === 'daily') return 'Daily (9:00 AM)';
    if (c === '0 9 * * 1' || c === 'weekly') return 'Weekly (Mon 9:00 AM)';
    if (c === '0 9 1 * *' || c === 'monthly') return 'Monthly (1st 9:00 AM)';
    return `Cron: ${cron}`;
  };

  const hasActiveFilters = searchQuery !== '' || typeFilter !== 'all' || statusFilter !== 'all' || sourceFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setSourceFilter('all');
  };

  // Real Metric Calculations
  const totalReportsCount = reports.length;
  const activeSchedulesCount = reports.filter(r => r.status === 'active' && r.schedule_cron).length;
  const draftReportsCount = reports.filter(r => r.status === 'draft').length;
  const executionsCount = executions.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. PAGE HEADER                                                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <FileBarChart className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
                Reports
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {isAdmin ? 'Admin' : user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Analyst'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
              Generate, schedule, and export business summaries across your organization's datasets and KPIs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <RefreshButton
            label={loading ? 'Refreshing...' : 'Refresh'}
            loading={loading}
            onClick={loadData}
          />

          {!isViewer ? (
            <Button
              onClick={() => {
                setSelectedReport(null);
                setIsModalOpen(true);
              }}
              id="create-report-btn"
              variant="primary"
            >
              <Plus className="h-4 w-4" />
              Create Report
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">
              <Lock className="h-3.5 w-3.5" />
              <span>Read-Only (Viewer)</span>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. SUMMARY METRICS AREA (4 Professional Real-Data KPI Cards)        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Reports */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100/80">
                <FileBarChart className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Reports</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                {loading ? '—' : totalReportsCount}
              </span>
              <MiniSparklineBars count={totalReportsCount} color="#2563eb" />
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {totalReportsCount > 0 ? `${reports.filter(r => r.status === 'active').length} active` : '0 active'}
            </span>
            <span className="text-slate-400 font-normal">in library</span>
          </div>
        </div>

        {/* Card 2: Active Schedules */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-emerald-200 transition-all flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/80">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Schedules</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                {loading ? '—' : activeSchedulesCount}
              </span>
              <MiniSparklineBars count={activeSchedulesCount} color="#059669" />
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {totalReportsCount > 0 ? `${Math.round((activeSchedulesCount / totalReportsCount) * 100)}%` : '0%'}
            </span>
            <span className="text-slate-400 font-normal">automated recurring</span>
          </div>
        </div>

        {/* Card 3: Draft Reports */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-purple-200 transition-all flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100/80">
                <Edit3 className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Draft Reports</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                {loading ? '—' : draftReportsCount}
              </span>
              <MiniSparklineBars count={draftReportsCount} color="#7c3aed" />
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-600">
              {draftReportsCount > 0 ? `${draftReportsCount} pending publish` : 'All reports configured'}
            </span>
          </div>
        </div>

        {/* Card 4: Executions Logged */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-amber-200 transition-all flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center gap-2.5 text-slate-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100/80">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Executions Logged</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
                {loading ? '—' : executionsCount}
              </span>
              <MiniSparklineBars count={executionsCount} color="#d97706" />
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-blue-600">
              {executionsCount > 0 ? `${executions.filter(e => e.status === 'completed').length} completed` : 'Audit log ready'}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. SEGMENTED TABS & FILTERS TOOLBAR                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Segmented Tab Buttons */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === 'library'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileBarChart className="h-4 w-4" />
            <span>Report Library</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scheduled')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === 'scheduled'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Scheduled Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Execution History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === 'templates'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layout className="h-4 w-4" />
            <span>Templates</span>
          </button>
        </div>

        {/* Right: Search + Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[260px] sm:min-w-[300px] flex-1 sm:flex-initial">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="search-reports-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by report name, description..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              id="filter-type-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF Document</option>
              <option value="excel">Excel (.xlsx)</option>
              <option value="csv">CSV Spreadsheet</option>
              <option value="json">JSON Data</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              id="filter-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="draft">Draft Only</option>
              <option value="paused">Paused Only</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. MAIN VIEW CONTENT                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* TAB 1: REPORT LIBRARY (Matching Visual Target Composition) */}
      {activeTab === 'library' && (
        <div className="space-y-6">
          {/* Upper Section: Featured Reports (8 cols) + Report Templates (4 cols) */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left 8 Cols: Featured Reports */}
            <div className="xl:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileBarChart className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                      Featured Reports
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Most used and important reports for your organization
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                    setStatusFilter('all');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
                >
                  <span>View All Reports</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Cards Grid */}
              <div className="mt-5">
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse space-y-3">
                        <div className="h-4 bg-slate-200 rounded w-1/3" />
                        <div className="h-16 bg-slate-100 rounded" />
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-full" />
                      </div>
                    ))}
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 space-y-3">
                    <FileBarChart className="h-10 w-10 text-slate-300 mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">No matching reports found</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        {hasActiveFilters
                          ? 'Try adjusting your search criteria or resetting filters.'
                          : 'Create your first report or use one of the ready templates.'}
                      </p>
                    </div>
                    {hasActiveFilters ? (
                      <Button variant="secondary" size="sm" onClick={resetFilters}>
                        Reset Filters
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> Create Report
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                    {filteredReports.map((r, idx) => {
                      const recipients = Array.isArray(r.recipients)
                        ? r.recipients
                        : (typeof r.recipients === 'string'
                          ? (() => {
                              try {
                                return JSON.parse(r.recipients || '[]');
                              } catch {
                                return [];
                              }
                            })()
                          : []);
                      const isRunning = runningReportId === r.id;
                      const isFavorited = favorites.has(String(r.id));
                      const isTargetHighlighted = targetReportId === String(r.id);

                      // Visual chart thumbnail style cycle
                      const previewType = idx % 3 === 0 ? 'bar' : idx % 3 === 1 ? 'line' : 'donut';

                      return (
                        <div
                          key={r.id}
                          className={`group rounded-xl border bg-white p-4.5 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between cursor-pointer ${
                            isTargetHighlighted ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200/90'
                          }`}
                          onClick={() => handleOpenViewer(r)}
                        >
                          <div>
                            {/* Top Row: Icon + Format Badge */}
                            <div className="flex items-center justify-between pb-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                {getFormatBadge(r.format)}
                              </div>
                            </div>

                            {/* Mini Visual Preview Thumbnail */}
                            <ReportVisualPreview type={previewType} className="mb-3.5" />

                            {/* Title - Strongest Visual Element, 2 lines max without premature truncation */}
                            <div className="flex items-start justify-between gap-1.5 group-hover:text-blue-600 transition">
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600">
                                {r.title}
                              </h4>
                              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 shrink-0 mt-1" />
                            </div>

                            {/* Description */}
                            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                              {r.description || 'Configured enterprise business report digest.'}
                            </p>

                            {/* Schedule & Recipient Metadata */}
                            <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{formatScheduleText(r.schedule_cron)}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                {recipients.length > 0 ? (
                                  <div className="flex -space-x-1.5 overflow-hidden">
                                    {recipients.slice(0, 2).map((rec, rIdx) => (
                                      <div
                                        key={rIdx}
                                        title={rec}
                                        className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center"
                                      >
                                        {getInitials(rec)}
                                      </div>
                                    ))}
                                    {recipients.length > 2 && (
                                      <div className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center">
                                        +{recipients.length - 2}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="inline-block h-5 w-5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold flex items-center justify-center">
                                    <User className="h-3 w-3" />
                                  </div>
                                )}
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {recipients.length > 0 ? `${recipients.length} recipient${recipients.length > 1 ? 's' : ''}` : 'On-demand'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div
                            className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleRunReportNow(r)}
                              disabled={isRunning || isViewer}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-2xs"
                            >
                              {isRunning ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Running...</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 fill-white" />
                                  <span>Run Now</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenViewer(r)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
                            >
                              View Details
                            </button>

                            {/* More Actions Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setActionMenuOpenId(actionMenuOpenId === r.id ? null : r.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                title="More Actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {actionMenuOpenId === r.id && (
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 bottom-full mb-1 w-44 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-30 animate-in fade-in zoom-in-95 text-xs font-medium text-slate-700"
                                >
                                  {!isViewer && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuOpenId(null);
                                          setSelectedReport(r);
                                          setIsModalOpen(true);
                                        }}
                                        className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                                        <span>Edit Configuration</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuOpenId(null);
                                          handleTogglePause(r);
                                        }}
                                        className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Pause className="h-3.5 w-3.5 text-slate-400" />
                                        <span>{r.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'}</span>
                                      </button>
                                    </>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuOpenId(null);
                                      setShareModalConfig({ isOpen: true, reportId: r.id, title: r.title });
                                    }}
                                    className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Share2 className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Share Report</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      setActionMenuOpenId(null);
                                      handleToggleFavorite(e, r.id);
                                    }}
                                    className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Star className={`h-3.5 w-3.5 ${isFavorited ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                                    <span>{isFavorited ? 'Remove Favorite' : 'Add to Favorites'}</span>
                                  </button>

                                  {!isViewer && (
                                    <>
                                      <div className="my-1 border-t border-slate-100" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuOpenId(null);
                                          setDeleteConfirmTarget(r);
                                        }}
                                        className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                        <span>Delete Report</span>
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
                )}
              </div>
            </div>

            {/* Right 4 Cols: Report Templates (Pre-built blueprints) */}
            <div className="xl:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Layout className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                        Report Templates
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Quick start with pre-built templates
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('templates')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>View All</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Templates List */}
                <div className="mt-4 space-y-3">
                  {PREBUILT_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3 rounded-xl border border-slate-100 hover:border-blue-200 bg-slate-50/50 hover:bg-blue-50/20 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${tpl.iconBg}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {tpl.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {tpl.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUseTemplate(tpl)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer shrink-0 shadow-2xs"
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Template Promotion Banner */}
              <div className="mt-5 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center gap-3 text-xs text-blue-900">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="leading-relaxed">
                  Automated formats include PDF digest, XLSX multi-sheet tables, and lightweight CSV exports.
                </span>
              </div>
            </div>
          </section>

          {/* Lower Section: Recent Reports (8 cols) + Scheduled Reports (4 cols) */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left 8 Cols: Recent Reports / Executions Table */}
            <div className="xl:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileBarChart className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                      Recent Reports
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Latest generated reports and their status
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
                >
                  <span>View All</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Enterprise Table */}
              <div className="mt-4 overflow-x-auto">
                {executions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <History className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">No executions recorded yet</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click "Run Now" on any featured report above to generate artifacts and view execution history.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="pb-3 font-semibold">Report Name</th>
                        <th className="pb-3 font-semibold">Type</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Generated On</th>
                        <th className="pb-3 font-semibold">Owner</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {executions.slice(0, 5).map((exec) => (
                        <tr key={exec.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 font-bold text-slate-900">
                            {exec.report_title || 'Analytics Digest'}
                          </td>
                          <td className="py-3">
                            {getFormatBadge(exec.format)}
                          </td>
                          <td className="py-3">
                            {exec.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Check className="h-3 w-3" /> Completed
                              </span>
                            ) : exec.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={exec.error_message}>
                                <AlertCircle className="h-3 w-3" /> Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                <Loader2 className="h-3 w-3 animate-spin" /> Running
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-slate-500 font-mono text-[11px]">
                            {new Date(exec.created_at).toLocaleDateString()} {new Date(exec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3">
                            <div className="h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                              {getInitials(exec.executed_by_name || user?.name || 'Admin')}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {exec.status === 'completed' && exec.file_path && (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadExecution(exec)}
                                  disabled={downloadingExecutionId === exec.id}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                  title="Download Artifact"
                                >
                                  {downloadingExecutionId === exec.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setShareModalConfig({ isOpen: true, reportId: exec.report_id, title: exec.report_title })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                title="Share"
                              >
                                <Share2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Scheduled Reports (Upcoming automated triggers derived 100% from real cron data) */}
            <div className="xl:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                        Scheduled Reports
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Upcoming automated report executions
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('scheduled')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>View All</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Timeline of Scheduled Reports derived 100% from real schedule_cron */}
                <div className="mt-4 space-y-3">
                  {scheduledReports.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <Calendar className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-700">No scheduled reports</p>
                      <p className="text-xs text-slate-500">
                        Configure a recurring schedule on any report to automate distribution.
                      </p>
                    </div>
                  ) : (
                    scheduledReports.map((sr, idx) => {
                      const recipients = Array.isArray(sr.recipients)
                        ? sr.recipients
                        : (typeof sr.recipients === 'string'
                          ? (() => {
                              try {
                                return JSON.parse(sr.recipients || '[]');
                              } catch {
                                return [];
                              }
                            })()
                          : []);
                      
                      const freq = getScheduleFrequencyBadge(sr.schedule_cron);

                      return (
                        <div
                          key={sr.id || idx}
                          className="p-3 rounded-xl border border-slate-100 hover:border-purple-200 bg-slate-50/50 hover:bg-purple-50/20 transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Frequency Badge derived 100% from real cron data */}
                            <div className="flex flex-col items-center justify-center h-10 w-12 rounded-lg bg-white border border-slate-200 text-slate-700 shrink-0 font-sans shadow-2xs">
                              <span className="text-[8px] font-bold text-slate-400 uppercase leading-none">
                                {freq.label}
                              </span>
                              <span className="text-xs font-extrabold text-slate-900 leading-none mt-1 font-mono">
                                {freq.sub}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {sr.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {sr.dashboard_title || 'Executive Overview'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-semibold text-slate-600 font-mono">
                              9:00 AM
                            </span>
                            <div className="h-5 w-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                              {getInitials(recipients[0] || user?.name || 'Admin')}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Scheduled Status Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Scheduler Service:</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Routine
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: SCHEDULED REPORTS (Dedicated View) */}
      {activeTab === 'scheduled' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Automated Report Schedules
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage recurring triggers, stakeholder recipients, and cron routines
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 font-mono">
              Total Active: {scheduledReports.length}
            </span>
          </div>

          <div className="mt-4">
            {scheduledReports.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Calendar className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No scheduled reports found</p>
                <p className="text-xs text-slate-500">
                  Select a report in the library and configure a recurring schedule.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledReports.map((sr) => (
                  <div
                    key={sr.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-all shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2">
                        <div className="flex items-center gap-2">
                          {getFormatBadge(sr.format)}
                          {getStatusBadge(sr.status)}
                        </div>
                        <span className="text-xs font-mono font-semibold text-slate-600">
                          {formatScheduleText(sr.schedule_cron)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">{sr.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{sr.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleTogglePause(sr)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        {sr.status === 'active' ? (
                          <>
                            <Pause className="h-3 w-3" /> Pause Schedule
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" /> Resume Schedule
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRunReportNow(sr)}
                        disabled={runningReportId === sr.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition cursor-pointer"
                      >
                        <Play className="h-3 w-3" /> Trigger Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EXECUTION HISTORY (Audit Logs & Artifact Downloads) */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Execution Logs & Artifact Downloads
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of all scheduled triggers and on-demand report compiles
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 font-mono">
              Total Runs: {executions.length}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            {executions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <History className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No executions recorded yet</p>
                <p className="text-xs text-slate-500">
                  Trigger on-demand runs from the Report Library to generate artifacts.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Report Name</th>
                    <th className="px-4 py-3">Execution Status</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3">File Size</th>
                    <th className="px-4 py-3">Triggered By</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3 text-right">Artifact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {executions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {exec.report_title || 'Analytics Digest'}
                      </td>
                      <td className="px-4 py-3">
                        {exec.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Check className="h-3 w-3" /> Completed
                          </span>
                        ) : exec.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={exec.error_message}>
                            <AlertCircle className="h-3 w-3" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <Loader2 className="h-3 w-3 animate-spin" /> {exec.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{getFormatBadge(exec.format)}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                        {exec.file_size ? `${Math.round(exec.file_size / 1024)} KB` : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[11px]">
                        {exec.executed_by_name || 'System / Scheduler'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(exec.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {exec.status === 'completed' && exec.file_path ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadExecution(exec)}
                            disabled={downloadingExecutionId === exec.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 transition cursor-pointer"
                          >
                            {downloadingExecutionId === exec.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Downloading...</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5" />
                                <span>Download</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TEMPLATES CATALOG */}
      {activeTab === 'templates' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Report Templates Catalog
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pre-configured reporting blueprints optimized for executive, sales, and financial stakeholders
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PREBUILT_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${tpl.iconBg}`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    {getFormatBadge(tpl.format)}
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-2">{tpl.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tpl.description}</p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {tpl.category}
                  </span>
                  <Button variant="primary" size="sm" onClick={() => handleUseTemplate(tpl)}>
                    Use Template
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. MODALS & OVERLAYS                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Report Viewer Modal */}
      <ReportViewerModal
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setViewerReport(null);
        }}
        report={viewerReport}
        executions={executions}
        onRunReport={handleRunReportNow}
        onDownloadExecution={handleDownloadExecution}
        onShare={(rep) => setShareModalConfig({ isOpen: true, reportId: rep.id, title: rep.title })}
        onEdit={(rep) => {
          setSelectedReport(rep);
          setIsModalOpen(true);
        }}
        isRunning={runningReportId === viewerReport?.id}
        downloadingId={downloadingExecutionId}
        isViewer={isViewer}
      />

      {/* Create / Edit Modal */}
      <ReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateOrUpdateReport}
        report={selectedReport}
        dashboards={dashboards}
      />

      {/* Resource Share Modal */}
      <ShareModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig({ isOpen: false, reportId: null, title: '' })}
        resourceType="report"
        resourceId={shareModalConfig.reportId}
        resourceTitle={shareModalConfig.title}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Report</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed mb-4">
              Are you sure you want to delete report <strong className="text-slate-900 font-semibold">"{deleteConfirmTarget.title}"</strong>? Any active schedules and delivery subscriptions for this report will be permanently terminated.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteReport}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Report</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
