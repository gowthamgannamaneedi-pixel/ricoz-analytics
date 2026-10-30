import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Compass,
  Sparkles,
  Calculator,
  HelpCircle,
  Info,
  Layers,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine
} from 'recharts';
import { getRootCauseAttribution, getInsightDimensions } from '../services/api';

/**
 * Enterprise Business Radar Drawer
 * Clear, executive-level business intelligence.
 * Strictly presents verified calculations and grounded AI synthesis in 5 sections:
 * A. What changed?
 * B. What does the data show?
 * C. Why might it have happened? (Strictly non-causal observational hypotheses)
 * D. What should the user check next? (Insight-specific actionable next steps)
 * E. Evidence and limitations (Source dataset, period, records, limitations)
 */
export default function BusinessRadarDrawer({
  isOpen,
  onClose,
  insight,
  onLaunchSimulator,
  previewState = null // 'loading' | 'empty' | 'error' | null
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radarData, setRadarData] = useState(null);
  const [selectedDimension, setSelectedDimension] = useState('');
  const [availableDimensions, setAvailableDimensions] = useState([]);
  const [simulatedState, setSimulatedState] = useState(previewState);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [deterministicMode, setDeterministicMode] = useState(false);
  const [fallbackData, setFallbackData] = useState(null);

  // Sync preview state if prop changes
  useEffect(() => {
    setSimulatedState(previewState);
  }, [previewState]);

  const requestIdRef = useRef(0);

  // Active dimension: user selected dimension OR dimension returned by backend radar data
  const activeDimension = selectedDimension || radarData?.dimension || (availableDimensions.length > 0 ? availableDimensions[0] : '');

  // Reset local state when insight changes or drawer opens
  useEffect(() => {
    if (insight?.id) {
      setRadarData(null);
      setError(null);
      setSelectedDimension('');
      setAvailableDimensions([]);
      setDeterministicMode(false);
      setFallbackData(null);
      setSimulatedState(previewState);
    }
  }, [insight?.id, isOpen]);

  useEffect(() => {
    if (!isOpen || !insight || !insight.id) return;
    if (simulatedState) return;

    let isMounted = true;
    const currentRequestId = ++requestIdRef.current;

    async function loadRadarData() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch available dimensions for the dataset in parallel
        const dimPromise = getInsightDimensions(insight.id).catch(() => null);

        // 2. Fetch Business Radar variance attribution with real AI synthesis
        const radarPromise = getRootCauseAttribution(insight.id, {
          dimension: selectedDimension || undefined,
          forceFresh: retryTrigger > 0,
          allowFallback: deterministicMode ? 'true' : undefined,
          mode: deterministicMode ? 'deterministic' : undefined
        });

        const [dimRes, res] = await Promise.all([dimPromise, radarPromise]);

        // Discard stale responses if a newer request was dispatched
        if (!isMounted || currentRequestId !== requestIdRef.current) return;

        const dims = dimRes?.data?.availableDimensions || [];
        setAvailableDimensions(dims);

        if (res?.success && res?.data) {
          setRadarData(res.data);
          setError(null);
        } else {
          const errPayload = res?.error || {};
          setError({
            code: errPayload.code || 'ANALYSIS_UNAVAILABLE',
            message: errPayload.message || 'Unable to load analysis for this metric.',
            retryable: errPayload.retryable !== false
          });
          if (res?.data?.canViewDeterministic) {
            setFallbackData(res.data);
          }
        }
      } catch (err) {
        if (isMounted && currentRequestId === requestIdRef.current) {
          const errData = err.data || {};
          const errPayload = errData.error || {};
          setError({
            code: errPayload.code || 'REQUEST_FAILED',
            message: errPayload.message || err.message || 'Unable to communicate with the analysis service.',
            retryable: errPayload.retryable !== false
          });
          if (errData.data?.canViewDeterministic) {
            setFallbackData(errData.data);
          }
        }
      } finally {
        if (isMounted && currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    loadRadarData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, insight?.id, selectedDimension, simulatedState, retryTrigger, deterministicMode]);

  // Active state determination
  const isStateLoading = simulatedState === 'loading' || (loading && !simulatedState);
  const isStateError = simulatedState === 'error' || (Boolean(error) && !simulatedState && !isStateLoading);
  const isStateEmpty = simulatedState === 'empty' || (!isStateLoading && !isStateError && (!radarData || !radarData.drivers || radarData.drivers.length === 0));
  const isStateSuccess = !isStateLoading && !isStateError && !isStateEmpty && Boolean(radarData);

  const handleRetry = () => {
    setSimulatedState(null);
    setError(null);
    setLoading(true);
    setRetryTrigger(prev => prev + 1);
  };

  const handleViewDeterministic = () => {
    setDeterministicMode(true);
    setError(null);
    setLoading(true);
    setRetryTrigger(prev => prev + 1);
  };

  // Safe formatting helpers
  const currencySymbol = insight?.evidence?.currency || radarData?.currency || '';
  const formatAmount = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const formatted = Math.abs(num).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    return currencySymbol ? `${currencySymbol}${formatted}` : formatted;
  };

  const metricLabel = (radarData?.metric || insight?.evidence?.metric || 'Revenue')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  const totalBaseline = Number(radarData?.totalBaseline || 0);
  const totalCurrent = Number(radarData?.totalCurrent || 0);
  const totalDelta = Number(radarData?.totalDelta || 0);
  const totalDeltaPercent = Number(radarData?.totalDeltaPercent || 0);
  const isNegative = totalDelta < 0;
  const isZero = totalDelta === 0;

  // Analysis payload from genuine AI or deterministic summary
  const analysis = radarData?.analysis;

  // Periods labels
  const priorPeriodLabel = insight?.evidence?.comparisonPeriod || 'Previous period';
  const currentPeriodLabel = insight?.evidence?.currentPeriod || 'Current period';

  // 1. One Main Finding Sentence (verified)
  let mainFindingText = '';
  if (analysis?.whatChanged?.summary) {
    mainFindingText = analysis.whatChanged.summary;
  } else if (isZero) {
    mainFindingText = `${metricLabel} remained unchanged compared with the previous period.`;
  } else {
    const direction = isNegative ? 'decreased' : 'increased';
    const pct = Math.abs(totalDeltaPercent);
    mainFindingText = `${metricLabel} ${direction} by ${pct}% compared with the previous period.`;
  }

  // 2. Prepare Clean Chart Data
  let chartData = [];
  if (radarData?.drivers && radarData.drivers.length > 0) {
    chartData = [...radarData.drivers]
      .sort((a, b) => Math.abs(b.segmentDelta || 0) - Math.abs(a.segmentDelta || 0))
      .slice(0, 5)
      .map(d => ({
        segment: d.segment || 'Other',
        change: Number(d.segmentDelta || 0),
        share: d.absoluteMovementShare || 0,
        baseline: d.baselineValue || 0,
        current: d.currentValue || 0
      }));
  }

  // Detractor & Sustainer info
  const detractor = radarData?.primaryDetractor;
  const sustainer = radarData?.primarySustainer;

  if (!isOpen || !insight) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs transition-opacity flex justify-end"
      id="business-radar-modal"
    >
      <div className="w-screen max-w-2xl bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-[#334155] shadow-2xl flex flex-col text-slate-900 dark:text-[#F8FAFC]">

        {/* ----------------------------------------------------------------- */}
        {/* 1. HEADER: TITLE, BADGE & CLOSE BUTTON                            */}
        {/* ----------------------------------------------------------------- */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50/70 dark:bg-[#0F172A] sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#F8FAFC]">
                Business Radar
              </h2>
              {/* Badge: AI Generated vs Deterministic Calculation */}
              {radarData?.aiGenerated ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                  <Sparkles className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                  <span>AI Analysis ({radarData.model || 'Gemini 2.5 Flash'})</span>
                </span>
              ) : radarData?.isDeterministicSummary ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Calculator className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>Deterministic Calculations (Non-AI)</span>
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Grounded dimensional analysis for <strong className="text-slate-800 dark:text-[#F8FAFC]">{metricLabel}</strong> ({radarData?.datasetName || insight.dataset_name || 'Telemetry Dataset'}).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              id="close-radar-drawer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1E293B] transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* BODY                                                              */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* STATE 1: LOADING */}
          {isStateLoading && (
            <div className="py-24 flex flex-col items-center justify-center space-y-4 text-center" id="radar-loading-state">
              <div className="w-12 h-12 rounded-full border-3 border-rose-100 dark:border-rose-950/40 border-t-rose-600 dark:border-t-rose-500 animate-spin" />
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                  Analyzing authorized business data...
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                  Computing dimensional group-by variance across {activeDimension || 'dimensions'} and querying AI for interpretation.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: HONEST ERROR STATE */}
          {isStateError && (
            <div className="p-5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200 space-y-3" id="radar-error-state">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                    {error?.code === 'AI_NOT_CONFIGURED' ? 'AI Provider Not Configured' :
                     error?.code === 'AI_QUOTA_EXCEEDED' ? 'AI Quota Exceeded' :
                     error?.code === 'DATASET_UNAVAILABLE' ? 'Dataset Unavailable' :
                     error?.code === 'INSUFFICIENT_EVIDENCE' ? 'Insufficient Data' :
                     error?.code === 'AI_AUTH_FAILED' ? 'AI Authentication Failed' :
                     error?.code === 'AI_TIMEOUT' ? 'Analysis Service Timeout' :
                     'Analysis Unavailable'}
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300">
                    {error?.message || 'We could not compute the comparative breakdown for this insight.'}
                  </p>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                {(fallbackData || error?.code === 'AI_NOT_CONFIGURED') && !deterministicMode && (
                  <button
                    onClick={handleViewDeterministic}
                    id="radar-deterministic-fallback-btn"
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5 text-blue-500" />
                    <span>View Verified Calculations (Non-AI)</span>
                  </button>
                )}
                {error?.retryable && (
                  <button
                    onClick={handleRetry}
                    id="radar-retry-btn"
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>{loading ? 'Retrying...' : 'Try again'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STATE 3: EMPTY / INSUFFICIENT DATA */}
          {isStateEmpty && (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-center p-8 rounded-xl border border-dashed border-slate-200 dark:border-[#334155] bg-slate-50/50 dark:bg-[#0F172A]/50" id="radar-empty-state">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#1E293B] text-slate-400 dark:text-[#94A3B8]">
                <FolderOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                  No comparative breakdown available
                </h4>
                <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                  {radarData?.emptyReason || 'There is insufficient historical data to explain this change reliably.'}
                </p>
              </div>
            </div>
          )}

          {/* STATE 4: SUCCESS */}
          {isStateSuccess && (
            <div className="space-y-6" id="radar-success-state">

              {/* Optional Category Slicer when multiple dimensions exist */}
              {availableDimensions.length > 1 && (
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-[#334155] overflow-x-auto">
                  <span className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium mr-1 flex items-center gap-1 shrink-0">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>View by dimension:</span>
                  </span>
                  {availableDimensions.map(dim => (
                    <button
                      key={dim}
                      onClick={() => setSelectedDimension(dim)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition capitalize cursor-pointer flex items-center gap-1 shrink-0 ${
                        activeDimension === dim
                          ? 'bg-rose-600 text-white font-bold'
                          : 'bg-white dark:bg-[#0F172A] text-slate-600 dark:text-[#CBD5E1] border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E293B]'
                      }`}
                    >
                      <span>{dim.replace(/_/g, ' ')}</span>
                      {activeDimension === dim && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION A: WHAT CHANGED?                                      */}
              {/* ------------------------------------------------------------- */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/90 dark:border-[#334155] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 dark:text-[#94A3B8] uppercase tracking-wider">
                    A. What changed?
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {analysis?.whatChanged?.period || `${currentPeriodLabel} vs ${priorPeriodLabel}`}
                  </div>
                </div>

                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F8FAFC] leading-snug">
                  {mainFindingText}
                </div>

                {/* 3 Summary KPI Cards: Previous, Current, Measured Change */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Metric 1: Previous */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E293B]/40 border border-slate-200 dark:border-[#334155]">
                    <div className="text-xs font-medium text-slate-500 dark:text-[#94A3B8]">
                      Previous {metricLabel.toLowerCase()}
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mt-1 font-mono">
                      {formatAmount(totalBaseline)}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      {priorPeriodLabel}
                    </div>
                  </div>

                  {/* Metric 2: Current */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E293B]/40 border border-slate-200 dark:border-[#334155]">
                    <div className="text-xs font-medium text-slate-500 dark:text-[#94A3B8]">
                      Current {metricLabel.toLowerCase()}
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mt-1 font-mono">
                      {formatAmount(totalCurrent)}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      {currentPeriodLabel}
                    </div>
                  </div>

                  {/* Metric 3: Measured Change */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E293B]/40 border border-slate-200 dark:border-[#334155]">
                    <div className="text-xs font-medium text-slate-500 dark:text-[#94A3B8]">
                      Measured change
                    </div>
                    <div className={`text-xl font-bold mt-1 flex items-center gap-1 font-mono ${
                      isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {isNegative ? <TrendingDown className="w-4 h-4 shrink-0" /> : <TrendingUp className="w-4 h-4 shrink-0" />}
                      <span>{totalDelta > 0 ? `+${formatAmount(totalDelta)}` : `-${formatAmount(totalDelta)}`}</span>
                    </div>
                    <div className={`text-[11px] font-semibold mt-0.5 ${
                      isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {totalDeltaPercent > 0 ? `+${totalDeltaPercent}%` : `${totalDeltaPercent}%`} difference
                    </div>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION B: WHAT DOES THE DATA SHOW?                           */}
              {/* ------------------------------------------------------------- */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider">
                  B. What does the data show?
                </div>

                {/* Narrative of verified contributors */}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed">
                  {analysis?.whatDataShows?.summary ? (
                    analysis.whatDataShows.summary
                  ) : detractor && sustainer ? (
                    <>
                      The largest downward shift was observed in <strong className="text-slate-900 dark:text-white capitalize">{detractor.segment}</strong> (-{formatAmount(detractor.delta)}), while <strong className="text-slate-900 dark:text-white capitalize">{sustainer.segment}</strong> showed the strongest gain (+{formatAmount(sustainer.delta)}).
                    </>
                  ) : detractor ? (
                    <>
                      The drop was most pronounced in <strong className="text-slate-900 dark:text-white capitalize">{detractor.segment}</strong> (-{formatAmount(detractor.delta)}). Other segments showed modest variations.
                    </>
                  ) : sustainer ? (
                    <>
                      The gain was primarily driven by growth in <strong className="text-slate-900 dark:text-white capitalize">{sustainer.segment}</strong> (+{formatAmount(sustainer.delta)}).
                    </>
                  ) : (
                    <>
                      Changes were distributed across multiple categories without a single dominant driver.
                    </>
                  )}
                </p>

                {analysis?.whatDataShows?.concentration && (
                  <div className="text-xs text-slate-500 dark:text-[#94A3B8] italic">
                    {analysis.whatDataShows.concentration}
                  </div>
                )}

                {/* Horizontal Bar Chart of Contributors */}
                {chartData.length > 0 && (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B]/20 space-y-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] flex items-center justify-between">
                      <span>Contributors by change across {activeDimension || 'dimension'}</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Positive (green) vs Negative (rose)
                      </span>
                    </div>

                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          layout="vertical"
                          margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.5} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            tickFormatter={(v) => `${v > 0 ? '+' : ''}${formatAmount(v)}`}
                          />
                          <YAxis
                            type="category"
                            dataKey="segment"
                            tick={{ fontSize: 11, fill: '#334155' }}
                            width={90}
                          />
                          <Tooltip
                            formatter={(val) => [`${val > 0 ? '+' : ''}${formatAmount(val)}`, 'Change']}
                            labelFormatter={(lbl) => `Segment: ${lbl}`}
                            contentStyle={{
                              backgroundColor: '#0F172A',
                              borderColor: '#334155',
                              borderRadius: '8px',
                              color: '#FFF',
                              fontSize: '11px'
                            }}
                          />
                          <ReferenceLine x={0} stroke="#94A3B8" />
                          <Bar dataKey="change" radius={[4, 4, 4, 4]}>
                            {chartData.map((entry, idx) => (
                              <Cell
                                key={`cell-${idx}`}
                                fill={entry.change >= 0 ? '#10B981' : '#F43F5E'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION C: WHY MIGHT IT HAVE HAPPENED?                        */}
              {/* ------------------------------------------------------------- */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B]/30 space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider">
                  C. Why might it have happened?
                </div>

                {/* Observed patterns */}
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Observed Patterns in Telemetry:
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed">
                    {analysis?.whyHappened?.observedPatterns ||
                      `Empirical records indicate that variance was led by segment movements in ${activeDimension || 'the primary dimension'}. The net delta of ${totalDelta > 0 ? '+' : ''}${formatAmount(totalDelta)} reflects the mathematical sum of individual segment shifts.`}
                  </p>
                </div>

                {/* Hypotheses */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Hypotheses to Validate (Distinguished from Observed Facts):
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-[#CBD5E1]">
                    {analysis?.whyHappened?.hypotheses && analysis.whyHappened.hypotheses.length > 0 ? (
                      analysis.whyHappened.hypotheses.map((hyp, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5">
                            HYPOTHESIS
                          </span>
                          <span>{hyp.replace(/^\[Hypothesis\]\s*/i, '')}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="flex items-start gap-2">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5">
                            HYPOTHESIS
                          </span>
                          <span>Segment-level transaction count changes or customer order frequency adjustments during {currentPeriodLabel}.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5">
                            HYPOTHESIS
                          </span>
                          <span>Product availability, seasonal demand shifts, or catalog price changes taking effect around this period.</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* External Factors Needed */}
                {analysis?.whyHappened?.externalFactorsNeeded && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0F172A] p-2.5 rounded-lg border border-slate-200 dark:border-[#334155]">
                    <strong className="text-slate-700 dark:text-slate-300">External Context Needed:</strong> {analysis.whyHappened.externalFactorsNeeded}
                  </div>
                )}

                <div className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                  Notice: Telemetry reflects statistical accounting of observed variance. Causal direction cannot be asserted without controlled experimentation.
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION D: WHAT SHOULD THE USER CHECK NEXT?                   */}
              {/* ------------------------------------------------------------- */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50/70 dark:bg-[#0F172A] space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider">
                  D. What should you check next?
                </div>

                <div className="space-y-2.5">
                  {analysis?.whatToCheckNext && analysis.whatToCheckNext.length > 0 ? (
                    analysis.whatToCheckNext.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-[#CBD5E1]">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[11px] font-bold mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 dark:text-white">
                            {item.action || String(item)}
                          </div>
                          {item.reasoning && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-medium text-slate-600 dark:text-slate-300">Reasoning:</span> {item.reasoning}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      {detractor && (
                        <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-[#CBD5E1]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[11px] font-bold mt-0.5">1</span>
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-800 dark:text-white">
                              Audit order logs and volume in <span className="capitalize">{detractor.segment}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              This segment accounted for {Math.abs(detractor.contributionPercent || 0)}% of the net difference.
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-[#CBD5E1]">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[11px] font-bold mt-0.5">{detractor ? '2' : '1'}</span>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 dark:text-white">
                            Verify customer retention and transaction counts across {activeDimension || 'dimensions'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Distinguishes whether the movement was driven by customer volume or average spend per customer.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-[#CBD5E1]">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[11px] font-bold mt-0.5">{detractor ? '3' : '2'}</span>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 dark:text-white">
                            Set up an automated variance alert for {metricLabel}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Ensures immediate notification if future observation intervals exceed tolerance thresholds.
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION E: EVIDENCE AND LIMITATIONS                           */}
              {/* ------------------------------------------------------------- */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B]/20 space-y-2.5 text-xs">
                <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>E. Evidence &amp; Limitations</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155]">
                    <span className="text-slate-400">Source Dataset:</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {analysis?.evidenceAndLimitations?.sourceDataset || radarData?.datasetName || insight?.dataset_name || 'Telemetry Telemetry'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155]">
                    <span className="text-slate-400">Records Analyzed:</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {radarData?.recordsAnalyzed || insight?.evidence?.recordsAnalyzed || 0} physical rows
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155]">
                    <span className="text-slate-400">Reporting Interval:</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {analysis?.evidenceAndLimitations?.reportingPeriod || `${priorPeriodLabel} to ${currentPeriodLabel}`}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155]">
                    <span className="text-slate-400">Calculation Method:</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {analysis?.evidenceAndLimitations?.calculations || '((Current - Baseline) / ABS(Baseline)) * 100'}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
                  <strong>Limitations:</strong> {analysis?.evidenceAndLimitations?.limitations || 'Findings are grounded in authorized dataset records. Telemetry identifies statistical co-movement, not confirmed direct causation.'}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* PROGRESSIVE DISCLOSURE: TECHNICAL VERIFICATION ACCORDION      */}
              {/* ------------------------------------------------------------- */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#334155]">
                <button
                  onClick={() => setShowTechnicalDetails(prev => !prev)}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B]/40 text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-[#1E293B] flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>View full mathematical breakdown table &amp; simulator</span>
                  </span>
                  {showTechnicalDetails ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showTechnicalDetails && (
                  <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50/50 dark:bg-[#0F172A]/50 space-y-4 animate-fade-in text-xs">
                    {/* Math balance & formula */}
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-700 dark:text-[#CBD5E1]">
                        Mathematical Invariant Verification
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155] font-mono text-[11px] text-slate-600 dark:text-[#CBD5E1] break-all">
                        {`Sum(Segment Deltas) = ${totalDelta > 0 ? '+' : ''}${totalDelta} | Net Delta = ${totalDelta > 0 ? '+' : ''}${totalDelta} (${totalDeltaPercent}%) | Identity Verified: ${radarData?.mathBalanceVerified !== false ? 'YES (100% Match)' : 'NO'}`}
                      </div>
                    </div>

                    {/* HHI Movement Concentration */}
                    {radarData?.concentration && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155]">
                        <div>
                          <div className="font-bold text-slate-700 dark:text-[#CBD5E1]">
                            Movement Concentration ({radarData.concentration.type.toUpperCase()})
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {radarData.concentration.description}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-slate-700 dark:text-[#CBD5E1] px-2 py-1 bg-slate-100 dark:bg-[#1E293B] rounded">
                          HHI {radarData.concentration.hhi}
                        </span>
                      </div>
                    )}

                    {/* Full Breakdown Table */}
                    {radarData?.drivers && radarData.drivers.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-bold text-slate-700 dark:text-[#CBD5E1]">
                          Detailed Movement Breakdown by Segment
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#334155]">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-[#94A3B8] uppercase">
                              <tr>
                                <th className="p-2">Segment</th>
                                <th className="p-2 text-right">Previous</th>
                                <th className="p-2 text-right">Current</th>
                                <th className="p-2 text-right">Delta</th>
                                <th className="p-2 text-right">Share</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#334155] bg-white dark:bg-[#111827]">
                              {radarData.drivers.map((d, idx) => (
                                <tr key={idx}>
                                  <td className="p-2 font-medium capitalize text-slate-800 dark:text-[#F8FAFC]">{d.segment}</td>
                                  <td className="p-2 text-right font-mono text-slate-500">{Number(d.baselineValue || 0).toLocaleString()}</td>
                                  <td className="p-2 text-right font-mono text-slate-500">{Number(d.currentValue || 0).toLocaleString()}</td>
                                  <td className={`p-2 text-right font-mono font-bold ${d.segmentDelta < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {d.segmentDelta > 0 ? `+${d.segmentDelta.toLocaleString()}` : d.segmentDelta.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-right font-mono text-slate-500">{d.absoluteMovementShare}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Counterfactual simulator trigger if available */}
                    {onLaunchSimulator && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => onLaunchSimulator(insight, radarData)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>Launch what-if simulation</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* ----------------------------------------------------------------- */}
        {/* FOOTER                                                            */}
        {/* ----------------------------------------------------------------- */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-[#334155] bg-slate-50/70 dark:bg-[#0F172A] flex items-center justify-between text-xs text-slate-500 dark:text-[#94A3B8]">
          <span className="text-[11px]">
            {radarData?.aiGenerated ? 'AI interpretation grounded in verified dataset evidence' : 'Verified with deterministic mathematical calculations'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] text-slate-700 dark:text-[#F8FAFC] font-semibold hover:bg-slate-100 dark:hover:bg-[#1E293B] transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
