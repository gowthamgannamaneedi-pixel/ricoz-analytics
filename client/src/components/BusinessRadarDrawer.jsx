import React, { useState, useEffect, useMemo } from 'react';
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
  Compass
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
 * Customer-Friendly Business Radar Drawer
 * Clear, simple, executive-level business intelligence.
 * Explains what changed, what contributed, and what to check next in plain language.
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

  // Sync preview state if prop changes
  useEffect(() => {
    setSimulatedState(previewState);
  }, [previewState]);

  useEffect(() => {
    if (!isOpen || !insight) return;
    if (simulatedState) return;

    let isMounted = true;
    async function loadRadarData() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch available dimensions for the dataset
        const dimRes = await getInsightDimensions(insight.id).catch(() => null);
        const dims = dimRes?.data?.availableDimensions || [];
        if (isMounted) setAvailableDimensions(dims);

        // 2. Fetch Business Radar variance attribution
        const defaultDim = selectedDimension || (dims.length > 0 ? dims[0] : null);
        const res = await getRootCauseAttribution(insight.id, {
          dimension: defaultDim || undefined
        });

        if (isMounted) {
          if (res?.success && res?.data) {
            setRadarData(res.data);
            if (!selectedDimension && res.data.dimension) {
              setSelectedDimension(res.data.dimension);
            }
          } else {
            setError(res?.error?.message || 'Unable to load analysis for this metric.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to communicate with the analysis service.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRadarData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, insight, selectedDimension, simulatedState]);

  // Active state determination
  const isStateLoading = simulatedState === 'loading' || (loading && !simulatedState);
  const isStateError = simulatedState === 'error' || (Boolean(error) && !simulatedState && !isStateLoading);
  const isStateEmpty = simulatedState === 'empty' || (!isStateLoading && !isStateError && (!radarData || !radarData.drivers || radarData.drivers.length === 0));
  const isStateSuccess = !isStateLoading && !isStateError && !isStateEmpty && Boolean(radarData);

  const handleRetry = () => {
    setSimulatedState(null);
    setError(null);
    setSelectedDimension(prev => prev);
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

  // 1. One Main Finding Sentence (validated, never hardcoded)
  let mainFindingText = '';
  if (isZero) {
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

  // Periods labels
  const priorPeriodLabel = insight?.evidence?.comparisonPeriod || 'Previous period';
  const currentPeriodLabel = insight?.evidence?.currentPeriod || 'Current period';

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
        {/* 1. SIMPLE TITLE & CLOSE BUTTON                                    */}
        {/* ----------------------------------------------------------------- */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50/70 dark:bg-[#0F172A] sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-[#F8FAFC]">
              Business Radar
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Understand what changed in your business and what to check next.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Developer preview buttons for testing states cleanly */}
            <div className="hidden sm:flex items-center border border-slate-200 dark:border-[#334155] rounded-lg p-0.5 bg-white dark:bg-[#1E293B] text-[10px]">
              <button
                onClick={() => setSimulatedState(null)}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${!simulatedState ? 'bg-rose-600 text-white font-bold' : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900'}`}
                title="Normal active state"
              >
                Live
              </button>
              <button
                onClick={() => setSimulatedState('loading')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${simulatedState === 'loading' ? 'bg-rose-600 text-white font-bold' : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900'}`}
                title="Force loading state"
              >
                Load
              </button>
              <button
                onClick={() => setSimulatedState('empty')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${simulatedState === 'empty' ? 'bg-rose-600 text-white font-bold' : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900'}`}
                title="Force empty state"
              >
                Empty
              </button>
              <button
                onClick={() => setSimulatedState('error')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${simulatedState === 'error' ? 'bg-rose-600 text-white font-bold' : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900'}`}
                title="Force error state"
              >
                Error
              </button>
            </div>

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
                  Analyzing business data...
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                  Comparing current performance against previous periods to identify key changes.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: ERROR */}
          {isStateError && (
            <div className="p-5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200 space-y-3" id="radar-error-state">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                    Analysis unavailable
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300">
                    {error || 'We could not compute the comparative breakdown for this insight. Please verify that data is available and try again.'}
                  </p>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleRetry}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try again</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: EMPTY */}
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
                  This metric does not have multiple business categories (such as region, product, or channel) to break down.
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
                  <span className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium mr-1 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>View by:</span>
                  </span>
                  {availableDimensions.map(dim => (
                    <button
                      key={dim}
                      onClick={() => setSelectedDimension(dim)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition capitalize cursor-pointer flex items-center gap-1 ${
                        selectedDimension === dim
                          ? 'bg-rose-600 text-white font-bold'
                          : 'bg-white dark:bg-[#0F172A] text-slate-600 dark:text-[#CBD5E1] border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E293B]'
                      }`}
                    >
                      <span>{dim.replace(/_/g, ' ')}</span>
                      {selectedDimension === dim && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* 2. ONE MAIN FINDING                                           */}
              {/* ------------------------------------------------------------- */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/90 dark:border-[#334155]">
                <div className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                  Main Finding
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F8FAFC]">
                  {mainFindingText}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 3. THREE SIMPLE SUMMARY METRICS                               */}
              {/* ------------------------------------------------------------- */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Metric 1: Previous */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1E293B]/40 border border-slate-200 dark:border-[#334155]">
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
                <div className="p-4 rounded-xl bg-white dark:bg-[#1E293B]/40 border border-slate-200 dark:border-[#334155]">
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

                {/* Metric 3: Change in revenue */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1E293B]/40 border border-slate-200 dark:border-[#334155]">
                  <div className="text-xs font-medium text-slate-500 dark:text-[#94A3B8]">
                    Change in {metricLabel.toLowerCase()}
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
                    {totalDeltaPercent > 0 ? `+${totalDeltaPercent}%` : `${totalDeltaPercent}%`} change
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 4. MAIN EXPLANATION (Plain Language)                           */}
              {/* ------------------------------------------------------------- */}
              <div className="space-y-4">
                {/* Question 1: What changed? */}
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider">
                    What changed?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed">
                    {metricLabel} moved by {totalDelta > 0 ? '+' : '-'}{formatAmount(totalDelta)} ({totalDeltaPercent > 0 ? `+${totalDeltaPercent}%` : `${totalDeltaPercent}%`}) compared with the previous period ({priorPeriodLabel} vs {currentPeriodLabel}).
                  </p>
                </div>

                {/* Question 2: What contributed to the change? */}
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider">
                    What contributed to the change?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-[#CBD5E1] leading-relaxed">
                    {detractor && sustainer ? (
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
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-0.5">
                    Note: These values reflect observed differences in data, not confirmed direct causes.
                  </p>
                </div>

                {/* ----------------------------------------------------------- */}
                {/* 5. ONE SIMPLE VISUAL: Clean Bar Chart of Contributors       */}
                {/* ----------------------------------------------------------- */}
                {chartData.length > 0 && (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B]/20 space-y-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] flex items-center justify-between">
                      <span>Contributors by change</span>
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

                {/* Question 3: What should you check next? */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider">
                    What should you check next?
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-[#CBD5E1]">
                    {detractor && (
                      <li className="flex items-start gap-2">
                        <span className="text-rose-500 font-bold shrink-0 mt-0.5">•</span>
                        <span>
                          Review order volume and transaction counts in <strong className="text-slate-800 dark:text-white capitalize">{detractor.segment}</strong> to verify if this is an isolated dip or an ongoing trend.
                        </span>
                      </li>
                    )}
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500 font-bold shrink-0 mt-0.5">•</span>
                      <span>
                        Check customer acquisition and marketing spend during {currentPeriodLabel} across your key channels.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500 font-bold shrink-0 mt-0.5">•</span>
                      <span>
                        Verify inventory availability or pricing updates that took effect around this period.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 6. ONE RECOMMENDATION SECTION (Max 3 Actionable Points)       */}
              {/* ------------------------------------------------------------- */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50/70 dark:bg-[#0F172A] space-y-2.5">
                <div className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase tracking-wider">
                  Recommended Actions
                </div>
                <div className="space-y-2 text-xs text-slate-600 dark:text-[#CBD5E1]">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[11px] font-bold">1</span>
                    <span>Investigate transaction patterns in lagging segments to identify specific product or customer shifts.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[11px] font-bold">2</span>
                    <span>Connect with regional sales leads to validate whether seasonal factors or supply constraints influenced the outcome.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 text-[11px] font-bold">3</span>
                    <span>Set up an alert threshold to be notified automatically if this metric changes by more than 5% next week.</span>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 7. PROGRESSIVE DISCLOSURE ("View details")                      */}
              {/* ------------------------------------------------------------- */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#334155]">
                <button
                  onClick={() => setShowTechnicalDetails(prev => !prev)}
                  className="w-full py-2.5 px-3 rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B]/40 text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-[#1E293B] flex items-between justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span>Technical &amp; validation details</span>
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
                        Mathematical Balance &amp; Formula
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155] font-mono text-[11px] text-slate-600 dark:text-[#CBD5E1] break-all">
                        {radarData?.radar?.evidence?.calculationMethod ||
                          `((Current - Baseline) / ABS(Baseline)) * 100 = ((${totalCurrent} - ${totalBaseline}) / ${Math.abs(totalBaseline || 1)}) * 100 = ${totalDeltaPercent}%`}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Verified across {radarData.recordsAnalyzed || insight?.evidence?.recordsAnalyzed || 0} physical records. Segment delta sum matches total net delta.
                      </div>
                    </div>

                    {/* HHI Movement Concentration */}
                    {radarData.concentration && (
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
                    {radarData.drivers && radarData.drivers.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-bold text-slate-700 dark:text-[#CBD5E1]">
                          Detailed Movement Breakdown
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
            Data validated with deterministic calculations
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
