import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Sliders,
  CheckCircle2,
  PieChart,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { getRootCauseAttribution, getInsightDimensions } from '../services/api';

/**
 * Root-Cause Driver Breakdown Drawer (Phase 6)
 * Displays deterministic multi-dimensional variance decomposition.
 */
export default function RootCauseDrawer({
  isOpen,
  onClose,
  insight,
  onLaunchSimulator
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attribution, setAttribution] = useState(null);
  const [selectedDimension, setSelectedDimension] = useState('');
  const [availableDimensions, setAvailableDimensions] = useState([]);

  useEffect(() => {
    if (!isOpen || !insight) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch available dimensions
        const dimRes = await getInsightDimensions(insight.id).catch(() => null);
        const dims = dimRes?.data?.availableDimensions || [];
        if (isMounted) setAvailableDimensions(dims);

        // 2. Fetch attribution
        const defaultDim = selectedDimension || (dims.length > 0 ? dims[0] : null);
        const attrRes = await getRootCauseAttribution(insight.id, {
          dimension: defaultDim || undefined
        });

        if (isMounted) {
          if (attrRes?.success && attrRes?.data) {
            setAttribution(attrRes.data);
            if (!selectedDimension && attrRes.data.dimension) {
              setSelectedDimension(attrRes.data.dimension);
            }
          } else {
            setError(attrRes?.error?.message || 'Failed to load root-cause attribution.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error fetching root-cause data.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, insight, selectedDimension]);

  if (!isOpen || !insight) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-3xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-100">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  Root-Cause Driver Breakdown
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Phase 6 Decision Intelligence
                  </span>
                </h2>
                <p className="text-xs text-slate-400 truncate max-w-lg mt-0.5">
                  {insight.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Dimension Selection Tabs */}
            {availableDimensions.length > 1 && (
              <div className="flex items-center space-x-2 pb-1 border-b border-slate-800/80 overflow-x-auto">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold mr-1">
                  Dimension:
                </span>
                {availableDimensions.map(dim => (
                  <button
                    key={dim}
                    onClick={() => setSelectedDimension(dim)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                      selectedDimension === dim
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {dim.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm text-slate-400">Decomposing dimensional drivers from dataset rows...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Attribution Unavailable</div>
                  <div className="text-xs text-rose-400/90 mt-1">{error}</div>
                </div>
              </div>
            ) : attribution ? (
              <>
                {/* Total Variance & Math Invariant Banner */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-slate-400">Historical Baseline</div>
                    <div className="text-lg font-semibold text-white mt-1">
                      {Number(attribution.totalBaseline || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Current Observation</div>
                    <div className="text-lg font-semibold text-white mt-1">
                      {Number(attribution.totalCurrent || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Net Observed Delta</div>
                    <div className={`text-lg font-semibold mt-1 flex items-center gap-1 ${
                      attribution.totalDelta < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {attribution.totalDelta < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      {attribution.totalDelta > 0 ? '+' : ''}{Number(attribution.totalDelta || 0).toLocaleString()} ({attribution.totalDeltaPercent}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Mathematical Balance</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Exact sum(Δy) = ΔY</span>
                    </div>
                  </div>
                </div>

                {/* Primary Detractor / Driver Callout */}
                {attribution.primaryDetractor && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                        Primary Detractor Segment
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                        Signed Contribution: {attribution.primaryDetractor.contributionPercent}%
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white mt-2">
                      {attribution.primaryDetractor.segment}
                    </div>
                    <p className="text-xs text-rose-300/90 mt-1">
                      Accounted for {Math.abs(attribution.primaryDetractor.contributionPercent)}% of the observed net contraction ({attribution.primaryDetractor.delta > 0 ? '+' : ''}{Number(attribution.primaryDetractor.delta || 0).toLocaleString()}).
                    </p>
                  </div>
                )}

                {/* Movement Concentration Metric (HHI) */}
                <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <PieChart className="w-4 h-4 text-indigo-400" />
                    <span>
                      <strong className="text-white">Movement Concentration:</strong> {attribution.concentration?.type?.toUpperCase()} (HHI: {attribution.concentration?.hhi})
                    </span>
                  </div>
                  <span className="text-slate-400 italic text-[11px]">
                    Absolute movement share concentration (non-causal)
                  </span>
                </div>

                {/* Drivers Breakdown Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Segment Variance Attribution ({attribution.dimension})
                  </h3>
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Segment</th>
                          <th className="py-2.5 px-3">Baseline</th>
                          <th className="py-2.5 px-3">Current</th>
                          <th className="py-2.5 px-3">Segment Δ</th>
                          <th className="py-2.5 px-3">Signed Contribution</th>
                          <th className="py-2.5 px-3">Movement Share</th>
                          <th className="py-2.5 px-3">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {attribution.drivers?.map((d, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30 transition">
                            <td className="py-2 px-3 font-medium text-white">{d.segment}</td>
                            <td className="py-2 px-3 text-slate-400">{d.baselineValue.toLocaleString()}</td>
                            <td className="py-2 px-3 text-slate-300">{d.currentValue.toLocaleString()}</td>
                            <td className={`py-2 px-3 font-semibold ${
                              d.segmentDelta < 0 ? 'text-rose-400' : (d.segmentDelta > 0 ? 'text-emerald-400' : 'text-slate-400')
                            }`}>
                              {d.segmentDelta > 0 ? '+' : ''}{d.segmentDelta.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-200">
                              {d.contributionPercent}%
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-400">
                              {d.absoluteMovementShare}%
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                d.classification.includes('detractor')
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : (d.classification.includes('sustainer') || d.classification.includes('driver')
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-slate-800 text-slate-400')
                              }`}>
                                {d.classification.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grounded AI Driver Explanation */}
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      AI INTERPRETATION • Grounded Driver Narrative
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({attribution.aiGenerated ? 'Gemini 2.5 Flash' : 'Deterministic Rules'})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {attribution.explanation || attribution.observationalSummary}
                  </p>
                </div>
              </>
            ) : null}

          </div>

          {/* Footer Controls */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between sticky bottom-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Close
            </button>
            {attribution && (
              <button
                onClick={() => {
                  onLaunchSimulator(insight, attribution);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition"
              >
                <Sliders className="w-4 h-4" />
                <span>Launch What-If Simulator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
