import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight
} from 'lucide-react';
import { simulateWhatIfScenario } from '../services/api';

/**
 * Enterprise Scenario Simulator Modal
 * Interactive What-If Counterfactual Sensitivity Modeling.
 */
export default function ScenarioSimulatorModal({
  isOpen,
  onClose,
  insight,
  attribution
}) {
  const [adjustments, setAdjustments] = useState({});
  const [simulationResult, setSimulationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize adjustments from attribution drivers
  useEffect(() => {
    if (!isOpen || !attribution) return;
    const initial = {};
    (attribution.drivers || []).forEach(d => {
      initial[d.segment] = 0;
    });
    setAdjustments(initial);
    // Initial baseline run
    runSimulation(initial);
  }, [isOpen, attribution]);

  const runSimulation = async (currentAdjustments) => {
    if (!insight || !attribution) return;
    setLoading(true);
    setError(null);
    try {
      const adjArray = Object.entries(currentAdjustments)
        .filter(([_, val]) => val !== 0)
        .map(([segment, deltaPercent]) => ({
          segment,
          deltaPercent: Number(deltaPercent)
        }));

      const res = await simulateWhatIfScenario(insight.id, {
        dimension: attribution.dimension,
        adjustments: adjArray
      });

      if (res?.success && res?.data) {
        setSimulationResult(res.data);
      } else {
        setError(res?.error?.message || 'Failed to execute scenario simulation.');
      }
    } catch (err) {
      setError(err.message || 'Simulation execution error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSliderChange = (segment, value) => {
    const updated = {
      ...adjustments,
      [segment]: Number(value)
    };
    setAdjustments(updated);
    runSimulation(updated);
  };

  const handleReset = () => {
    const resetObj = {};
    Object.keys(adjustments).forEach(k => { resetObj[k] = 0; });
    setAdjustments(resetObj);
    runSimulation(resetObj);
  };

  if (!isOpen || !attribution) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155] rounded-2xl w-full max-w-4xl shadow-2xl text-slate-900 dark:text-[#F8FAFC] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-[#334155] flex items-center justify-between bg-slate-50/70 dark:bg-[#0F172A]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 text-rose-600 dark:text-[#FB7185]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                What-If Scenario Simulator
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Simulate driver adjustments for <strong className="text-slate-800 dark:text-[#CBD5E1]">{attribution.metric}</strong> across <strong className="text-slate-800 dark:text-[#CBD5E1]">{attribution.dimension}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-[#94A3B8] hover:text-slate-700 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1E293B] transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counterfactual Notice Banner */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-900/60 px-6 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Projected Scenario Simulation:</strong> Mathematical sensitivity modeling only. Does not alter underlying dataset records.
            </span>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-[#111827]">

          {/* Diff Metric Cards */}
          {simulationResult && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155]">
                <span className="text-[11px] font-medium text-slate-500 dark:text-[#94A3B8]">Verified Baseline</span>
                <div className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mt-1 font-mono">
                  {simulationResult.baselineTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Current verified row sum</div>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-[#2A1422] border border-rose-100 dark:border-rose-900/60">
                <span className="text-[11px] font-medium text-rose-700 dark:text-[#FDA4AF]">Counterfactual Projection</span>
                <div className="text-xl font-bold text-rose-700 dark:text-[#FDA4AF] mt-1 font-mono">
                  {simulationResult.simulatedTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-rose-500 dark:text-[#FB7185] mt-1">Simulated outcome</div>
              </div>

              <div className={`p-4 rounded-xl border ${
                simulationResult.netProjectedDelta >= 0
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80'
                  : 'bg-rose-50/60 dark:bg-[#2A1422] border-rose-200 dark:border-rose-900/80'
              }`}>
                <span className="text-[11px] font-medium text-slate-500 dark:text-[#94A3B8]">Net Projected Variance</span>
                <div className={`text-xl font-bold mt-1 flex items-center gap-1 font-mono ${
                  simulationResult.netProjectedDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-[#FDA4AF]'
                }`}>
                  {simulationResult.netProjectedDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {simulationResult.netProjectedDelta >= 0 ? '+' : ''}{simulationResult.netProjectedDelta.toLocaleString()} ({simulationResult.netProjectedPercent}%)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-1">Difference over baseline</div>
              </div>
            </div>
          )}

          {/* Interactive Sliders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-[#CBD5E1]">
                Segment Adjustments (% Change)
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-normal">Bounded at 0 (cannot drop below zero)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attribution.drivers?.map((d) => {
                const currentVal = adjustments[d.segment] || 0;
                const segmentSim = simulationResult?.segmentBreakdown?.find(s => s.segment === d.segment);

                return (
                  <div
                    key={d.segment}
                    className="p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-[#F8FAFC]">{d.segment}</div>
                        <div className="text-xs text-slate-500 dark:text-[#94A3B8]">
                          Baseline: <span className="font-mono text-slate-700 dark:text-[#CBD5E1]">{d.currentValue.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          currentVal > 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80'
                            : (currentVal < 0 ? 'bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/80' : 'bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-[#CBD5E1] border border-slate-200 dark:border-[#334155]')
                        }`}>
                          {currentVal > 0 ? `+${currentVal}%` : `${currentVal}%`}
                        </span>
                      </div>
                    </div>

                    {/* Slider Control */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={currentVal}
                        onChange={(e) => handleSliderChange(d.segment, e.target.value)}
                        className="w-full h-1.5 bg-slate-200 dark:bg-[#334155] rounded-lg appearance-none cursor-pointer accent-rose-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        <span>-50%</span>
                        <span>0%</span>
                        <span>+50%</span>
                      </div>
                    </div>

                    {/* Projected Segment Delta */}
                    {segmentSim && segmentSim.isAdjusted && (
                      <div className="pt-2 border-t border-slate-100 dark:border-[#334155] flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-[#94A3B8]">Simulated:</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-[#F8FAFC]">
                          {segmentSim.simulatedValue.toLocaleString()} ({segmentSim.netDelta >= 0 ? '+' : ''}{segmentSim.netDelta.toLocaleString()})
                        </span>
                        {segmentSim.clampedAtZero && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80">
                            Bounded at 0
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grounded AI Scenario Synthesis */}
          {simulationResult && (
            <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-[#2A1422] border border-rose-100 dark:border-rose-900/60 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-600 dark:text-[#FB7185]" />
                <span className="font-bold text-rose-900 dark:text-[#FDA4AF]">
                  AI Scenario Synthesis
                </span>
                <span className="text-[10px] font-mono text-rose-600 dark:text-[#FDA4AF] bg-rose-100 dark:bg-rose-950/60 px-2 py-0.2 rounded border border-rose-200 dark:border-rose-900/60">
                  {simulationResult.aiGenerated ? 'Gemini' : 'Deterministic Engine'}
                </span>
              </div>
              <p className="text-slate-700 dark:text-[#CBD5E1] leading-relaxed">
                {simulationResult.explanation || simulationResult.observationalSummary}
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#334155] bg-slate-50/70 dark:bg-[#0F172A] flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B] text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-[#334155] transition cursor-pointer shadow-2xs"
          >
            Close Simulation
          </button>
        </div>

      </div>
    </div>
  );
}
