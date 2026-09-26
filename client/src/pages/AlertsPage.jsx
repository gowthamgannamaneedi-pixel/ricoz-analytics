import React, { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-200 text-blue-600 shadow-2xs">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Real-Time Alerts & Incident Center
              </h1>
              <p className="text-xs text-slate-500">
                Rule-based threshold evaluation, operational alerts, and incident resolution
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>

          {canMutate && (
            <button
              onClick={() => {
                setEditingAlert(null);
                setIsAlertModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Alert Rule</span>
            </button>
          )}
        </div>
      </div>

      {/* Operational Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Rules */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Alert Rules</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Bell className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{summary.activeRules}</p>
          <p className="mt-1 text-[11px] text-slate-400">Rules monitored by scheduler</p>
        </div>

        {/* Card 2: Open Incidents */}
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Open Incidents</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-rose-900">{summary.openIncidents}</p>
          <p className="mt-1 text-[11px] text-rose-600/80">Triggered & Acknowledged</p>
        </div>

        {/* Card 3: Critical Alerts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Critical Severity Rules</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{summary.criticalAlerts}</p>
          <p className="mt-1 text-[11px] text-slate-400">High-priority operational rules</p>
        </div>

        {/* Card 4: Resolved MTD */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Resolved MTD</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{summary.resolvedMtd}</p>
          <p className="mt-1 text-[11px] text-slate-400">Incidents resolved this month</p>
        </div>
      </div>

      {/* Main Tabs Navigation & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'rules'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>Alert Rules ({alerts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'incidents'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 border border-transparent'
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
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by name or metric..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-60 rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: ALERT RULES LIST */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs text-slate-500">Loading operational alert rules...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No alert rules found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
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
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs hover:border-slate-300 transition"
                  >
                    {/* Left: Indicator, Title, Condition & Metric */}
                    <div className="flex items-start gap-3.5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${sev.border} ${sev.bg} ${sev.text}`}>
                        <Bell className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{alert.name}</h3>
                          {/* Severity Badge */}
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${sev.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                            {alert.severity}
                          </span>
                          {/* Status Badge */}
                          <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                            alert.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {alert.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Condition Expression */}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600 flex-wrap">
                          <span className="font-semibold text-slate-800">
                            {alert.metric_name || 'Generic Metric'}
                          </span>
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {condSymbol} {alert.threshold} {alert.metric_unit || ''}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Cooldown: {alert.cooldown_minutes || 60}m</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Toggle & Quick Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center border-t sm:border-t-0 pt-3 sm:pt-0 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Activation Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(alert)}
                        disabled={!canMutate}
                        title={alert.status === 'active' ? 'Click to disable' : 'Click to enable'}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          alert.status === 'active' ? 'bg-blue-600' : 'bg-slate-200'
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
                          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
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
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          title="Edit Rule"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Delete Button (Admin & Manager only) */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteAlert(alert.id, alert.name)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
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
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
            {['all', 'triggered', 'acknowledged', 'resolved'].map((st) => (
              <button
                key={st}
                onClick={() => setIncidentStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  incidentStatusFilter === st
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs text-slate-500">Loading incident records...</p>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                <CheckCheck className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">All systems operating normally</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                {incidentStatusFilter !== 'all'
                  ? `No incidents found with status "${incidentStatusFilter}".`
                  : 'No metric threshold breaches or incidents currently logged.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-600">
                      <th className="py-3 px-4">Status & Severity</th>
                      <th className="py-3 px-4">Alert Rule & Metric</th>
                      <th className="py-3 px-4">Breach Values</th>
                      <th className="py-3 px-4">Triggered Time</th>
                      <th className="py-3 px-4">Resolution Details</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredIncidents.map((inc) => {
                      const sev = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.medium;
                      const condSymbol = CONDITION_LABELS[inc.condition] || inc.condition;

                      return (
                        <tr key={inc.id} className="hover:bg-slate-50/60 transition">
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
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                    : inc.status === 'acknowledged'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {inc.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Alert & Metric */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-bold text-slate-900">{inc.alert_name || 'Operational Alert'}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Metric: <span className="font-medium text-slate-700">{inc.metric_name || 'Live Metric'}</span>
                            </div>
                          </td>

                          {/* Breach Values */}
                          <td className="py-3.5 px-4 align-top font-mono">
                            <div className="text-slate-900 font-bold">
                              Value: <span className="text-rose-600">{inc.metric_value}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Threshold: {condSymbol} {inc.threshold_value}
                            </div>
                          </td>

                          {/* Triggered Time */}
                          <td className="py-3.5 px-4 align-top text-slate-500">
                            <div className="font-medium text-slate-800">
                              {new Date(inc.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(inc.triggered_at).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Resolution Notes */}
                          <td className="py-3.5 px-4 align-top">
                            {inc.status === 'resolved' ? (
                              <div className="space-y-0.5">
                                <span className="text-emerald-700 font-semibold text-[11px]">
                                  Resolved by {inc.resolved_by_name || 'Operations'}
                                </span>
                                {inc.resolution_notes && (
                                  <p className="text-[11px] text-slate-500 italic line-clamp-2">
                                    "{inc.resolution_notes}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Pending resolution</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 align-top text-right">
                            {canMutate && inc.status !== 'resolved' && (
                              <div className="flex items-center justify-end gap-1.5">
                                {inc.status === 'triggered' && (
                                  <button
                                    onClick={() => handleAcknowledge(inc.id)}
                                    className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition"
                                  >
                                    Acknowledge
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setResolvingIncident(inc);
                                    setResolutionNotes('');
                                  }}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
                                >
                                  Resolve
                                </button>
                              </div>
                            )}
                            {inc.status === 'resolved' && (
                              <span className="text-emerald-600 font-semibold text-xs flex items-center justify-end gap-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Alert Evaluation Result</h3>
              </div>
              <button
                onClick={() => setTestResult(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className={`p-4 rounded-xl border ${
              testResult.triggered
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="font-bold text-sm mb-1">
                {testResult.triggered ? '🚨 Condition Breached (Triggered)' : '✅ Normal (Not Triggered)'}
              </div>
              <p className="text-xs">{testResult.message}</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1">
              <div>Metric Value: <span className="font-bold">{testResult.metricValue}</span></div>
              <div>Condition: <span className="font-bold">{testResult.condition}</span></div>
              <div>Threshold: <span className="font-bold">{testResult.threshold}</span></div>
            </div>

            <button
              onClick={() => setTestResult(null)}
              className="w-full rounded-xl bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Incident Resolution Modal */}
      {resolvingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Resolve Operational Incident</h3>
              </div>
              <button
                onClick={() => setResolvingIncident(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Provide resolution notes to document actions taken for incident <strong>#{resolvingIncident.id.slice(0, 8)}</strong>.
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Resolution Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Scaled database instance; transaction throughput normalized."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingIncident(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  {actionLoading ? 'Saving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
