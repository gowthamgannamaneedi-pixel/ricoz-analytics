import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  ArrowUpRight,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Check,
  Search,
  Eye,
  EyeOff,
  Calendar,
  Compass,
  Cpu,
  Database,
  BarChart3,
  Lightbulb,
  Star,
  Share2,
  Lock,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Beaker,
  GitBranch
} from 'lucide-react';
import {
  generateAIInsights,
  getAIInsights,
  getAIExecutiveSummary,
  dismissAIInsight,
  submitAIInsightFeedback,
  exportAIInsights,
  getDatasets,
  toggleFavoriteApi,
  getFavoritesApi,
  recordRecentlyViewedApi
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import RootCauseDrawer from '../components/RootCauseDrawer';
import ScenarioSimulatorModal from '../components/ScenarioSimulatorModal';
import ShareModal from '../components/ShareModal';

export default function AIInsightsPage() {
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetInsightId = searchParams.get('id');

  const [insights, setInsights] = useState([]);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [rootCauseInsight, setRootCauseInsight] = useState(null);
  const [simulatorData, setSimulatorData] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [feedbackState, setFeedbackState] = useState({});
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const [briefing, setBriefing] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [error, setError] = useState(null);

  // Collaboration State
  const [favorites, setFavorites] = useState(new Set());
  const [shareModalConfig, setShareModalConfig] = useState({ isOpen: false, insightId: null, title: '' });

  // Load initial data
  useEffect(() => {
    loadData();
  }, [selectedDatasetId, statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
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
      setBriefing(summaryRes.briefing || null);
      setRelationships(summaryRes.relationships || []);
      setDatasets(datasetsRes.datasets || datasetsRes.data || []);

      // Prepopulate feedback state
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

      // Record recently viewed if target ID opened via URL
      if (targetInsightId) {
        recordRecentlyViewedApi('ai_insight', targetInsightId).catch(() => {});
      }
    } catch (err) {
      console.error('[AIInsightsPage] Failed loading insights:', err);
      setError('Could not connect to the AI insights service.');
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
      setBriefing(res.briefing || null);
      setRelationships(res.relationships || []);
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

  // Handle favorite toggle
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
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

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

  const hasActiveFilters = searchQuery !== '' || severityFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'active';
  const resetFilters = () => {
    setSearchQuery('');
    setSeverityFilter('all');
    setTypeFilter('all');
    setStatusFilter('active');
  };

  // --- Badge helpers ---
  const getPriorityBadge = (priority) => {
    const p = String(priority || 'medium').toLowerCase();
    switch (p) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
            <XCircle className="w-3 h-3" /> Critical
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> High
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
            <Activity className="w-3 h-3" /> Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
            <Activity className="w-3 h-3" /> Low
          </span>
        );
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <TrendingUp className="w-3 h-3" /> Positive
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Critical
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <Activity className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'growth':
      case 'trend':
        return <TrendingUp className="w-4 h-4 text-emerald-600" />;
      case 'decline':
        return <TrendingDown className="w-4 h-4 text-rose-600" />;
      case 'anomaly':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'forecast':
        return <Compass className="w-4 h-4 text-purple-600" />;
      case 'data_quality':
        return <ShieldCheck className="w-4 h-4 text-cyan-600" />;
      case 'relationship':
        return <Layers className="w-4 h-4 text-blue-600" />;
      case 'operational':
        return <Activity className="w-4 h-4 text-orange-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTypeLabel = (type) => {
    if (!type) return 'Insight';
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const verifiedCount = insights.filter(i => i.evidence?.verified).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              AI Insights
            </h1>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Analyst'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            Evidence-grounded intelligence to help you understand what is changing across your business.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Dataset Scope Selector */}
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
          >
            <option value="">All Datasets</option>
            {datasets.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.row_count || 0} rows)
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            title="Refresh insights"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleGenerateInsights}
            disabled={generating}
            id="generate-insights-btn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Analyzing...' : 'Generate Insights'}</span>
          </button>

          {/* Export */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-white shadow-2xs">
            {['pdf', 'excel', 'csv'].map(fmt => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={exporting}
                className="px-2 py-1.5 rounded-md text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer disabled:opacity-50"
                title={`Export ${fmt.toUpperCase()}`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Executive Briefing Section */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Lightbulb className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Executive Briefing</h2>
              <p className="text-[11px] text-slate-500">
                {briefing?.headline || 'Operations & telemetry overview'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {insights.length > 0 && verifiedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                {verifiedCount === insights.length
                  ? 'All evidence ground-truth verified'
                  : `${verifiedCount} of ${insights.length} verified`}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {briefing?.summary || executiveSummary || 'No significant changes detected. Metrics remain stable within expected parameters.'}
          </div>

          {/* Business Implications & Recommended Actions */}
          {(briefing?.businessImplications?.length > 0 || briefing?.recommendedActions?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              {briefing?.businessImplications?.length > 0 && (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    Business Implications
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {briefing.businessImplications.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-amber-500 font-bold mt-0.5">•</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {briefing?.recommendedActions?.length > 0 && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    Recommended Actions
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {briefing.recommendedActions.map((act, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-blue-500 font-bold mt-0.5">•</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Observed Relationships */}
          {((briefing?.relationships && briefing.relationships.length > 0) || relationships.length > 0) && (
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Observed Relationships</span>
                <span className="text-[10px] text-slate-500 ml-1">(observational, not causal)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(briefing?.relationships || relationships).map((rel, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-700 leading-relaxed font-medium">{rel.relationship}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold shrink-0 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="relative min-w-[220px] flex-1 md:max-w-xs">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="search-insights-input"
            placeholder="Search insights, metrics, or datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 transition"
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

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Severity Filter Chips */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-white shadow-2xs">
            {['all', 'positive', 'warning', 'critical', 'info'].map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-white shadow-2xs">
            {['active', 'dismissed', 'all'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Insights Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-slate-200 rounded-lg" />
                <div className="h-4 bg-slate-200 rounded w-24" />
              </div>
              <div className="h-5 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-5/6" />
              <div className="h-10 bg-slate-50 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-rose-900">Service Communication Error</h3>
          <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
          <button
            onClick={loadData}
            className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
          <Sparkles className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900">
            {hasActiveFilters ? 'No Matching Insights' : 'No Insights Generated Yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            {hasActiveFilters
              ? 'No insights match your current search and filter criteria. Try adjusting your parameters.'
              : 'AI Insights are generated by analyzing patterns, trends, and anomalies across your uploaded datasets. Click below to run the first analysis.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={handleGenerateInsights}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" /> Generate Insights
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInsights.map(ins => {
            const isEvidenceOpen = expandedEvidence[ins.id];
            const feedback = feedbackState[ins.id];
            const isFavorited = favorites.has(String(ins.id));
            const isTargetHighlighted = targetInsightId === String(ins.id);

            return (
              <div
                key={ins.id}
                onClick={() => recordRecentlyViewedApi('ai_insight', ins.id).catch(() => {})}
                className={`group rounded-xl border bg-white shadow-2xs hover:shadow-xs transition flex flex-col justify-between ${
                  isTargetHighlighted ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Card Header */}
                <div className="p-5 space-y-3">
                  {/* Top Row: Type Icon + Badges + Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200/80">
                        {getTypeIcon(ins.type)}
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {getTypeLabel(ins.type)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {getPriorityBadge(ins.priority || ins.evidence?.priority)}
                      {getSeverityBadge(ins.severity)}

                      {/* Impact Score */}
                      {((ins.impactScore ?? ins.impact_score ?? ins.evidence?.impactScore ?? ins.evidence?.impact_score) !== undefined) && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Impact: {ins.impactScore ?? ins.impact_score ?? ins.evidence?.impactScore ?? ins.evidence?.impact_score}/100
                        </span>
                      )}

                      {/* Favorite & Share */}
                      <button
                        onClick={(e) => handleToggleFavorite(e, ins.id)}
                        title={isFavorited ? 'Remove favorite' : 'Add to favorites'}
                        className="text-slate-400 hover:text-amber-500 p-1 rounded-md hover:bg-slate-50 transition cursor-pointer"
                      >
                        <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareModalConfig({ isOpen: true, insightId: ins.id, title: ins.title });
                        }}
                        title="Share insight"
                        className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-slate-50 transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Insight Title (Strongest Element) */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {ins.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ins.summary}
                  </p>

                  {/* Priority Basis */}
                  {(ins.priorityReason || ins.evidence?.priorityReason) && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 flex items-start gap-1.5">
                      <span className="font-semibold text-slate-700 shrink-0">Priority Basis:</span>
                      <span className="leading-relaxed">{ins.priorityReason || ins.evidence?.priorityReason}</span>
                    </div>
                  )}

                  {/* AI Grounded badge */}
                  {ins.evidence?.ai_grounded && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-medium">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      <span>AI Interpretation — Grounded in verified dataset evidence</span>
                    </div>
                  )}

                  {/* Cross-Metric Relationship Details */}
                  {ins.type === 'relationship' && ins.evidence?.evidence && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5 text-[11px]">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          Observed Cross-Metric Co-Movement
                        </span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {ins.evidence.direction}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {ins.evidence.evidence.map((ev, idx) => (
                          <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-medium block">{ev.metric}</span>
                            <span className="font-semibold text-slate-800">
                              {ev.previousValue} → {ev.currentValue}
                            </span>
                            <span className={`block text-[10px] font-mono font-bold ${ev.changePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {ev.changePercent >= 0 ? '+' : ''}{ev.changePercent}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Grounded Explanation */}
                  {ins.evidence?.ai_explanation && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3.5 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          AI Interpretation
                        </div>
                        <span className="text-[10px] font-mono text-blue-600 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                          Gemini
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed text-xs">
                        {ins.evidence.ai_explanation}
                      </p>
                      {ins.evidence?.business_impact && (
                        <div className="text-[11px] text-slate-600 pt-1.5 border-t border-blue-100 flex items-start gap-1.5">
                          <span className="font-semibold text-slate-700">Business Impact:</span>
                          <span>{ins.evidence.business_impact}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Evidence & Actions Footer */}
                <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-3">
                  {/* Source Tags + Evidence Toggle */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {ins.source_metadata?.dataset_name && (
                      <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                        <Database className="w-3 h-3 text-blue-600" />
                        {ins.source_metadata.dataset_name}
                      </span>
                    )}
                    {ins.source_metadata?.target_column && (
                      <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 font-mono">
                        <BarChart3 className="w-3 h-3 text-purple-600" />
                        {ins.source_metadata.target_column}
                      </span>
                    )}
                    <button
                      onClick={() => toggleEvidence(ins.id)}
                      className="text-blue-600 hover:text-blue-800 font-medium ml-auto flex items-center gap-1 cursor-pointer"
                    >
                      {isEvidenceOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {isEvidenceOpen ? 'Hide Evidence' : 'View Evidence'}
                    </button>
                  </div>

                  {/* Collapsible Ground Truth Evidence Panel */}
                  {isEvidenceOpen && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-3">
                      {/* Verification Header */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-1.5 font-semibold">
                          {ins.evidence?.verified ? (
                            <span className="flex items-center gap-1.5 text-emerald-700">
                              <ShieldCheck className="w-4 h-4" />
                              Ground Truth — Verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-700">
                              <AlertTriangle className="w-4 h-4" />
                              Unverified
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {ins.evidence?.recordsAnalyzed ?? ins.evidence?.records_analyzed ?? 0} rows analyzed
                        </span>
                      </div>

                      {/* Verification Description */}
                      {ins.evidence?.verificationReason && (
                        <p className="text-[11px] text-slate-600 leading-relaxed italic">
                          {ins.evidence.verificationReason}
                        </p>
                      )}

                      {/* Telemetry Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Dataset</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {ins.evidence?.datasetName || ins.source_metadata?.dataset_name || 'Primary'}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Metric</span>
                          <span className="font-semibold text-purple-700 truncate block font-mono">
                            {ins.evidence?.metric || 'primary_metric'}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Current Value</span>
                          <span className="font-semibold text-emerald-700 font-mono">
                            {ins.evidence?.currentValue !== undefined
                              ? (typeof ins.evidence.currentValue === 'number' ? ins.evidence.currentValue.toLocaleString() : ins.evidence.currentValue)
                              : (ins.evidence?.current_value !== undefined ? ins.evidence.current_value.toLocaleString() : 'N/A')}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Comparison</span>
                          <span className="font-semibold text-slate-700 font-mono">
                            {ins.evidence?.comparisonValue !== undefined
                              ? (typeof ins.evidence.comparisonValue === 'number' ? ins.evidence.comparisonValue.toLocaleString() : ins.evidence.comparisonValue)
                              : (ins.evidence?.previous_value !== undefined ? ins.evidence.previous_value.toLocaleString() : 'N/A')}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Change %</span>
                          <span className={`font-semibold font-mono ${
                            (ins.evidence?.changePercent || ins.evidence?.change_percent || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {ins.evidence?.changePercent !== undefined
                              ? `${ins.evidence.changePercent >= 0 ? '+' : ''}${ins.evidence.changePercent}%`
                              : (ins.evidence?.change_percent !== undefined ? `${ins.evidence.change_percent >= 0 ? '+' : ''}${ins.evidence.change_percent}%` : 'N/A')}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block uppercase font-medium">Period</span>
                          <span className="font-semibold text-slate-700 truncate block">
                            {ins.evidence?.period || ins.evidence?.currentPeriod || 'Latest'}
                          </span>
                        </div>
                      </div>

                      {/* Source Fields */}
                      {(ins.evidence?.sourceFields || ins.evidence?.source_fields)?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-500 uppercase font-medium mr-1">Source Fields:</span>
                          {(ins.evidence?.sourceFields || ins.evidence?.source_fields).map((sf, idx) => (
                            <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono px-1.5 py-0.5 rounded">
                              {sf}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Calculation Formula */}
                      {ins.evidence?.calculation && (
                        <div className="pt-1 border-t border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase font-medium block mb-0.5">Calculation:</span>
                          <code className="text-[10px] text-slate-600 font-mono bg-white px-2 py-1 rounded block overflow-x-auto border border-slate-200">
                            {ins.evidence.calculation}
                          </code>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendation */}
                  {ins.recommendation?.action && (
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-blue-50/50 border border-blue-100">
                      <div className="flex items-center gap-2 text-xs text-blue-800 font-medium min-w-0">
                        <Compass className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate">{ins.recommendation.action}</span>
                      </div>
                      {ins.recommendation.target_page && (
                        <button
                          onClick={() => navigate(ins.recommendation.target_page)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer shrink-0"
                        >
                          Explore <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action Footer */}
                  <div className="flex items-center justify-between pt-2">
                    {/* Feedback */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-[11px] text-slate-500 mr-1">Was this useful?</span>
                      <button
                        onClick={() => handleFeedback(ins.id, 'useful')}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          feedback === 'useful' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'hover:bg-slate-100 text-slate-400'
                        }`}
                        title="Useful"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(ins.id, 'not_useful')}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          feedback === 'not_useful' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'hover:bg-slate-100 text-slate-400'
                        }`}
                        title="Not useful"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Investigate Drivers */}
                      {(ins.dataset_id || ins.evidence?.datasetId || ins.evidence?.dataset_id || ins.source_metadata?.dataset_id) && (
                        <button
                          onClick={() => setRootCauseInsight(ins)}
                          className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                          title="Break down the observed change by available business dimensions"
                        >
                          <Layers className="w-3 h-3 text-blue-600" />
                          Investigate Drivers
                        </button>
                      )}

                      {/* What-If */}
                      {(ins.dataset_id || ins.evidence?.datasetId || ins.evidence?.dataset_id || ins.source_metadata?.dataset_id) && (
                        <button
                          onClick={() => setSimulatorData({ insight: ins, attribution: null })}
                          className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                          title="Test a counterfactual scenario without changing your real data"
                        >
                          <Compass className="w-3 h-3 text-purple-600" />
                          Explore What-If
                        </button>
                      )}

                      {/* Dismiss */}
                      {ins.status !== 'dismissed' && (
                        <button
                          onClick={() => handleDismiss(ins.id)}
                          className="text-[11px] text-slate-500 hover:text-slate-700 font-medium transition cursor-pointer"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Root-Cause Driver Breakdown Drawer */}
      <RootCauseDrawer
        isOpen={Boolean(rootCauseInsight)}
        onClose={() => setRootCauseInsight(null)}
        insight={rootCauseInsight}
        onLaunchSimulator={(ins, attr) => {
          setRootCauseInsight(null);
          setSimulatorData({ insight: ins, attribution: attr });
        }}
      />

      {/* Counterfactual Scenario Simulator Modal */}
      {simulatorData && (
        <ScenarioSimulatorModal
          isOpen={Boolean(simulatorData)}
          onClose={() => setSimulatorData(null)}
          insight={simulatorData.insight}
          attribution={simulatorData.attribution}
        />
      )}

      {/* Resource Share Modal */}
      <ShareModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig({ isOpen: false, insightId: null, title: '' })}
        resourceType="insight"
        resourceId={shareModalConfig.insightId}
        resourceTitle={shareModalConfig.title}
      />
    </div>
  );
}
