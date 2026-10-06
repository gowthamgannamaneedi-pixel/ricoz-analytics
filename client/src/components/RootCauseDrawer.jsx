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
 * Enterprise Root-Cause Driver Breakdown Drawer
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div className="w-screen max-w-3xl bg-white border-l border-slate-200 shadow-2xl flex flex-col text-slate-900">
          
          {/* Header */}
          <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Root-Cause Driver Breakdown</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-mono">
                    Attribution Analysis
                  </span>
                </h2>
                <p className="text-xs text-slate-500 truncate max-w-lg mt-0.5">
                  {insight.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Dimension Selection Tabs */}
            {availableDimensions.length > 1 && (
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 overflow-x-auto">
                <span className="text-xs text-slate-500 font-semibold mr-1">
                  Dimension:
                </span>
                {availableDimensions.map(dim => (
                  <button
                    key={dim}
                    onClick={() => setSelectedDimension(dim)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize cursor-pointer ${
                      selectedDimension === dim
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {dim.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-xs font-medium text-slate-500">Decomposing dimensional drivers from dataset rows...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Attribution Unavailable</div>
                  <div className="text-rose-600 mt-0.5">{error}</div>
                </div>
              </div>
            ) : attribution ? (
              <>
                {/* Total Variance & Math Invariant Banner */}
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Historical Baseline</div>
                    <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                      {Number(attribution.totalBaseline || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Current Observation</div>
                    <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                      {Number(attribution.totalCurrent || 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Net Observed Delta</div>
                    <div className={`text-lg font-bold mt-1 flex items-center gap-1 font-mono ${
                      attribution.totalDelta < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {attribution.totalDelta < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      {attribution.totalDelta > 0 ? '+' : ''}{Number(attribution.totalDelta || 0).toLocaleString()} ({attribution.totalDeltaPercent}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Mathematical Balance</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Exact sum(Δy) = ΔY</span>
                    </div>
                  </div>
                </div>

                {/* Primary Detractor / Driver Callout */}
                {attribution.primaryDetractor && (
                  <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-900">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-800">
                        Primary Detractor Segment
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                        Signed Contribution: {attribution.primaryDetractor.contributionPercent}%
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-1.5">
                      {attribution.primaryDetractor.segment}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Accounted for {Math.abs(attribution.primaryDetractor.contributionPercent)}% of the observed net contraction ({attribution.primaryDetractor.delta > 0 ? '+' : ''}{Number(attribution.primaryDetractor.delta || 0).toLocaleString()}).
                    </p>
                  </div>
                )}

                {/* Movement Concentration Metric */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <PieChart className="w-4 h-4 text-blue-600" />
                    <span>
                      <strong className="text-slate-900">Movement Concentration:</strong> {attribution.concentration?.type ? attribution.concentration.type.charAt(0).toUpperCase() + attribution.concentration.type.slice(1) : 'Distributed'} (Score: {attribution.concentration?.hhi})
                    </span>
                  </div>
                  <span className="text-slate-400 italic text-[11px]">
                    Absolute movement share concentration (non-causal)
                  </span>
                </div>

                {/* Drivers Breakdown Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800">
                    Segment Variance Attribution ({attribution.dimension})
                  </h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[620px]">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold">Segment</th>
                            <th className="py-2.5 px-3 font-semibold">Baseline</th>
                            <th className="py-2.5 px-3 font-semibold">Current</th>
                            <th className="py-2.5 px-3 font-semibold">Segment Δ</th>
                            <th className="py-2.5 px-3 font-semibold">Signed Contribution</th>
                            <th className="py-2.5 px-3 font-semibold">Movement Share</th>
                            <th className="py-2.5 px-3 font-semibold">Role</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {attribution.drivers?.map((d, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70 transition">
                              <td className="py-2 px-3 font-medium text-slate-900">{d.segment}</td>
                              <td className="py-2 px-3 text-slate-600 font-mono">{d.baselineValue.toLocaleString()}</td>
                              <td className="py-2 px-3 text-slate-800 font-mono font-medium">{d.currentValue.toLocaleString()}</td>
                              <td className={`py-2 px-3 font-semibold font-mono ${
                                d.segmentDelta < 0 ? 'text-rose-600' : (d.segmentDelta > 0 ? 'text-emerald-600' : 'text-slate-500')
                              }`}>
                                {d.segmentDelta > 0 ? '+' : ''}{d.segmentDelta.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700">
                                {d.contributionPercent}%
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-500">
                                {d.absoluteMovementShare}%
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  d.classification.includes('detractor')
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : (d.classification.includes('sustainer') || d.classification.includes('driver')
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200')
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
                </div>

                {/* Grounded AI Driver Explanation */}
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100 text-xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-blue-900">
                      AI Driver Interpretation
                    </span>
                    <span className="text-[10px] font-mono text-blue-600 bg-blue-100 px-2 py-0.2 rounded border border-blue-200">
                      {attribution.aiGenerated ? 'Gemini' : 'Deterministic Engine'}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {attribution.explanation || attribution.observationalSummary}
                  </p>
                </div>
              </>
            ) : null}

          </div>

          {/* Footer Controls */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between sticky bottom-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              Close
            </button>
            {attribution && (
              <button
                onClick={() => {
                  onLaunchSimulator(insight, attribution);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs flex items-center gap-2 transition cursor-pointer"
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
