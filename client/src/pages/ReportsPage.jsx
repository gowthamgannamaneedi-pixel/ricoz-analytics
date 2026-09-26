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
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ReportModal from '../components/ReportModal';
import {
  getReports,
  getDashboards,
  createReport,
  updateReport,
  deleteReport,
  runReport,
  getReportExecutions,
  getAllExecutions,
  downloadReportExecution
} from '../services/api';

export default function ReportsPage() {
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';

  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'history'
  const [reports, setReports] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

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
    } catch (err) {
      console.error('Failed to load reports pipeline:', err);
      setError('Could not connect to the backend reports service.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleDeleteReport = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete report "${title}"?`)) return;
    try {
      await deleteReport(id);
      showToast(`Report "${title}" was removed.`);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete report.');
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

  const handleRunReportNow = async (report) => {
    setRunningReportId(report.id);
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
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getFormatBadge = (format) => {
    switch (format?.toLowerCase()) {
      case 'pdf':
        return <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">PDF</span>;
      case 'excel':
      case 'xlsx':
        return <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">XLSX</span>;
      case 'csv':
        return <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">CSV</span>;
      case 'json':
        return <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">JSON</span>;
      default:
        return <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">{format}</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Pause className="h-2.5 w-2.5" />
            Paused
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-slate-900 text-white text-xs shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Automated Reports & Export Engine</h1>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Phase 9
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Build scheduled KPI digests, on-demand document exports, and stakeholder email broadcasts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            title="Refresh reports"
            className="p-2 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isViewer ? (
            <button
              onClick={() => {
                setSelectedReport(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Create Report
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">
              <Lock className="h-3.5 w-3.5" />
              <span>Read-Only (Viewer)</span>
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Configured Reports</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{reports.length}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FileBarChart className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Schedules</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              {reports.filter(r => r.status === 'active' && r.schedule_cron).length}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Executions Logged</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{executions.length}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <History className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Export Engines</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">PDF</span>
              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">XLSX</span>
              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">CSV</span>
              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">JSON</span>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <FileType className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'reports'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileBarChart className="h-4 w-4" />
            Report Pipelines ({reports.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'history'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            Execution Logs & Downloads ({executions.length})
          </button>
        </div>

        {activeTab === 'reports' && (
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports..."
                className="pl-8 pr-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="draft">Draft Only</option>
              <option value="paused">Paused Only</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: REPORTS LIST */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          )}

          {!loading && filteredReports.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <FileBarChart className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">No Reports Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'No reports match your search criteria. Try adjusting your filters.'
                  : 'You have not configured any scheduled reports yet. Create one to automatically compile executive metrics.'}
              </p>
              {!isViewer && (
                <button
                  onClick={() => {
                    setSelectedReport(null);
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" /> Create First Report
                </button>
              )}
            </div>
          )}

          {!loading && filteredReports.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReports.map((r) => {
                const recipients = Array.isArray(r.recipients)
                  ? r.recipients
                  : (typeof r.recipients === 'string' ? JSON.parse(r.recipients || '[]') : []);
                const isRunning = runningReportId === r.id;

                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Meta Line */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {getFormatBadge(r.format)}
                          {getStatusBadge(r.status)}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatScheduleText(r.schedule_cron)}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-sm font-bold text-slate-900 mt-2.5 mb-1 leading-snug">
                        {r.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {r.description || 'Automated reporting pipeline.'}
                      </p>

                      {/* Details Strip */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate max-w-[140px] font-medium">{r.dashboard_title || 'Executive Overview'}</span>
                        </div>

                        {recipients.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span>{recipients.length} Recipient{recipients.length > 1 ? 's' : ''}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto text-slate-400 text-[10px]">
                          <Clock className="h-3 w-3" />
                          <span>
                            {r.last_generated_at
                              ? `Last run: ${new Date(r.last_generated_at).toLocaleDateString()}`
                              : 'Never executed'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleRunReportNow(r)}
                        disabled={isRunning || isViewer}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition disabled:opacity-50"
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

                      {!isViewer && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleTogglePause(r)}
                            title={r.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          >
                            {r.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>

                          <button
                            onClick={() => {
                              setSelectedReport(r);
                              setIsModalOpen(true);
                            }}
                            title="Edit Report"
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteReport(r.id, r.title)}
                            title="Delete Report"
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
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
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Generation Logs & Download Artifacts
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Total Runs: {executions.length}
            </span>
          </div>

          {executions.length === 0 ? (
            <div className="p-12 text-center">
              <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No Executions Recorded Yet</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Trigger on-demand runs or wait for scheduled cron triggers to populate history.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Report Name</th>
                    <th className="px-4 py-3">Status</th>
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
                      <td className="px-5 py-3 font-semibold text-slate-800">
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
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
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

      {/* Modal */}
      <ReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateOrUpdateReport}
        report={selectedReport}
        dashboards={dashboards}
      />
    </div>
  );
}
