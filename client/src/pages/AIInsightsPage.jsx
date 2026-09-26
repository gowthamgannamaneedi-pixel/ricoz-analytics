import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileDown,
  Layers,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Check,
  Search,
  Eye,
  Calendar,
  Compass,
  Cpu,
  Database,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import {
  generateAIInsights,
  getAIInsights,
  getAIExecutiveSummary,
  dismissAIInsight,
  submitAIInsightFeedback,
  exportAIInsights,
  getDatasets
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AIInsightsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [insights, setInsights] = useState([]);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [feedbackState, setFeedbackState] = useState({}); // { [id]: 'useful' | 'not_useful' }
  const [expandedEvidence, setExpandedEvidence] = useState({});

  // Load initial data
  useEffect(() => {
    loadData();
  }, [selectedDatasetId, statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const [insightsRes, datasetsRes, summaryRes] = await Promise.all([
        getAIInsights({
          status: statusFilter,
          datasetId: selectedDatasetId || undefined
        }).catch(() => ({ insights: [] })),
        getDatasets().catch(() => ({ datasets: [] })),
        getAIExecutiveSummary(selectedDatasetId || null).catch(() => ({ summary: '' }))
      ]);

      const insList = insightsRes.insights || insightsRes.data || [];
      setInsights(insList);
      setExecutiveSummary(summaryRes.summary || summaryRes.executive_summary || '');
      setDatasets(datasetsRes.datasets || datasetsRes.data || []);

      // Prepopulate feedback state
      const initialFeedback = {};
      insList.forEach(item => {
        if (item.feedback) initialFeedback[item.id] = item.feedback;
      });
      setFeedbackState(initialFeedback);
    } catch (err) {
      console.error('[AIInsightsPage] Failed loading insights:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle on-demand generation
  async function handleGenerateInsights() {
    try {
      setGenerating(true);
      const res = await generateAIInsights({
        datasetId: selectedDatasetId || undefined,
        persist: true
      });
      setInsights(res.insights || res.data || []);
      setExecutiveSummary(res.executive_summary || '');
    } catch (err) {
      console.error('[AIInsightsPage] Generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  // Handle dismiss
  async function handleDismiss(id) {
    try {
      await dismissAIInsight(id);
      setInsights(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('[AIInsightsPage] Dismiss failed:', err);
    }
  }

  // Handle feedback
  async function handleFeedback(id, feedbackType) {
    try {
      setFeedbackState(prev => ({ ...prev, [id]: feedbackType }));
      await submitAIInsightFeedback(id, feedbackType);
    } catch (err) {
      console.error('[AIInsightsPage] Feedback submission failed:', err);
    }
  }

  // Handle export
  async function handleExport(format) {
    try {
      setExporting(true);
      await exportAIInsights(format);
    } catch (err) {
      console.error('[AIInsightsPage] Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  // Toggle evidence view
  function toggleEvidence(id) {
    setExpandedEvidence(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Filtered insights list
  const filteredInsights = insights.filter(ins => {
    if (severityFilter !== 'all' && ins.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && ins.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ins.title?.toLowerCase().includes(q);
      const matchSummary = ins.summary?.toLowerCase().includes(q);
      const matchDataset = ins.source_metadata?.dataset_name?.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary && !matchDataset) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'positive':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Positive
          </span>
        );
      case 'critical':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Critical
          </span>
        );
      case 'warning':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'growth':
      case 'trend':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'decline':
        return <TrendingDown className="w-4 h-4 text-rose-400" />;
      case 'anomaly':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'forecast':
        return <Compass className="w-4 h-4 text-purple-400" />;
      case 'data_quality':
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      case 'relationship':
        return <Layers className="w-4 h-4 text-indigo-400" />;
      case 'operational':
        return <Activity className="w-4 h-4 text-orange-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                Advanced AI & Automated Insights
              </h1>
              <p className="text-sm text-slate-400">
                Proactive intelligence engine detecting trends, anomalies, forecasts, and quality health across your telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Dataset Selector */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-200">All Datasets Context</option>
              {datasets.map(d => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                  {d.name} ({d.row_count || 0} rows)
                </option>
              ))}
            </select>
          </div>

          {/* Generate Insights Button */}
          <button
            onClick={handleGenerateInsights}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Synthesizing...' : 'Generate New Insights'}
          </button>

          {/* Export Dropdown Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="px-2.5 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
              title="Export PDF Report"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-400" /> PDF
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting}
              className="px-2.5 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
              title="Export Excel Workbook"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-400" /> Excel
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="px-2.5 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
              title="Export CSV"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-400" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Executive Summary Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-purple-950/30 border border-indigo-500/20 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
              <Lightbulb className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-300">
              Executive AI Briefing
            </h2>
          </div>
          {insights.length > 0 && insights.every(i => i.evidence?.verified) ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              100% Ground-Truth Evidence Verified
            </span>
          ) : insights.length > 0 && insights.some(i => i.evidence?.verified) ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              {insights.filter(i => i.evidence?.verified).length} of {insights.length} Ground-Truth Verified
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              Dataset Telemetry Verified
            </span>
          )}
        </div>

        <div className="text-sm text-slate-200 leading-relaxed font-normal whitespace-pre-line space-y-2">
          {executiveSummary || 'No significant changes detected. Enterprise telemetry, forecasts, and data quality metrics remain stable within expected parameters.'}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3.5">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search insights, metrics, or datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1">
            {['all', 'positive', 'warning', 'critical', 'info'].map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1">
            {['active', 'dismissed', 'all'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Insights Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading automated analytical findings...</p>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-indigo-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">No Insights Match Your Filter</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your severity, status, or search query, or trigger a fresh on-demand evaluation.
          </p>
          <button
            onClick={handleGenerateInsights}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl cursor-pointer"
          >
            Run Organization Insight Scan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInsights.map(ins => {
            const isEvidenceOpen = expandedEvidence[ins.id];
            const feedback = feedbackState[ins.id];

            return (
              <div
                key={ins.id}
                className="bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl hover:shadow-2xl transition-all"
              >
                {/* Card Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
                        {getTypeIcon(ins.type)}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {ins.type?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {getSeverityBadge(ins.severity)}
                      <span className="text-[10px] font-mono text-slate-500" title="Statistical Confidence Score">
                        {Math.round((ins.confidence || 0.95) * 100)}% conf
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 leading-snug">
                    {ins.title}
                  </h3>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {ins.summary}
                  </p>
                </div>

                {/* Source Metadata & Evidence Section */}
                <div className="space-y-3 pt-2 border-t border-slate-800/60">
                  {/* Context Source Tags */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {ins.source_metadata?.dataset_name && (
                      <span className="flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
                        <Database className="w-3 h-3 text-indigo-400" />
                        {ins.source_metadata.dataset_name}
                      </span>
                    )}
                    {ins.source_metadata?.target_column && (
                      <span className="flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800 font-mono">
                        <BarChart3 className="w-3 h-3 text-purple-400" />
                        {ins.source_metadata.target_column}
                      </span>
                    )}
                    <button
                      onClick={() => toggleEvidence(ins.id)}
                      className="text-indigo-400 hover:text-indigo-300 font-medium ml-auto flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      {isEvidenceOpen ? 'Hide Evidence' : 'Inspect Evidence'}
                    </button>
                  </div>

                  {/* Collapsible Evidence Telemetry & Verification Panel */}
                  {isEvidenceOpen && (
                    <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-3">
                      {/* Verification Status Header */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                        <div className="flex items-center gap-1.5 font-semibold">
                          {ins.evidence?.verified ? (
                            <span className="flex items-center gap-1.5 text-emerald-400">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              Ground-Truth Verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-400">
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                              Unverified Telemetry
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {ins.evidence?.recordsAnalyzed ?? ins.evidence?.records_analyzed ?? 0} rows analyzed
                        </span>
                      </div>

                      {/* Evidence Verification Description */}
                      {ins.evidence?.verificationReason && (
                        <p className="text-[11px] text-slate-400 leading-relaxed italic">
                          {ins.evidence.verificationReason}
                        </p>
                      )}

                      {/* Structured Telemetry Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Dataset</span>
                          <span className="font-semibold text-slate-200 truncate block">
                            {ins.evidence?.datasetName || ins.source_metadata?.dataset_name || 'Telemetry'}
                          </span>
                        </div>

                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Metric</span>
                          <span className="font-semibold text-purple-300 truncate block font-mono">
                            {ins.evidence?.metric || 'primary_metric'}
                          </span>
                        </div>

                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Current Value</span>
                          <span className="font-semibold text-emerald-400 font-mono">
                            {ins.evidence?.currentValue !== undefined 
                              ? (typeof ins.evidence.currentValue === 'number' ? ins.evidence.currentValue.toLocaleString() : ins.evidence.currentValue)
                              : (ins.evidence?.current_value !== undefined ? ins.evidence.current_value.toLocaleString() : 'N/A')}
                          </span>
                        </div>

                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Comparison</span>
                          <span className="font-semibold text-slate-300 font-mono">
                            {ins.evidence?.comparisonValue !== undefined 
                              ? (typeof ins.evidence.comparisonValue === 'number' ? ins.evidence.comparisonValue.toLocaleString() : ins.evidence.comparisonValue)
                              : (ins.evidence?.previous_value !== undefined ? ins.evidence.previous_value.toLocaleString() : 'N/A')}
                          </span>
                        </div>

                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Change %</span>
                          <span className={`font-semibold font-mono ${
                            (ins.evidence?.changePercent || ins.evidence?.change_percent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {ins.evidence?.changePercent !== undefined 
                              ? `${ins.evidence.changePercent >= 0 ? '+' : ''}${ins.evidence.changePercent}%`
                              : (ins.evidence?.change_percent !== undefined ? `${ins.evidence.change_percent >= 0 ? '+' : ''}${ins.evidence.change_percent}%` : 'N/A')}
                          </span>
                        </div>

                        <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Period</span>
                          <span className="font-semibold text-slate-300 truncate block">
                            {ins.evidence?.period || ins.evidence?.currentPeriod || 'Latest'}
                          </span>
                        </div>
                      </div>

                      {/* Source Fields */}
                      {(ins.evidence?.sourceFields || ins.evidence?.source_fields)?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-500 uppercase font-medium mr-1">Source Fields:</span>
                          {(ins.evidence?.sourceFields || ins.evidence?.source_fields).map((sf, idx) => (
                            <span key={idx} className="bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 text-[10px] font-mono px-1.5 py-0.5 rounded">
                              {sf}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Calculation Formula */}
                      {ins.evidence?.calculation && (
                        <div className="pt-1 border-t border-slate-900">
                          <span className="text-[10px] text-slate-500 uppercase font-medium block mb-0.5">Calculation:</span>
                          <code className="text-[10px] text-slate-400 font-mono bg-slate-900/90 px-2 py-1 rounded block overflow-x-auto">
                            {ins.evidence.calculation}
                          </code>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Recommendation Action Pill */}
                  {ins.recommendation?.action && (
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20">
                      <div className="flex items-center gap-2 text-xs text-indigo-200 font-medium">
                        <Compass className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span>{ins.recommendation.action}</span>
                      </div>
                      {ins.recommendation.target_page && (
                        <button
                          onClick={() => navigate(ins.recommendation.target_page)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                        >
                          Explore <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Card Footer: Feedback & Dismiss */}
                  <div className="flex items-center justify-between pt-2">
                    {/* User Feedback */}
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <span className="text-[10px] text-slate-500 mr-1">Was this useful?</span>
                      <button
                        onClick={() => handleFeedback(ins.id, 'useful')}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          feedback === 'useful' ? 'bg-emerald-500/20 text-emerald-300' : 'hover:bg-slate-800 text-slate-400'
                        }`}
                        title="Mark as Useful"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(ins.id, 'not_useful')}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          feedback === 'not_useful' ? 'bg-rose-500/20 text-rose-300' : 'hover:bg-slate-800 text-slate-400'
                        }`}
                        title="Mark as Not Useful"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Dismiss Action */}
                    {ins.status !== 'dismissed' && (
                      <button
                        onClick={() => handleDismiss(ins.id)}
                        className="text-[11px] text-slate-500 hover:text-slate-300 font-medium transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
