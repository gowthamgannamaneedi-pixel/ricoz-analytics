import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  RefreshCw,
  Sliders,
  FileDown,
  Layers,
  Search,
  Plus,
  Trash2,
  Calendar,
  Key,
  Info,
  TrendingUp,
  AlertCircle,
  Play,
  RotateCcw,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Droplet,
  Check,
  X,
  Clock,
  Sparkles,
  GitBranch,
  Link2,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  ArrowUpRight
} from 'lucide-react';
import {
  getDatasets,
  getDatasetQuality,
  evaluateDatasetQuality,
  startQualityAudit,
  getQualityJobStatus,
  getDatasetActiveJob,
  cancelQualityJob,
  retryQualityJob,
  getDatasetQualityHistory,
  getDataQualityRules,
  createDataQualityRule,
  deleteDataQualityRule,
  exportDataQuality
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

/**
 * Enterprise Circular Donut Gauge for Overall Dataset Health Score
 */
function QualityHealthGauge({ score = 100, size = 130, strokeWidth = 11 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  let strokeColor = '#059669'; // emerald-600
  if (clampedScore < 70) strokeColor = '#e11d48'; // rose-600
  else if (clampedScore < 85) strokeColor = '#d97706'; // amber-600

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        {/* Animated Gauge Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Centered Score matching Wireframe */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
          {clampedScore}%
        </span>
        <span className="text-[11px] font-semibold text-slate-400 font-mono">/ 100</span>
      </div>
    </div>
  );
}

export default function DataQualityPage() {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [qualityProfile, setQualityProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [rules, setRules] = useState([]);
  const [activeTab, setActiveTab] = useState('matrix'); // matrix, issues, rules, history
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [scanMode, setScanMode] = useState('full'); // 'full' | 'sampled'
  const [activeJob, setActiveJob] = useState(null);
  const [jobError, setJobError] = useState(null);
  const pollingRef = useRef(null);
  const [columnSearch, setColumnSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [issueFilter, setIssueFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState(null);

  // Dropdown states
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [actionMenuColumn, setActionMenuColumn] = useState(null);
  const exportRef = useRef(null);
  const actionMenuRef = useRef(null);

  // Rule Creation Modal State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    columnName: '',
    ruleType: 'not_null',
    severity: 'warning',
    configuration: {}
  });
  const [ruleError, setRuleError] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [deletingRule, setDeletingRule] = useState(false);

  // Toast notification helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuColumn(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Initial Dataset Load
  useEffect(() => {
    async function loadInitialDatasets() {
      try {
        setLoading(true);
        const res = await getDatasets();
        const list = res.datasets || res.data || [];
        setDatasets(list);
        if (list.length > 0) {
          const urlParams = new URLSearchParams(window.location.search);
          const paramId = urlParams.get('datasetId');
          const matched = list.find((d) => String(d.id) === String(paramId));
          setSelectedDatasetId(matched ? matched.id : list[0].id);
        }
      } catch (err) {
        console.error('Failed to load datasets:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialDatasets();
  }, []);

  // Job Polling Mechanism
  const startPollingJob = useCallback((jobId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setEvaluating(true);
    setJobError(null);

    const poll = async () => {
      try {
        const res = await getQualityJobStatus(jobId);
        const job = res?.data || res?.job;
        if (!job) return;

        setActiveJob(job);

        if (job.status === 'COMPLETED') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setEvaluating(false);
          showToast('Quality audit completed successfully!');
          // Reload profile & history
          const [profRes, histRes] = await Promise.all([
            getDatasetQuality(selectedDatasetId).catch(() => null),
            getDatasetQualityHistory(selectedDatasetId).catch(() => ({ history: [] }))
          ]);
          if (profRes && (profRes.profile || profRes.data)) {
            setQualityProfile(profRes.profile || profRes.data);
          }
          setHistory(histRes.history || histRes.data || []);
        } else if (job.status === 'FAILED') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setEvaluating(false);
          setJobError(job.error_message || 'Quality audit failed. Dataset is safe and has not been deleted.');
        } else if (job.status === 'CANCELLED') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setEvaluating(false);
          showToast('Quality scan cancelled. Dataset is safe.');
        }
      } catch (err) {
        console.error('Job polling error:', err);
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 1200);
  }, [selectedDatasetId]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // 2. Fetch Quality Profile, History, and Rules for selected Dataset
  const loadQualityData = useCallback(async () => {
    if (!selectedDatasetId) return;
    try {
      setLoading(true);
      setJobError(null);
      const [profileRes, historyRes, rulesRes, activeJobRes] = await Promise.all([
        getDatasetQuality(selectedDatasetId).catch(() => null),
        getDatasetQualityHistory(selectedDatasetId).catch(() => ({ history: [] })),
        getDataQualityRules(selectedDatasetId).catch(() => ({ rules: [] })),
        getDatasetActiveJob(selectedDatasetId).catch(() => null)
      ]);

      if (profileRes && (profileRes.profile || profileRes.data || profileRes.quality_score !== undefined)) {
        setQualityProfile(profileRes.profile || profileRes.data || profileRes);
      } else {
        setQualityProfile(null);
      }

      setHistory(historyRes.history || historyRes.data || []);
      setRules(rulesRes.rules || rulesRes.data || []);

      const job = activeJobRes?.data || activeJobRes?.job;
      if (job && (job.status === 'RUNNING' || job.status === 'QUEUED')) {
        setActiveJob(job);
        startPollingJob(job.id);
      }
    } catch (err) {
      console.error('Error fetching quality details:', err);
      setQualityProfile(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDatasetId, startPollingJob]);

  useEffect(() => {
    loadQualityData();
  }, [loadQualityData]);

  // 3. Run Quality Audit Asynchronously
  const handleRunAudit = async () => {
    if (!selectedDatasetId) return;
    try {
      setEvaluating(true);
      setJobError(null);
      const options = {
        scanMode: scanMode === 'sampled' ? 'SAMPLED' : 'FULL_SCAN',
        sampleSize: scanMode === 'sampled' ? 10000 : null
      };
      const res = await startQualityAudit(selectedDatasetId, options);
      const jobId = res?.jobId || res?.data?.job_id;
      if (jobId) {
        setActiveJob(res.data || { id: jobId, status: 'RUNNING', progress_percent: 5, stage: 'INITIALIZING' });
        startPollingJob(jobId);
        showToast('Quality audit initiated.');
      }
    } catch (err) {
      console.error('Audit run failed:', err);
      setEvaluating(false);
      setJobError(err.message || 'Audit evaluation failed. Dataset is safe and has not been deleted.');
    }
  };

  const handleCancelAudit = async () => {
    if (!activeJob?.id) return;
    try {
      await cancelQualityJob(activeJob.id);
      showToast('Cancelling quality scan...');
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const handleRetryAudit = async () => {
    if (!activeJob?.id) {
      handleRunAudit();
      return;
    }
    try {
      setEvaluating(true);
      setJobError(null);
      const res = await retryQualityJob(activeJob.id);
      const jobId = res?.jobId || res?.data?.job_id;
      if (jobId) {
        setActiveJob(res.data || { id: jobId, status: 'RUNNING', progress_percent: 5, stage: 'INITIALIZING' });
        startPollingJob(jobId);
        showToast('Retry audit initiated.');
      }
    } catch (err) {
      console.error('Retry failed:', err);
      setEvaluating(false);
      setJobError(err.message || 'Audit retry failed. Dataset is safe and has not been deleted.');
    }
  };

  // 4. Export Quality Report (PDF, Excel, JSON)
  const handleExport = async (format) => {
    if (!selectedDatasetId) return;
    setExportMenuOpen(false);
    try {
      showToast(`Generating ${format.toUpperCase()} export...`);
      const { blob, filename } = await exportDataQuality(selectedDatasetId, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(`Downloaded: ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
      alert(err.message || 'Failed to export data quality report');
    }
  };

  // 5. Create Custom Quality Rule
  const handleCreateRule = async (e) => {
    e.preventDefault();
    setRuleError('');
    if (!ruleForm.columnName) {
      setRuleError('Please select a target column.');
      return;
    }
    setCreatingRule(true);
    try {
      const payload = {
        datasetId: selectedDatasetId,
        columnName: ruleForm.columnName,
        ruleType: ruleForm.ruleType,
        severity: ruleForm.severity,
        configuration: ruleForm.configuration || {}
      };
      const res = await createDataQualityRule(payload);
      if (res?.success) {
        showToast(`Quality rule for "${ruleForm.columnName}" created.`);
        setIsRuleModalOpen(false);
        setRuleForm({ columnName: '', ruleType: 'not_null', severity: 'warning', configuration: {} });
        const updatedRules = await getDataQualityRules(selectedDatasetId).catch(() => ({ rules: [] }));
        setRules(updatedRules.rules || updatedRules.data || []);
      }
    } catch (err) {
      setRuleError(err.message || 'Failed to create quality rule');
    } finally {
      setCreatingRule(false);
    }
  };

  // 6. Delete Quality Rule
  const handleOpenDeleteRule = (rule) => {
    setRuleToDelete(rule);
  };

  const handleConfirmDeleteRule = async () => {
    if (!ruleToDelete) return;
    setDeletingRule(true);
    try {
      await deleteDataQualityRule(ruleToDelete.id);
      setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id));
      showToast(`Quality rule for "${ruleToDelete.column_name}" deleted.`);
      setRuleToDelete(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete rule');
    } finally {
      setDeletingRule(false);
    }
  };

  // Quick action from column table to create rule
  const handleOpenRuleForColumn = (colName) => {
    setActionMenuColumn(null);
    setRuleForm({
      columnName: colName,
      ruleType: 'not_null',
      severity: 'warning',
      configuration: {}
    });
    setRuleError('');
    setIsRuleModalOpen(true);
  };

  // Active dataset entity
  const selectedDataset = datasets.find((d) => String(d.id) === String(selectedDatasetId));
  const dimensions = qualityProfile?.dimensions || {};
  const issues = qualityProfile?.issues || [];
  const columnMetrics = qualityProfile?.column_metrics || [];

  // Reset Filters
  const resetFilters = () => {
    setColumnSearch('');
    setTypeFilter('all');
    setScopeFilter('all');
  };

  // Filter columns in Matrix
  const filteredColumns = columnMetrics.filter((col) => {
    const matchesSearch =
      col.column_name.toLowerCase().includes(columnSearch.toLowerCase()) ||
      col.data_type.toLowerCase().includes(columnSearch.toLowerCase());
    const matchesType = typeFilter === 'all' || col.data_type.toLowerCase() === typeFilter.toLowerCase();
    const matchesScope =
      scopeFilter === 'all' ||
      (scopeFilter === 'missing' && col.missing_count > 0) ||
      (scopeFilter === 'pk' && col.is_candidate_pk);
    return matchesSearch && matchesType && matchesScope;
  });

  // Filter issues
  const filteredIssues = issues.filter((iss) => {
    if (issueFilter === 'all') return true;
    return iss.severity === issueFilter || iss.dimension === issueFilter;
  });

  const criticalIssuesCount = issues.filter((i) => i.severity === 'critical').length;
  const minorIssuesCount = issues.filter((i) => i.severity === 'warning' || i.severity === 'info').length;

  // Status Badge Component
  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Healthy
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Warning
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            Critical
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Unknown
          </span>
        );
    }
  };

  const getDataTypeBadge = (type) => {
    const t = (type || 'string').toLowerCase();
    switch (t) {
      case 'string':
      case 'text':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            string
          </span>
        );
      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            number
          </span>
        );
      case 'date':
      case 'timestamp':
      case 'datetime':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            date
          </span>
        );
      case 'boolean':
      case 'bool':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            boolean
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {t}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* �      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. BREADCRUMB & HEADER                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {/* Breadcrumb Navigation matching Wireframe */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span className="hover:text-slate-600 transition cursor-pointer" onClick={() => navigate('/dashboard')}>
            Workspace
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="hover:text-slate-600 transition cursor-pointer">
            Production
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-slate-900 font-bold">
            Data Quality & Observability
          </span>
        </nav>

        {/* Header Title + Action Controls Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-1">
          {/* Left Title and Description */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
              Data Quality & Observability
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal leading-relaxed">
              Continuous telemetry, anomaly detection, schema tracking, and relational integrity.
            </p>
          </div>

          {/* Right Action Controls Toolbar matching Wireframe */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Dataset Selector Dropdown */}
            <div className="relative">
              <select
                id="dataset-select"
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="appearance-none pl-9 pr-9 h-10 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-300 focus:outline-hidden focus:border-rose-500 shadow-2xs cursor-pointer"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.row_count ? `(${Number(d.row_count).toLocaleString()} rows)` : ''}
                  </option>
                ))}
              </select>
              <Database className="h-4 w-4 text-rose-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Scan Mode Pill Toggle */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setScanMode('full')}
                className={`h-8 px-3 rounded-lg font-semibold transition cursor-pointer ${
                  scanMode === 'full'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full Scan
              </button>
              <button
                type="button"
                onClick={() => setScanMode('sampled')}
                className={`h-8 px-3 rounded-lg font-semibold transition cursor-pointer ${
                  scanMode === 'sampled'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sampled (1k)
              </button>
            </div>

            {/* Export Dropdown Button */}
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                id="export-menu-button"
                onClick={() => setExportMenuOpen((prev) => !prev)}
                disabled={!selectedDatasetId}
                className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 transition shadow-2xs cursor-pointer disabled:opacity-50 select-none"
              >
                <FileDown className="h-4 w-4 text-slate-500" />
                <span>Export like PDF</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-rose-700 transition text-xs font-semibold cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-rose-500" />
                      <span>Export PDF Report</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      PDF
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('excel')}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition text-xs font-semibold cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                      <span>Export Excel Sheet</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      XLSX
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('json')}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-purple-700 transition text-xs font-semibold cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-purple-500" />
                      <span>Export JSON Schema</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      JSON
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Run Quality Audit Button (Primary Action) */}
            <Button
              id="run-audit-button"
              onClick={handleRunAudit}
              disabled={evaluating || !selectedDatasetId}
              variant="primary"
              className="h-10 px-4 rounded-xl font-semibold shadow-xs"
            >
              {evaluating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Scanning ({activeJob?.progress_percent || 0}%)...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Run Quality Audit</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Active Background Job Progress Indicator ────────────────────── */}
      {evaluating && (
        <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-sm mb-6 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <RefreshCw className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Quality Scan in Progress</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase font-semibold">
                    {activeJob?.status || 'RUNNING'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Processing {(activeJob?.rows_processed || 0).toLocaleString()} / {(activeJob?.total_rows || 0).toLocaleString()} rows &bull; Stage: <span className="font-mono text-slate-700 font-semibold">{activeJob?.stage || 'INITIALIZING'}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleCancelAudit}
                className="h-9 px-3 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                <span>Cancel Scan</span>
              </Button>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-rose-500 to-rose-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, activeJob?.progress_percent || 0)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>{activeJob?.scan_mode || (scanMode === 'sampled' ? 'SAMPLED SCAN' : 'FULL ENTERPRISE SCAN')}</span>
              <span className="font-bold text-rose-600">{activeJob?.progress_percent || 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Failed Job Error Banner with Retry ──────────────────────────── */}
      {jobError && (
        <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-5 mb-6 shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-900">Quality Audit Notice</h4>
                <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                  {jobError}
                </p>
                <p className="text-[11px] text-rose-600/80 mt-1 font-medium">
                  Dataset is safe and has not been deleted. You can retry the audit safely.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                variant="primary"
                onClick={handleRetryAudit}
                className="h-8 px-4 rounded-lg text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                <span>Retry Audit</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 space-y-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <RefreshCw className="h-8 w-8 text-rose-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading dataset quality information...</p>
        </div>
      ) : !qualityProfile && !evaluating ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center space-y-4 shadow-xs max-w-lg mx-auto my-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Quality Profile Found</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Run an on-demand quality audit scan to profile completeness, type validity, uniqueness, and column metrics for this dataset.
          </p>
          <Button onClick={handleRunAudit} variant="primary" className="h-10 px-5 rounded-xl font-semibold">
            <Play className="h-4 w-4 fill-white mr-1.5" />
            <span>Run Initial Evaluation</span>
          </Button>
        </div>
      ) : (
        <>
          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 2. OVERALL DATASET HEALTH & 6 QUALITY DIMENSIONS                   */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left Card: Overall Dataset Health */}
            <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between relative overflow-hidden">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-slate-900">Overall Dataset Health</span>
                  </div>
                  <div>{getStatusBadge(qualityProfile.status)}</div>
                </div>

                {/* Donut Gauge + Status / Description */}
                <div className="flex items-center justify-center py-5">
                  <QualityHealthGauge score={qualityProfile.quality_score} size={140} strokeWidth={12} />
                </div>
              </div>

              {/* Bottom Wireframe Summary: Scan Execution & Evaluated Rows */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Scan Execution:</span>
                  <span className="font-bold text-slate-800 capitalize">{scanMode === 'full' ? 'Full Scan' : 'Sampled (1,000)'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Evaluated Rows:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {selectedDataset?.row_count !== undefined
                      ? `${Number(selectedDataset.row_count).toLocaleString()} rows`
                      : `${qualityProfile.row_count || 0} rows`}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: 6 Quality Dimensions (7 cols in 3x2 Grid) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {/* Card 1: Completeness */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Droplet className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">25% Wgt</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mt-2.5">Completeness</h4>
                  <div className="text-2xl font-extrabold text-slate-900 font-sans mt-1">
                    {dimensions.completeness?.score || 100}%
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${dimensions.completeness?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
                  {dimensions.completeness?.null_count || dimensions.completeness?.missing_cells || 0}% missing values
                </div>
              </div>

              {/* Card 2: Validity / Types */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">25% Wgt</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mt-2.5">Validity / Types</h4>
                  <div className="text-2xl font-extrabold text-slate-900 font-sans mt-1">
                    {dimensions.validity?.score || 100}%
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${dimensions.validity?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
                  {dimensions.validity?.invalid_count || 0} type violations
                </div>
              </div>

              {/* Card 3: Uniqueness */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <Layers className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">20% Wgt</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mt-2.5">Uniqueness</h4>
                  <div className="text-2xl font-extrabold text-slate-900 font-sans mt-1">
                    {dimensions.uniqueness?.score || 100}%
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div
                      className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${dimensions.uniqueness?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
                  {dimensions.uniqueness?.duplicate_percentage ?? dimensions.uniqueness?.duplicate_rows ?? 0}% duplicate rows
                </div>
              </div>

              {/* Card 4: Consistency & Joins */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-teal-300 hover:shadow-xs transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">20% Wgt</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mt-2.5">Consistency & Joins</h4>
                  <div className="text-2xl font-extrabold text-slate-900 font-sans mt-1">
                    {dimensions.consistency?.score || 100}%
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div
                      className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${dimensions.consistency?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
                  {dimensions.consistency?.relationship_match_rate !== undefined
                    ? `${dimensions.consistency.relationship_match_rate}% match rate`
                    : '0 consistency issues'}
                </div>
              </div>

              {/* Card 5: Freshness */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-amber-300 hover:shadow-xs transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Clock className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">10% Wgt</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mt-2.5">Freshness</h4>
                  <div className="text-2xl font-extrabold text-slate-900 font-sans mt-1">
                    {dimensions.freshness?.score || 100}%
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${dimensions.freshness?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
                  {dimensions.freshness?.status ? `Status: ${dimensions.freshness.status}` : 'Data is up to date'}
                </div>
              </div>

              {/* Card 6: Schema & Volume */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <GitBranch className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">Volume</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mt-2.5">Schema & Volume</h4>
                  <div className="text-2xl font-extrabold text-slate-900 font-sans mt-1">
                    {qualityProfile.column_count || columnMetrics.length || 0}
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
                  {qualityProfile.column_count || columnMetrics.length || 0} dimensions tracked
                </div>
              </div>
            </div>
          </section>



          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 3. SEGMENTED TABS TOOLBAR                                         */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200 overflow-x-auto">
            <button
              type="button"
              id="tab-matrix-btn"
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'matrix'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Column Health Matrix</span>
            </button>

            <button
              type="button"
              id="tab-issues-btn"
              onClick={() => setActiveTab('issues')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'issues'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Detected Issues</span>
              {issues.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                    activeTab === 'issues' ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
                  }`}
                >
                  {issues.length}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-rules-btn"
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'rules'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>Quality Rules</span>
              {rules.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                    activeTab === 'rules' ? 'bg-white text-rose-700' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {rules.length}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-history-btn"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'history'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Evaluation History</span>
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 4. TAB 1: COLUMN HEALTH MATRIX                                    */}
          {/* ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'matrix' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              {/* Header + Controls Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                      Column Health Matrix
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Detailed quality metrics for each column in your dataset.
                    </p>
                  </div>
                </div>

                {/* Right Filter Controls Row */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Scope filter */}
                  <div className="relative">
                    <select
                      id="filter-column-scope"
                      value={scopeFilter}
                      onChange={(e) => setScopeFilter(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:border-rose-500 cursor-pointer shadow-2xs"
                    >
                      <option value="all">All Columns ({columnMetrics.length})</option>
                      <option value="missing">With Missing Values</option>
                      <option value="pk">Candidate Keys</option>
                    </select>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Data Type filter */}
                  <div className="relative">
                    <select
                      id="filter-column-type"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:border-rose-500 cursor-pointer shadow-2xs"
                    >
                      <option value="all">All Data Types</option>
                      <option value="string">String / Text</option>
                      <option value="number">Numeric</option>
                      <option value="date">Date / Time</option>
                      <option value="boolean">Boolean</option>
                    </select>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Reset Button */}
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                    title="Reset Search and Filters"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full max-w-md">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  id="search-columns-input"
                  placeholder="Search columns..."
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:border-rose-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-100 transition shadow-2xs"
                />
                {columnSearch && (
                  <button
                    type="button"
                    onClick={() => setColumnSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[760px]">
                    <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-5 py-3.5">COLUMN NAME</th>
                        <th className="px-4 py-3.5">DATA TYPE</th>
                        <th className="px-4 py-3.5">NULL / MISSING</th>
                        <th className="px-4 py-3.5">COMPLETENESS</th>
                        <th className="px-4 py-3.5">VALIDITY</th>
                        <th className="px-4 py-3.5">UNIQUENESS</th>
                        <th className="px-4 py-3.5">KEY STATUS</th>
                        <th className="px-4 py-3.5 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {filteredColumns.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 space-y-2">
                            <Layers className="h-8 w-8 text-slate-300 mx-auto" />
                            <p className="text-sm font-bold text-slate-700">No columns match criteria</p>
                            <p className="text-xs text-slate-400">
                              Try clearing your search query or resetting filters.
                            </p>
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="text-xs font-semibold text-rose-600 hover:underline pt-1 cursor-pointer"
                            >
                              Reset filters
                            </button>
                          </td>
                        </tr>
                      ) : (
                        filteredColumns.map((col, idx) => (
                          <tr key={idx} className={`hover:bg-slate-50/70 transition-colors ${actionMenuColumn === col.column_name ? 'relative z-30' : ''}`}>
                            <td className="px-5 py-3.5 font-bold text-slate-900 font-sans">
                              {col.column_name}
                            </td>
                            <td className="px-4 py-3.5">{getDataTypeBadge(col.data_type)}</td>
                            <td className="px-4 py-3.5">
                              {col.missing_count > 0 ? (
                                <span className="text-amber-700 font-semibold">
                                  {col.missing_count} ({((col.missing_count / (col.total_rows || 1)) * 100).toFixed(1)}%)
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">0 (0%)</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono font-bold text-slate-800 w-11">
                                  {col.completeness_pct}%
                                </span>
                                <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      col.completeness_pct >= 95 ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${col.completeness_pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono font-bold text-slate-800 w-11">
                                  {col.validity_pct}%
                                </span>
                                <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      col.validity_pct >= 95 ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${col.validity_pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono font-bold text-slate-800 w-11">
                                  {col.uniqueness_pct}%
                                </span>
                                <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-purple-500 h-1.5 rounded-full"
                                    style={{ width: `${col.uniqueness_pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              {col.is_candidate_pk ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/90 text-[10px] font-bold">
                                  <Key className="h-3 w-3 text-amber-500" />
                                  <span>Primary Key</span>
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right relative">
                              <button
                                type="button"
                                onClick={() => setActionMenuColumn(actionMenuColumn === col.column_name ? null : col.column_name)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50/80 transition cursor-pointer"
                                aria-label="Column actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {actionMenuColumn === col.column_name && (
                                <div
                                  ref={actionMenuRef}
                                  className={`absolute right-4 ${
                                    idx >= filteredColumns.length - 2 || filteredColumns.length <= 3
                                      ? 'bottom-full mb-1.5'
                                      : 'top-full mt-1'
                                  } w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 p-1 shadow-xl z-50 text-xs text-left animate-in fade-in duration-100`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRuleForColumn(col.column_name)}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition font-semibold cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-rose-600" />
                                    <span>Add Quality Rule</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuColumn(null);
                                      setColumnSearch(col.column_name);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition font-semibold cursor-pointer"
                                  >
                                    <Search className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Filter Column</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 5. TAB 2: DETECTED ISSUES                                         */}
          {/* ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'issues' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                      Detected Quality Issues
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Violations and anomalies captured during automated dimension profiling.
                    </p>
                  </div>
                </div>

                {/* Filter severity tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  {['all', 'critical', 'warning', 'info'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setIssueFilter(f)}
                      className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] transition cursor-pointer ${
                        issueFilter === f
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {filteredIssues.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-14 text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">No Quality Issues Detected</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    All evaluated columns meet configured validity thresholds and constraints.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIssues.map((iss, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition-all ${
                        iss.severity === 'critical'
                          ? 'bg-rose-50/40 border-rose-200/90 text-slate-900'
                          : iss.severity === 'warning'
                          ? 'bg-amber-50/40 border-amber-200/90 text-slate-900'
                          : 'bg-blue-50/40 border-blue-200/90 text-slate-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {iss.severity === 'critical' ? (
                            <XCircle className="h-5 w-5 text-rose-600" />
                          ) : iss.severity === 'warning' ? (
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                          ) : (
                            <Info className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-2xs">
                              {iss.dimension}
                            </span>
                            {iss.column && (
                              <span className="text-xs font-mono font-bold text-slate-800">
                                Column: {iss.column}
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                iss.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {iss.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">
                            {iss.message}
                          </p>
                        </div>
                      </div>

                      {iss.column && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenRuleForColumn(iss.column)}
                          className="shrink-0 text-xs font-semibold"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Rule</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 6. TAB 3: QUALITY RULES                                           */}
          {/* ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'rules' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                      Configured Quality Rules
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enforce domain-specific constraints (null checks, boundary ranges, regex patterns, allowed sets).
                    </p>
                  </div>
                </div>

                <Button
                  id="add-rule-btn"
                  onClick={() => {
                    setRuleError('');
                    setIsRuleModalOpen(true);
                  }}
                  variant="primary"
                  className="h-9 px-3.5 rounded-xl text-xs font-semibold shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Quality Rule</span>
                </Button>
              </div>

              {rules.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-14 text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto">
                    <Sliders className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">No Custom Rules Configured</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Define custom column constraints to automatically validate future ingested batches.
                  </p>
                  <Button
                    onClick={() => setIsRuleModalOpen(true)}
                    variant="primary"
                    size="sm"
                    className="mt-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create First Rule</span>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="bg-white border border-slate-200/90 rounded-xl p-4.5 flex items-start justify-between gap-3 shadow-2xs hover:border-rose-200 hover:shadow-xs transition-all"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{rule.column_name}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/90 uppercase font-mono">
                            {rule.rule_type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                              rule.severity === 'critical'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {rule.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono truncate max-w-sm">
                          Config: {JSON.stringify(rule.configuration || {})}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Created by: {rule.creator_name || 'Admin'}
                        </p>
                      </div>

                      <button
                        type="button"
                        id={`delete-rule-${rule.id}`}
                        onClick={() => handleOpenDeleteRule(rule)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                        title="Delete Rule"
                        aria-label={`Delete Rule for ${rule.column_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 7. TAB 4: EVALUATION HISTORY                                      */}
          {/* ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                    Evaluation Audit History
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historical audit snapshots with score progression and scan records.
                  </p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-14 text-center space-y-3">
                  <Calendar className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-900">No Evaluation History Recorded</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Click "Run Audit" to execute a scan and generate the first snapshot entry.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-5 py-3.5">EVALUATED AT</th>
                          <th className="px-4 py-3.5">QUALITY SCORE</th>
                          <th className="px-4 py-3.5">STATUS</th>
                          <th className="px-4 py-3.5">COMPLETENESS</th>
                          <th className="px-4 py-3.5">VALIDITY</th>
                          <th className="px-4 py-3.5">UNIQUENESS</th>
                          <th className="px-4 py-3.5">SCAN MODE</th>
                          <th className="px-4 py-3.5">EVALUATED ROWS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {history.map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-5 py-3.5 text-slate-900 font-semibold font-mono">
                              {new Date(h.evaluated_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                              <span
                                className={`px-2 py-0.5 rounded font-mono font-bold ${
                                  h.quality_score >= 85
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {h.quality_score}%
                              </span>
                            </td>
                            <td className="px-4 py-3.5">{getStatusBadge(h.status)}</td>
                            <td className="px-4 py-3.5 font-mono">{h.completeness}%</td>
                            <td className="px-4 py-3.5 font-mono">{h.validity}%</td>
                            <td className="px-4 py-3.5 font-mono">{h.uniqueness}%</td>
                            <td className="px-4 py-3.5 text-rose-700 font-mono text-[11px] font-semibold">
                              {h.scan_mode || 'FULL_SCAN'}
                            </td>
                            <td className="px-4 py-3.5 font-mono">
                              {h.row_count ? Number(h.row_count).toLocaleString() : 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 8. CREATE RULE MODAL                                              */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <Sliders className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Quality Rule</h3>
                  <p className="text-[11px] text-slate-500">Define automated validation constraint</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {ruleError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{ruleError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Column</label>
                <select
                  value={ruleForm.columnName}
                  onChange={(e) => setRuleForm({ ...ruleForm, columnName: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:border-rose-600 shadow-2xs cursor-pointer font-medium"
                  required
                >
                  <option value="">Select a column</option>
                  {columnMetrics.map((c, i) => (
                    <option key={i} value={c.column_name}>
                      {c.column_name} ({c.data_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rule Type</label>
                <select
                  value={ruleForm.ruleType}
                  onChange={(e) => setRuleForm({ ...ruleForm, ruleType: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:border-rose-600 shadow-2xs cursor-pointer font-medium"
                >
                  <option value="not_null">Must Not Be Null / Empty</option>
                  <option value="unique">Must Be Unique</option>
                  <option value="min_value">Minimum Value (&gt;= min)</option>
                  <option value="max_value">Maximum Value (&lt;= max)</option>
                  <option value="range">Range [min, max]</option>
                  <option value="regex">Regex Pattern Match</option>
                  <option value="allowed_values">Allowed Values Set</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Severity Level</label>
                <select
                  value={ruleForm.severity}
                  onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:border-rose-600 shadow-2xs cursor-pointer font-medium"
                >
                  <option value="warning">Warning (Non-blocking alert)</option>
                  <option value="critical">Critical (Fails ingestion quality score)</option>
                  <option value="info">Info (Informational telemetry)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={creatingRule}
                  variant="primary"
                  className="h-9 px-4 rounded-xl text-xs font-semibold"
                >
                  {creatingRule ? 'Creating...' : 'Save Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 9. DELETE RULE CONFIRMATION MODAL                                 */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {ruleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Quality Rule</h3>
                <p className="text-[11px] text-slate-500">Remove validation constraint</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove the <strong className="text-slate-900 font-semibold">{ruleToDelete.rule_type}</strong> constraint on column <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[11px] font-semibold">{ruleToDelete.column_name}</code>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                id="cancel-delete-rule-btn"
                onClick={() => setRuleToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <Button
                id="confirm-delete-rule-btn"
                type="button"
                onClick={handleConfirmDeleteRule}
                disabled={deletingRule}
                variant="danger"
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                {deletingRule ? 'Deleting...' : 'Delete Rule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
