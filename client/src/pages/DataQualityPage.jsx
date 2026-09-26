import React, { useState, useEffect } from 'react';
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
  Eye,
  Activity,
  Calendar,
  Key,
  Info,
  Sparkles,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import {
  getDatasets,
  getDatasetQuality,
  evaluateDatasetQuality,
  getDatasetQualityHistory,
  getDataQualityRules,
  createDataQualityRule,
  deleteDataQualityRule,
  getQualityExportUrl
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DataQualityPage() {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [qualityProfile, setQualityProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [rules, setRules] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // overview, columns, issues, history, rules
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [scanMode, setScanMode] = useState('full'); // full, sampled
  const [sampleSize, setSampleSize] = useState(1000);
  const [columnSearch, setColumnSearch] = useState('');
  const [issueFilter, setIssueFilter] = useState('all');

  // Rule Creation Modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    columnName: '',
    ruleType: 'not_null',
    severity: 'warning',
    configuration: {}
  });
  const [ruleError, setRuleError] = useState('');
  const [ruleSuccess, setRuleSuccess] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);

  // Load all user/org datasets on mount
  useEffect(() => {
    async function loadDatasets() {
      try {
        setLoading(true);
        const res = await getDatasets();
        const list = res.datasets || res.data || [];
        setDatasets(list);
        if (list.length > 0) {
          // Check query params if navigated with ?datasetId=X
          const urlParams = new URLSearchParams(window.location.search);
          const paramId = urlParams.get('datasetId');
          const matched = list.find(d => String(d.id) === String(paramId));
          setSelectedDatasetId(matched ? matched.id : list[0].id);
        }
      } catch (err) {
        console.error('Failed to load datasets:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDatasets();
  }, []);

  // When selectedDatasetId changes, load quality profile, history, and rules
  useEffect(() => {
    if (!selectedDatasetId) return;

    async function loadQualityData() {
      try {
        setLoading(true);
        const [profileRes, histRes, rulesRes] = await Promise.all([
          getDatasetQuality(selectedDatasetId).catch(() => ({ data: null })),
          getDatasetQualityHistory(selectedDatasetId).catch(() => ({ history: [] })),
          getDataQualityRules(selectedDatasetId).catch(() => ({ rules: [] }))
        ]);

        setQualityProfile(profileRes.data || profileRes.profile || null);
        setHistory(histRes.history || histRes.data || []);
        setRules(rulesRes.rules || rulesRes.data || []);
      } catch (err) {
        console.error('Failed to fetch dataset quality data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadQualityData();
  }, [selectedDatasetId]);

  // Trigger quality evaluation scan
  const handleRunAudit = async () => {
    if (!selectedDatasetId) return;
    try {
      setEvaluating(true);
      const options = {
        fullScan: scanMode === 'full',
        sampleSize: scanMode === 'sampled' ? sampleSize : null
      };
      const res = await evaluateDatasetQuality(selectedDatasetId, options);
      const newProfile = res.data || res.profile;
      setQualityProfile(newProfile);

      // Refresh history
      const histRes = await getDatasetQualityHistory(selectedDatasetId);
      setHistory(histRes.history || histRes.data || []);
    } catch (err) {
      console.error('Quality audit failed:', err);
    } finally {
      setEvaluating(false);
    }
  };

  // Handle rule creation
  const handleCreateRule = async (e) => {
    e.preventDefault();
    setRuleError('');
    setRuleSuccess('');

    if (!ruleForm.columnName || !ruleForm.ruleType) {
      setRuleError('Column name and rule type are required.');
      return;
    }

    try {
      setCreatingRule(true);
      await createDataQualityRule({
        datasetId: selectedDatasetId,
        columnName: ruleForm.columnName,
        ruleType: ruleForm.ruleType,
        severity: ruleForm.severity,
        configuration: ruleForm.configuration
      });

      setRuleSuccess('Quality rule created successfully!');
      // Refresh rules
      const rulesRes = await getDataQualityRules(selectedDatasetId);
      setRules(rulesRes.rules || rulesRes.data || []);
      setTimeout(() => {
        setIsRuleModalOpen(false);
        setRuleSuccess('');
      }, 1000);
    } catch (err) {
      setRuleError(err.message || 'Failed to create quality rule.');
    } finally {
      setCreatingRule(false);
    }
  };

  // Handle rule deletion
  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this quality rule?')) return;
    try {
      await deleteDataQualityRule(ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const selectedDataset = datasets.find(d => String(d.id) === String(selectedDatasetId));
  const dimensions = qualityProfile?.dimensions || {};
  const issues = qualityProfile?.issues || [];
  const columnMetrics = qualityProfile?.column_metrics || [];

  // Filter columns
  const filteredColumns = columnMetrics.filter(col =>
    col.column_name.toLowerCase().includes(columnSearch.toLowerCase()) ||
    col.data_type.toLowerCase().includes(columnSearch.toLowerCase())
  );

  // Filter issues
  const filteredIssues = issues.filter(iss => {
    if (issueFilter === 'all') return true;
    return iss.severity === issueFilter || iss.dimension === issueFilter;
  });

  const getScoreColor = (score) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 70) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Healthy</span>;
      case 'warning':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Warning</span>;
      case 'critical':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Critical</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Unknown</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header & Dataset Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Data Quality & Observability
              </h1>
              <p className="text-sm text-slate-400">
                Continuous telemetry, anomaly detection, schema tracking, and relational integrity.
              </p>
            </div>
          </div>
        </div>

        {/* Dataset selector & action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer"
            >
              {datasets.map(d => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                  {d.name} ({d.row_count || 0} rows)
                </option>
              ))}
            </select>
          </div>

          {/* Scan mode selector */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setScanMode('full')}
              className={`px-3 py-1.5 rounded-lg transition-all ${scanMode === 'full' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Full Scan
            </button>
            <button
              onClick={() => setScanMode('sampled')}
              className={`px-3 py-1.5 rounded-lg transition-all ${scanMode === 'sampled' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Sampled (1k)
            </button>
          </div>

          {/* Run Audit Button */}
          <button
            onClick={handleRunAudit}
            disabled={evaluating || !selectedDatasetId}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
            {evaluating ? 'Evaluating...' : 'Run Quality Audit'}
          </button>

          {/* Export Dropdown / Buttons */}
          {selectedDatasetId && (
            <div className="flex items-center gap-1.5">
              <a
                href={getQualityExportUrl(selectedDatasetId, 'pdf')}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
                title="Export PDF Audit Report"
              >
                <FileDown className="w-3.5 h-3.5 text-rose-400" /> PDF
              </a>
              <a
                href={getQualityExportUrl(selectedDatasetId, 'excel')}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
                title="Export Excel Audit Workbook"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-400" /> Excel
              </a>
              <a
                href={getQualityExportUrl(selectedDatasetId, 'json')}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
                title="Export JSON Telemetry"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-400" /> JSON
              </a>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading dataset quality intelligence...</p>
        </div>
      ) : !qualityProfile ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-200">No Quality Profile Found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Click "Run Quality Audit" to compute measurable quality dimensions for this dataset.
          </p>
          <button
            onClick={handleRunAudit}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl"
          >
            Run Initial Evaluation
          </button>
        </div>
      ) : (
        <>
          {/* Hero Quality Score Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Main Score Card */}
            <div className="lg:col-span-1 bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/90 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Overall Dataset Health
                </span>
                {getStatusBadge(qualityProfile.status)}
              </div>

              <div className="my-6 flex items-baseline gap-3">
                <span className={`text-6xl font-extrabold tracking-tight ${getScoreColor(qualityProfile.quality_score).split(' ')[0]}`}>
                  {qualityProfile.quality_score}
                </span>
                <span className="text-xl font-medium text-slate-500">/ 100</span>
              </div>

              <div className="space-y-2 text-xs text-slate-400 border-t border-slate-800/80 pt-4">
                <div className="flex justify-between">
                  <span>Scan Execution:</span>
                  <span className="font-semibold text-indigo-300">{qualityProfile.scan_mode || 'FULL_SCAN'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Evaluated Rows:</span>
                  <span className="font-semibold text-slate-200">{qualityProfile.evaluated_rows?.toLocaleString()} / {qualityProfile.total_rows?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Schema Hash:</span>
                  <span className="font-mono text-slate-400">{qualityProfile.schema_hash?.substring(0, 8)}...</span>
                </div>
              </div>
            </div>

            {/* 6 Dimensions Grid */}
            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Completeness */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Completeness</span>
                  <span className="text-[10px] text-slate-500">25% Weight</span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-bold text-slate-100">
                    {dimensions.completeness?.score || 100}%
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full"
                      style={{ width: `${dimensions.completeness?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  {dimensions.completeness?.missing_cells || 0} missing cells detected
                </div>
              </div>

              {/* Validity */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Validity / Types</span>
                  <span className="text-[10px] text-slate-500">25% Weight</span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-bold text-slate-100">
                    {dimensions.validity?.score || 100}%
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${dimensions.validity?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  {dimensions.validity?.invalid_count || 0} type/rule violations
                </div>
              </div>

              {/* Uniqueness */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Uniqueness</span>
                  <span className="text-[10px] text-slate-500">20% Weight</span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-bold text-slate-100">
                    {dimensions.uniqueness?.score || 100}%
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{ width: `${dimensions.uniqueness?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  {dimensions.uniqueness?.duplicate_rows || 0} duplicate records ({dimensions.uniqueness?.duplicate_percentage || 0}%)
                </div>
              </div>

              {/* Consistency */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Consistency & Joins</span>
                  <span className="text-[10px] text-slate-500">20% Weight</span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-bold text-slate-100">
                    {dimensions.consistency?.score || 100}%
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-teal-500 h-1.5 rounded-full"
                      style={{ width: `${dimensions.consistency?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  {dimensions.consistency?.relationship_match_rate || 100}% join match rate
                </div>
              </div>

              {/* Freshness */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Freshness</span>
                  <span className="text-[10px] text-slate-500">10% Weight</span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-bold text-slate-100">
                    {dimensions.freshness?.score || 100}%
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: `${dimensions.freshness?.score || 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  Status: <span className="font-medium text-amber-300">{dimensions.freshness?.status || 'healthy'}</span>
                </div>
              </div>

              {/* Volume & Schema Health */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Schema & Volume</span>
                  <span className="text-[10px] text-slate-500">Telemetry</span>
                </div>
                <div className="my-3">
                  <div className="text-2xl font-bold text-slate-100 flex items-center gap-1.5">
                    {qualityProfile.column_count || 0} <span className="text-xs text-slate-400 font-normal">columns</span>
                  </div>
                  <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Stable schema drift
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  {qualityProfile.total_rows?.toLocaleString() || 0} total records
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800/80 pt-2">
            {[
              { id: 'overview', label: 'Column Health Matrix', icon: Layers, badge: columnMetrics.length },
              { id: 'issues', label: 'Detected Issues', icon: AlertTriangle, badge: issues.length },
              { id: 'rules', label: 'Quality Rules', icon: Sliders, badge: rules.length },
              { id: 'history', label: 'Evaluation History', icon: Calendar, badge: history.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab 1: Column Health Matrix */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative w-72">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search columns or types..."
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="text-xs text-slate-400">
                  Showing {filteredColumns.length} of {columnMetrics.length} columns
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5">Column Name</th>
                        <th className="px-4 py-3.5">Data Type</th>
                        <th className="px-4 py-3.5">Null / Missing</th>
                        <th className="px-4 py-3.5">Completeness</th>
                        <th className="px-4 py-3.5">Validity</th>
                        <th className="px-4 py-3.5">Distinct / Uniqueness</th>
                        <th className="px-4 py-3.5">Key Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {filteredColumns.map((col, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-slate-200">
                            {col.column_name}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono text-[11px]">
                              {col.data_type}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {col.missing_count > 0 ? (
                              <span className="text-amber-400 font-medium">
                                {col.missing_count} ({col.null_count} null, {col.empty_count} empty)
                              </span>
                            ) : (
                              <span className="text-emerald-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${col.completeness_pct >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {col.completeness_pct}%
                              </span>
                              <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${col.completeness_pct >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                  style={{ width: `${col.completeness_pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`font-semibold ${col.validity_pct >= 95 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {col.validity_pct}%
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {col.distinct_count} distinct ({col.uniqueness_pct}%)
                          </td>
                          <td className="px-4 py-3.5">
                            {col.is_candidate_pk ? (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold flex items-center gap-1 w-max">
                                <Key className="w-3 h-3" /> Candidate PK
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Detected Issues */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {['all', 'critical', 'warning', 'info'].map(f => (
                  <button
                    key={f}
                    onClick={() => setIssueFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      issueFilter === f
                        ? 'bg-slate-200 text-slate-900'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>

              {filteredIssues.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-200">No Quality Issues Detected</p>
                  <p className="text-xs text-slate-400">All data quality dimensions meet target thresholds.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIssues.map((iss, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all ${
                        iss.severity === 'critical'
                          ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                          : iss.severity === 'warning'
                          ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                          : 'bg-blue-950/20 border-blue-800/40 text-blue-200'
                      }`}
                    >
                      <div className="mt-0.5">
                        {iss.severity === 'critical' ? (
                          <XCircle className="w-5 h-5 text-rose-400" />
                        ) : iss.severity === 'warning' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Info className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/50">
                            {iss.dimension}
                          </span>
                          {iss.column && (
                            <span className="text-xs font-mono text-slate-300">
                              Column: {iss.column}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-200">
                          {iss.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Quality Rules Management */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Define custom validation rules for columns (null checks, boundary conditions, regex, allowed values).
                </p>
                <button
                  onClick={() => setIsRuleModalOpen(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Quality Rule
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <Sliders className="w-10 h-10 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-200">No Custom Rules Configured</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Create custom column rules to enforce domain specific data quality constraints.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-3 shadow-lg"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 text-sm">{rule.column_name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                            {rule.rule_type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rule.severity === 'critical' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {rule.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Config: {JSON.stringify(rule.configuration || {})}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Evaluation History */}
          {activeTab === 'history' && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Evaluated At</th>
                    <th className="px-4 py-3.5">Quality Score</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Completeness</th>
                    <th className="px-4 py-3.5">Validity</th>
                    <th className="px-4 py-3.5">Uniqueness</th>
                    <th className="px-4 py-3.5">Scan Mode</th>
                    <th className="px-4 py-3.5">Row Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {history.map((h, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-slate-300 font-medium">
                        {new Date(h.evaluated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-100">
                        {h.quality_score}/100
                      </td>
                      <td className="px-4 py-3.5">
                        {getStatusBadge(h.status)}
                      </td>
                      <td className="px-4 py-3.5">{h.completeness}%</td>
                      <td className="px-4 py-3.5">{h.validity}%</td>
                      <td className="px-4 py-3.5">{h.uniqueness}%</td>
                      <td className="px-4 py-3.5 text-indigo-300 font-mono text-[11px]">{h.scan_mode || 'FULL_SCAN'}</td>
                      <td className="px-4 py-3.5">{h.row_count?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Create Data Quality Rule</h3>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {ruleError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs">
                {ruleError}
              </div>
            )}
            {ruleSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs">
                {ruleSuccess}
              </div>
            )}

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Column</label>
                <select
                  value={ruleForm.columnName}
                  onChange={(e) => setRuleForm({ ...ruleForm, columnName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
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
                <label className="block text-slate-300 font-medium mb-1">Rule Type</label>
                <select
                  value={ruleForm.ruleType}
                  onChange={(e) => setRuleForm({ ...ruleForm, ruleType: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="not_null">Must Not Be Null / Empty</option>
                  <option value="unique">Must Be Unique</option>
                  <option value="min_value">Minimum Value (&gt;= min)</option>
                  <option value="max_value">Maximum Value (&lt;= max)</option>
                  <option value="range">Range [min, max]</option>
                  <option value="regex">Regex Pattern Match</option>
                  <option value="allowed_values">Allowed Values Set</option>
                  <option value="type_check">Explicit Type Check</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Severity</label>
                <select
                  value={ruleForm.severity}
                  onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                  <option value="info">Info</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRule}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl disabled:opacity-50"
                >
                  {creatingRule ? 'Creating...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
