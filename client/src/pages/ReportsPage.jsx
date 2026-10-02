import React, { useState, useEffect, useCallback } from 'react';
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
  FileType,
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
  X
} from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ReportModal from '../components/ReportModal';
import ReportViewerModal from '../components/ReportViewerModal';
import ShareModal from '../components/ShareModal';
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

export default function ReportsPage() {
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';
  const [searchParams] = useSearchParams();
  const targetReportId = searchParams.get('id');

  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'history'
  const [reports, setReports] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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

      if (reportsData.success && reportsData.reports) {
        setReports(reportsData.reports);
      } else {
        // Fallback demo reports if backend offline
        setReports([
          {
            id: 'demo-1',
            title: 'Q4 Indian Enterprise Revenue Digest',
            description: 'Weekly financial telemetry, regional breakdown, and quota velocity.',
            format: 'pdf',
            schedule_cron: '0 9 * * 1',
            status: 'active',
            recipients: ['exec@ricoz.in', 'finance@ricoz.in'],
            dashboard_title: 'Executive Sales Command',
            last_generated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
            execution_count: 8,
            last_execution_status: 'completed'
          },
          {
            id: 'demo-2',
            title: 'Dataset Raw Transaction Stream (Monthly)',
            description: 'Complete multi-sheet transactional telemetry for audit compliance.',
            format: 'excel',
            schedule_cron: '0 9 1 * *',
            status: 'active',
            recipients: ['compliance@ricoz.in'],
            dashboard_title: 'Transactional Telemetry',
            last_generated_at: new Date(Date.now() - 3600000 * 72).toISOString(),
            execution_count: 3,
            last_execution_status: 'completed'
          }
        ]);
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
    if (selectedReport) {
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
        showToast(`Report "${report.title}" generated successfully! (${Math.round(result.execution.fileSize / 1024)} KB)`);
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

  // Filtered reports list
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSource =
      sourceFilter === 'all' ||
      (r.dashboard_title && r.dashboard_title.toLowerCase() === sourceFilter.toLowerCase()) ||
      (!r.dashboard_title && sourceFilter === 'unlinked');

    return matchesSearch && matchesStatus && matchesSource;
  });

  const getFormatBadge = (format) => {
    switch (format?.toLowerCase()) {
      case 'pdf':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200">PDF</span>;
      case 'excel':
      case 'xlsx':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">XLSX</span>;
      case 'csv':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-700 border border-amber-200">CSV</span>;
      case 'json':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-50 text-purple-700 border border-purple-200">JSON</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">{format || 'FILE'}</span>;
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

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || sourceFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSourceFilter('all');
  };

  // Distinct Dashboard titles for filtering
  const distinctSources = Array.from(
    new Set(reports.map(r => r.dashboard_title).filter(Boolean))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Reports
            </h1>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Analyst'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            Generate, schedule, and export business summaries across your organization's datasets and KPIs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadData}
            id="refresh-reports-btn"
            title="Refresh reports"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {!isViewer ? (
            <button
              onClick={() => {
                setSelectedReport(null);
                setIsModalOpen(true);
              }}
              id="create-report-btn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Create Report</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">
              <Lock className="h-3.5 w-3.5" />
              <span>Read-Only (Viewer)</span>
            </div>
          )}
        </div>
      </div>

      {/* Product Purpose Info Banner */}
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-blue-100 bg-blue-50/40 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileBarChart className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-slate-700 truncate">
            <strong className="font-semibold text-slate-900">Executive Summaries:</strong> Reports compile metrics and data tables into structured artifacts (PDF, Excel, CSV) for stakeholder review and scheduled broadcast.
          </span>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 shrink-0 transition"
        >
          <span>View Live Dashboards</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Reports</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{reports.length}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <FileBarChart className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Schedules</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              {reports.filter(r => r.status === 'active' && r.schedule_cron).length}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Draft Reports</p>
            <p className="text-2xl font-bold text-slate-700 mt-1 font-mono">
              {reports.filter(r => r.status === 'draft').length}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
            <Edit3 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Executions Logged</p>
            <p className="text-2xl font-bold text-purple-600 mt-1 font-mono">{executions.length}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <History className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileBarChart className="h-4 w-4" />
            <span>Report Pipelines ({reports.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Execution Logs & Artifacts ({executions.length})</span>
          </button>
        </div>

        {activeTab === 'reports' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="search-reports-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                className="w-full pl-8 pr-7 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              id="filter-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="draft">Draft Only</option>
              <option value="paused">Paused Only</option>
            </select>

            {distinctSources.length > 0 && (
              <select
                id="filter-source-select"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer shadow-2xs max-w-[150px] truncate"
              >
                <option value="all">All Sources</option>
                {distinctSources.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: REPORTS PIPELINE LIST */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((n) => (
                <div key={n} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-6 bg-slate-200 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-full" />
                  <div className="h-10 bg-slate-50 rounded" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-rose-900">Service Communication Error</h3>
              <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
              <button
                onClick={loadData}
                className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
              </button>
            </div>
          )}

          {!loading && !error && filteredReports.length === 0 && (
            <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
              <FileBarChart className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">
                {hasActiveFilters ? 'No Matching Reports' : 'No Reports Configured Yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                {hasActiveFilters
                  ? 'No reports match your selected search query and filters. Try clearing your search parameters.'
                  : 'Automated reports summarize your business telemetry and export clean PDF, Excel, and CSV digests to team stakeholders.'}
              </p>
              {hasActiveFilters ? (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              ) : !isViewer && (
                <button
                  onClick={() => {
                    setSelectedReport(null);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Create First Report
                </button>
              )}
            </div>
          )}

          {!loading && !error && filteredReports.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReports.map((r) => {
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

                return (
                  <div
                    key={r.id}
                    onClick={() => handleOpenViewer(r)}
                    className={`group rounded-xl border bg-white p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition flex flex-col justify-between cursor-pointer ${
                      isTargetHighlighted ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200/90'
                    }`}
                  >
                    <div>
                      {/* Top Pill Row */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          {getFormatBadge(r.format)}
                          {getStatusBadge(r.status)}
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleToggleFavorite(e, r.id)}
                            title={isFavorited ? 'Remove favorite' : 'Add to favorites'}
                            className="text-slate-400 hover:text-amber-500 transition cursor-pointer p-1 rounded-md hover:bg-slate-50"
                          >
                            <Star className={`h-4 w-4 ${isFavorited ? 'fill-amber-400 text-amber-500' : ''}`} />
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareModalConfig({ isOpen: true, reportId: r.id, title: r.title });
                            }}
                            title="Share report with team"
                            className="text-slate-400 hover:text-blue-600 transition cursor-pointer p-1 rounded-md hover:bg-slate-50"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>

                          <span className="text-[11px] font-medium text-slate-500 ml-1">
                            {formatScheduleText(r.schedule_cron)}
                          </span>
                        </div>
                      </div>

                      {/* Report Name - Strongest Visual Element */}
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                        {r.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1 mb-3.5 leading-relaxed">
                        {r.description || 'Configured enterprise report pipeline.'}
                      </p>

                      {/* Details Strip */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5" title="Source Dashboard">
                          <Layers className="h-3.5 w-3.5 text-blue-600" />
                          <span className="truncate max-w-[140px] font-medium text-slate-800">
                            {r.dashboard_title || 'Executive Overview'}
                          </span>
                        </div>

                        {recipients.length > 0 && (
                          <div className="flex items-center gap-1.5 text-slate-500" title="Stakeholder recipients">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span>{recipients.length} Recipient{recipients.length > 1 ? 's' : ''}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto text-slate-500 text-[11px]">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {r.last_generated_at
                              ? `Run: ${new Date(r.last_generated_at).toLocaleDateString()}`
                              : 'Never run'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div
                      className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRunReportNow(r)}
                          disabled={isRunning || isViewer}
                          id={`run-report-${r.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                        >
                          {isRunning ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              Run Now
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenViewer(r)}
                          id={`view-report-${r.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                          <span>View Details</span>
                        </button>
                      </div>

                      {!isViewer && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTogglePause(r)}
                            title={r.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          >
                            {r.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>

                          <button
                            onClick={() => {
                              setSelectedReport(r);
                              setIsModalOpen(true);
                            }}
                            id={`edit-report-${r.id}`}
                            title="Edit Report Configuration"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmTarget(r)}
                            id={`delete-report-${r.id}`}
                            title="Delete Report"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {/* TAB 2: EXECUTION LOGS & ARTIFACT DOWNLOADS */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Execution Logs & Artifact Downloads
              </h3>
              <p className="text-[11px] text-slate-500">
                Audit history of all scheduled triggers and on-demand report compiles
              </p>
            </div>
            <span className="text-xs font-medium text-slate-600 font-mono">
              Total Runs: {executions.length}
            </span>
          </div>

          {executions.length === 0 ? (
            <div className="p-12 text-center">
              <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No Executions Recorded Yet</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Trigger on-demand runs from the Pipelines tab or wait for scheduled cron triggers.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Report Name</th>
                    <th className="px-4 py-3">Execution Status</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3">File Size</th>
                    <th className="px-4 py-3">Triggered By</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-5 py-3 text-right">Artifact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {executions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3 font-bold text-slate-900">
                        {exec.report_title || 'Analytics Digest'}
                      </td>
                      <td className="px-4 py-3">
                        {exec.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Check className="h-3 w-3" /> Completed
                          </span>
                        ) : exec.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={exec.error_message}>
                            <AlertCircle className="h-3 w-3" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
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
                      <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                        {new Date(exec.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {exec.status === 'completed' && exec.file_path ? (
                          <button
                            onClick={() => handleDownloadExecution(exec)}
                            disabled={downloadingExecutionId === exec.id}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 transition cursor-pointer"
                            title="Download authenticated report artifact"
                          >
                            {downloadingExecutionId === exec.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
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
            </div>
          )}
        </div>
      )}

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
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
