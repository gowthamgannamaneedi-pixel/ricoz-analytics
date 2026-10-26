import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Play,
  Edit2,
  Trash2,
  Check,
  Flame,
  ChevronRight,
  ChevronDown,
  Filter,
  CheckCheck,
  Info,
  Loader2,
  ExternalLink,
  Mail,
  Zap,
  EyeOff
} from 'lucide-react';
import {
  getAlerts,
  getAlertSummary,
  createAlert,
  updateAlert,
  deleteAlert,
  testAlert,
  getAllIncidents,
  acknowledgeIncident,
  resolveIncident,
  getMetrics
} from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';
import { Button } from '../components/ui/Button';
import { RefreshButton } from '../components/ui/RefreshButton';
import { Select } from '../components/ui/Select';

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  high: {
    label: 'High',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  medium: {
    label: 'Medium',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  low: {
    label: 'Low',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-800 border-blue-200'
  }
};

const CONDITION_LABELS = {
  greater_than: '>',
  less_than: '<',
  equal: '=',
  equals: '=',
  not_equal: '≠',
  not_equals: '≠',
  percent_increase: '▲ %',
  percentage_change_increase: '▲ %',
  percent_decrease: '▼ %',
  percentage_change_decrease: '▼ %'
};

export default function AlertsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';
  const isAnalyst = user?.role === 'analyst';
  const canDelete = ['admin', 'manager'].includes(user?.role);
  const canMutate = ['admin', 'manager', 'analyst'].includes(user?.role);

  // Main Data States
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [summary, setSummary] = useState({
    activeRules: 0,
    openIncidents: 0,
    criticalAlerts: 0,
    resolvedMtd: 0
  });

  // UI Control States
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'incidents'
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Modal States
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [resolvingIncident, setResolvingIncident] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const resolveTriggerRef = useRef(null);
  const resolutionTextareaRef = useRef(null);

  // Lock background scrolling, handle Escape, and manage focus for Resolve modal
  useEffect(() => {
    if (!resolvingIncident) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus textarea on modal open
    const focusTimer = setTimeout(() => {
      resolutionTextareaRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setResolvingIncident(null);
        resolveTriggerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [resolvingIncident]);

  const handleCloseResolveModal = () => {
    setResolvingIncident(null);
    resolveTriggerRef.current?.focus();
  };

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Fetch all page data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const [alertsRes, incidentsRes, summaryRes, metricsRes] = await Promise.all([
        getAlerts().catch(() => ({ success: true, data: [] })),
        getAllIncidents().catch(() => ({ success: true, data: [] })),
        getAlertSummary().catch(() => ({ success: true, data: {} })),
        getMetrics().catch(() => ({ success: true, data: [] }))
      ]);

      setAlerts(alertsRes.data || []);
      setIncidents(incidentsRes.data || []);
      setMetrics(metricsRes.data || []);
      if (summaryRes.data) {
        setSummary({
          activeRules: summaryRes.data.activeRules || 0,
          openIncidents: summaryRes.data.openIncidents || 0,
          criticalAlerts: summaryRes.data.criticalAlerts || 0,
          resolvedMtd: summaryRes.data.resolvedMtd || 0
        });
      }
    } catch (err) {
      console.error('Failed to load alerts data:', err);
      setError('Failed to synchronize alerts and incidents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  // Rule CRUD handlers
  const handleSaveAlert = async (payload) => {
    if (editingAlert) {
      await updateAlert(editingAlert.id, payload);
      showToast('Alert rule updated successfully.');
    } else {
      await createAlert(payload);
      showToast('New alert rule configured and activated.');
    }
    fetchData(true);
  };

  const handleToggleStatus = async (alert) => {
    if (!canMutate) return;
    const nextStatus = alert.status === 'active' ? 'disabled' : 'active';
    try {
      await updateAlert(alert.id, { status: nextStatus });
      setAlerts(alerts.map(a => a.id === alert.id ? { ...a, status: nextStatus } : a));
      showToast(`Alert rule ${nextStatus === 'active' ? 'activated' : 'disabled'}.`);
    } catch (err) {
      setError(err.message || 'Failed to toggle alert status.');
    }
  };

  const handleDeleteAlert = async (id, name) => {
    if (!canDelete) return;
    if (!window.confirm(`Are you sure you want to delete alert rule "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteAlert(id);
      setAlerts(alerts.filter(a => a.id !== id));
      showToast('Alert rule deleted.');
      fetchData(true);
    } catch (err) {
      setError(err.message || 'Failed to delete alert rule.');
    }
  };

  const handleTestAlert = async (alert) => {
    if (!canMutate) return;
    setActionLoading(true);
    try {
      const res = await testAlert(alert.id, { dryRun: true });
      setTestResult(res.data);
    } catch (err) {
      setError(err.message || 'Failed to test alert evaluation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Incident Actions
  const handleAcknowledge = async (incidentId) => {
    if (!canMutate) return;
    try {
      await acknowledgeIncident(incidentId);
      showToast('Incident acknowledged.');
      fetchData(true);
    } catch (err) {
      setError(err.message || 'Failed to acknowledge incident.');
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolvingIncident) return;
    setActionLoading(true);
    try {
      await resolveIncident(resolvingIncident.id, { resolutionNotes });
      setResolvingIncident(null);
      setResolutionNotes('');
      showToast('Incident resolved and closed.');
      fetchData(true);
    } catch (err) {
      setError(err.message || 'Failed to resolve incident.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered lists
  const filteredAlerts = alerts.filter(a => {
    const matchesSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.metric_name && a.metric_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const filteredIncidents = incidents.filter(inc => {
    const matchesStatus = incidentStatusFilter === 'all' || inc.status === incidentStatusFilter;
    const matchesSeverity = severityFilter === 'all' || inc.severity === severityFilter;
    const matchesSearch = !searchQuery || (inc.alert_name && inc.alert_name.toLowerCase().includes(searchQuery.toLowerCase())) || (inc.metric_name && inc.metric_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSeverity && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900 text-white px-4 py-3 text-xs shadow-2xl border border-slate-800 animate-slideUp">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="space-y-3 border-b border-slate-200 dark:border-[#334155] pb-5">
        {/* Breadcrumb Navigation matching Reference */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-[#94A3B8]">
          <span className="hover:text-slate-600 dark:hover:text-[#F8FAFC] transition cursor-pointer" onClick={() => navigate('/dashboard')}>
            Workspace
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
          <span className="hover:text-slate-600 dark:hover:text-[#F8FAFC] transition cursor-pointer" onClick={() => navigate('/dashboard')}>
            Production
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
          <span className="text-slate-900 dark:text-[#F8FAFC] font-bold">
            Real-Time Alerts & Incident Center
          </span>
        </nav>

        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-500/20 shrink-0 mt-0.5">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-[#F8FAFC] font-sans">
              Real-Time Alerts & Incident Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#94A3B8] mt-1 font-normal">
              Rule-based threshold evaluation, operational alerts, and incident resolution
            </p>
          </div>
        </div>

        {/* Action Row below description: Create Alert Rule on left, Refresh on right */}
        <div className="flex items-center justify-between gap-4 pt-0.5">
          <div>
            {canMutate && (
              <Button
                id="create-alert-rule-btn"
                onClick={() => {
                  setEditingAlert(null);
                  setIsAlertModalOpen(true);
                }}
                variant="primary"
                className="h-10 px-4 text-xs font-semibold rounded-xl shadow-xs gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create Alert Rule</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <RefreshButton
              id="refresh-alerts-btn"
              isRefreshing={refreshing}
              onClick={handleRefresh}
            />
          </div>
        </div>
      </div>

      {/* Operational Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
        {/* Card 1: Active Rules */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-[#334155] bg-white dark:bg-[#111827] p-6 sm:p-7 min-h-[148px] shadow-2xs transition hover:shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">Active Alert Rules</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/40 shrink-0">
              <Bell className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-sans">{summary.activeRules}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-[#94A3B8]">Rules monitored by scheduler</p>
          </div>
        </div>

        {/* Card 2: Open Incidents (Issue 13: restrained dark-red surface) */}
        <div className="rounded-2xl border border-rose-200/90 dark:border-rose-900/60 bg-rose-50/40 dark:bg-[#2A1422] p-6 sm:p-7 min-h-[148px] shadow-2xs transition hover:shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-[#FDA4AF] uppercase tracking-wider">Open Incidents</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 dark:bg-[#1E293B] text-rose-600 dark:text-[#FB7185] border border-rose-200/80 dark:border-rose-900/60 shrink-0">
              <Flame className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="mt-3 text-3xl font-extrabold text-rose-900 dark:text-[#FDA4AF] tracking-tight font-sans">{summary.openIncidents}</p>
            <p className="mt-1 text-xs text-rose-600/80 dark:text-[#FDA4AF]/80">Triggered & Acknowledged</p>
          </div>
        </div>

        {/* Card 3: Critical Alerts */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-[#334155] bg-white dark:bg-[#111827] p-6 sm:p-7 min-h-[148px] shadow-2xs transition hover:shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">Critical Severity Rules</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/40 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-sans">{summary.criticalAlerts}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-[#94A3B8]">High-priority operational rules</p>
          </div>
        </div>

        {/* Card 4: Resolved MTD */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-[#334155] bg-white dark:bg-[#111827] p-6 sm:p-7 min-h-[148px] shadow-2xs transition hover:shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">Resolved MTD</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/40 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-[#F8FAFC] tracking-tight font-sans">{summary.resolvedMtd}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-[#94A3B8]">Incidents resolved this month</p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation & Search Bar (Issue 13: approved red-underline active tab) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#334155] pb-3">
        {/* Tabs */}
        <div className="flex items-center gap-2 sm:gap-6">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs dark:rounded-none dark:border-b-2 dark:border-t-0 dark:border-x-0 dark:py-3 dark:px-1 dark:bg-transparent dark:border-[#E11D48] dark:text-[#FB7185] dark:shadow-none'
                : 'text-slate-600 hover:bg-slate-100 border border-transparent dark:rounded-none dark:border-b-2 dark:border-t-0 dark:border-x-0 dark:py-3 dark:px-1 dark:bg-transparent dark:border-transparent dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Alert Rules ({alerts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'incidents'
                ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs dark:rounded-none dark:border-b-2 dark:border-t-0 dark:border-x-0 dark:py-3 dark:px-1 dark:bg-transparent dark:border-[#E11D48] dark:text-[#FB7185] dark:shadow-none'
                : 'text-slate-600 hover:bg-slate-100 border border-transparent dark:rounded-none dark:border-b-2 dark:border-t-0 dark:border-x-0 dark:py-3 dark:px-1 dark:bg-transparent dark:border-transparent dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-rose-500" />
            <span>Incident Resolution Center ({incidents.length})</span>
            {summary.openIncidents > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {summary.openIncidents}
              </span>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5">
          {/* Severity Dropdown */}
          <div className="w-36 sm:w-40">
            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              size="sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Filter by name or metric..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-60 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-[#CBD5E1] placeholder-slate-400 dark:placeholder-slate-500 focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: ALERT RULES LIST */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#334155]">
              <Loader2 className="h-8 w-8 animate-spin text-rose-600 mb-2" />
              <p className="text-xs text-slate-500 dark:text-[#94A3B8]">Loading operational alert rules...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-[#111827] rounded-2xl border border-dashed border-slate-300 dark:border-[#334155] text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">No alert rules found</h3>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-sm mt-1 mb-4">
                {searchQuery || severityFilter !== 'all'
                  ? 'No alert rules match your filter criteria.'
                  : 'Configure automated threshold alerts to monitor critical metrics 24/7.'}
              </p>
              {canMutate && (
                <button
                  onClick={() => {
                    setEditingAlert(null);
                    setIsAlertModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create First Alert Rule</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredAlerts.map((alert) => {
                const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
                const condSymbol = CONDITION_LABELS[alert.condition] || alert.condition;

                return (
                  <div
                    key={alert.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition"
                  >
                    {/* Left: Indicator, Title, Condition & Metric */}
                    <div className="flex items-start gap-3.5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${sev.border} ${sev.bg} ${sev.text}`}>
                        <Bell className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">{alert.name}</h3>
                          {/* Severity Badge */}
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${sev.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                            {alert.severity}
                          </span>
                          {/* Status Badge */}
                          <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                            alert.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                              : 'bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-[#CBD5E1] border-slate-200 dark:border-[#334155]'
                          }`}>
                            {alert.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Condition Expression */}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600 dark:text-[#CBD5E1] flex-wrap">
                          <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
                            {alert.metric_name || 'Target Metric'}
                          </span>
                          <span className="font-mono font-bold text-rose-600 dark:text-[#FB7185] bg-rose-50 dark:bg-[#2A1422] px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-900/40">
                            {condSymbol} {alert.threshold} {alert.metric_unit || ''}
                          </span>
                          <span className="text-slate-400 dark:text-[#94A3B8]">·</span>
                          <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Notify Interval: {alert.cooldown_minutes || 60}m</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Toggle & Quick Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center border-t sm:border-t-0 border-slate-100 dark:border-[#334155] pt-3 sm:pt-0 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Activation Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(alert)}
                        disabled={!canMutate}
                        title={alert.status === 'active' ? 'Click to disable' : 'Click to enable'}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          alert.status === 'active' ? 'bg-rose-600' : 'bg-slate-200 dark:bg-slate-700'
                        } ${!canMutate ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            alert.status === 'active' ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Test Rule Button */}
                      {canMutate && (
                        <button
                          onClick={() => handleTestAlert(alert)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B] px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-[#334155] hover:text-rose-600 dark:hover:text-[#FB7185] transition"
                          title="Evaluate rule immediately"
                        >
                          <Play className="h-3 w-3" />
                          <span className="hidden md:inline">Test</span>
                        </button>
                      )}

                      {/* Edit Button */}
                      {canMutate && (
                        <button
                          onClick={() => {
                            setEditingAlert(alert);
                            setIsAlertModalOpen(true);
                          }}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-700 dark:hover:text-[#F8FAFC] transition"
                          title="Edit Rule"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Delete Button (Admin & Manager only) */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteAlert(alert.id, alert.name)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-[#2A1422] hover:text-rose-600 dark:hover:text-[#FB7185] transition"
                          title="Delete Rule"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OPERATIONAL INCIDENT RESOLUTION CENTER */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#334155] pb-2 overflow-x-auto">
            {['all', 'triggered', 'acknowledged', 'resolved'].map((st) => (
              <button
                key={st}
                onClick={() => setIncidentStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  incidentStatusFilter === st
                    ? 'bg-slate-900 text-white dark:bg-[#1E293B] dark:text-[#F8FAFC] shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 dark:bg-[#0F172A] dark:text-[#94A3B8] dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E293B]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-[#334155]">
              <Loader2 className="h-8 w-8 animate-spin text-rose-600 mb-2" />
              <p className="text-xs text-slate-500 dark:text-[#94A3B8]">Loading incident records...</p>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-[#111827] rounded-2xl border border-dashed border-slate-300 dark:border-[#334155] text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-3">
                <CheckCheck className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">All systems operating normally</h3>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-sm mt-1">
                {incidentStatusFilter !== 'all'
                  ? `No incidents found with status "${incidentStatusFilter}".`
                  : 'No metric threshold breaches or incidents currently logged.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#334155] bg-slate-50/80 dark:bg-[#1E293B] font-semibold text-slate-600 dark:text-[#CBD5E1]">
                      <th className="py-3 px-4">Status & Severity</th>
                      <th className="py-3 px-4">Alert Rule & Metric</th>
                      <th className="py-3 px-4">Breach Values</th>
                      <th className="py-3 px-4">Triggered Time</th>
                      <th className="py-3 px-4">Resolution Details</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#334155] text-slate-700 dark:text-[#CBD5E1]">
                    {filteredIncidents.map((inc) => {
                      const sev = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.medium;
                      const condSymbol = CONDITION_LABELS[inc.condition] || inc.condition;

                      return (
                        <tr key={inc.id} className="hover:bg-slate-50/60 dark:hover:bg-[#1E293B]/50 transition">
                          {/* Status & Severity */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${sev.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                                {inc.severity}
                              </span>
                              <div>
                                <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                                  inc.status === 'triggered'
                                    ? 'bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border-rose-200 dark:border-rose-900/60 animate-pulse'
                                    : inc.status === 'acknowledged'
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                                }`}>
                                  {inc.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Alert & Metric */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-bold text-slate-900 dark:text-[#F8FAFC]">{inc.alert_name || 'Operational Alert'}</div>
                            <div className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                              Metric: <span className="font-medium text-slate-700 dark:text-[#CBD5E1]">{inc.metric_name || 'Live Metric'}</span>
                            </div>
                          </td>

                          {/* Breach Values */}
                          <td className="py-3.5 px-4 align-top font-mono">
                            <div className="text-slate-900 dark:text-[#F8FAFC] font-bold">
                              Value: <span className="text-rose-600 dark:text-[#FB7185]">{inc.metric_value}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                              Threshold: {condSymbol} {inc.threshold_value}
                            </div>
                          </td>

                          {/* Triggered Time */}
                          <td className="py-3.5 px-4 align-top text-slate-500 dark:text-[#94A3B8]">
                            <div className="font-medium text-slate-800 dark:text-[#CBD5E1]">
                              {new Date(inc.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-[#94A3B8]">
                              {new Date(inc.triggered_at).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Resolution Notes */}
                          <td className="py-3.5 px-4 align-top">
                            {inc.status === 'resolved' ? (
                              <div className="space-y-0.5">
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                                  Resolved by {inc.resolved_by_name || 'Operations'}
                                </span>
                                {inc.resolution_notes && (
                                  <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] italic line-clamp-2">
                                    "{inc.resolution_notes}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-[11px]">Pending resolution</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 align-top text-right">
                            {canMutate && inc.status !== 'resolved' && (
                              <div className="flex items-center justify-end gap-1.5">
                                {inc.status === 'triggered' && (
                                  <button
                                    onClick={() => handleAcknowledge(inc.id)}
                                    className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition"
                                  >
                                    Acknowledge
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    resolveTriggerRef.current = e.currentTarget;
                                    setResolvingIncident(inc);
                                    setResolutionNotes('');
                                  }}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                                >
                                  Resolve
                                </button>
                              </div>
                            )}
                            {inc.status === 'resolved' && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-end gap-1">
                                <Check className="h-3.5 w-3.5" />
                                <span>Closed</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test Evaluation Feedback Modal */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-rose-600 dark:text-[#FB7185]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">Alert Evaluation Result</h3>
              </div>
              <button
                onClick={() => setTestResult(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B]"
              >
                ✕
              </button>
            </div>

            <div className={`p-4 rounded-xl border ${
              testResult.triggered
                ? 'bg-rose-50 dark:bg-[#2A1422] border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-[#FDA4AF]'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300'
            }`}>
              <div className="font-bold text-sm mb-1">
                {testResult.triggered ? '🚨 Condition Breached (Triggered)' : '✅ Normal (Not Triggered)'}
              </div>
              <p className="text-xs">{testResult.message}</p>
            </div>

            <div className="bg-slate-50 dark:bg-[#0F172A] p-3 rounded-xl border border-slate-200 dark:border-[#334155] text-xs font-mono space-y-1 text-slate-800 dark:text-[#CBD5E1]">
              <div>Metric Value: <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{testResult.metricValue}</span></div>
              <div>Condition: <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{testResult.condition}</span></div>
              <div>Threshold: <span className="font-bold text-slate-900 dark:text-[#F8FAFC]">{testResult.threshold}</span></div>
            </div>

            <button
              onClick={() => setTestResult(null)}
              className="w-full rounded-xl bg-slate-900 dark:bg-[#1E293B] dark:hover:bg-[#334155] py-2 text-xs font-semibold text-white transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Incident Resolution Modal - Viewport-level backdrop dims entire application (Sidebar, Navbar, Footer) */}
      {resolvingIncident && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={handleCloseResolveModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-incident-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="resolve-incident-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Resolve Operational Incident
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Incident #{resolvingIncident.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseResolveModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition cursor-pointer"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Provide resolution notes to document actions taken for incident <strong>#{resolvingIncident.id.slice(0, 8)}</strong>.
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1" htmlFor="resolution-notes-textarea">
                  Resolution Notes
                </label>
                <textarea
                  id="resolution-notes-textarea"
                  ref={resolutionTextareaRef}
                  rows={3}
                  placeholder="e.g., Scaled database instance; transaction throughput normalized."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseResolveModal}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {actionLoading ? 'Saving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Alert Rule Creation / Edit Modal */}
      <AlertModal
        isOpen={isAlertModalOpen}
        onClose={() => {
          setIsAlertModalOpen(false);
          setEditingAlert(null);
        }}
        onSave={handleSaveAlert}
        alert={editingAlert}
        metrics={metrics}
      />
    </div>
  );
}
