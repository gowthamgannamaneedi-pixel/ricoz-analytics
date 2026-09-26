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
 * Scenario Simulator Modal (Phase 6)
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                What-If Counterfactual Scenario Simulator
              </h2>
              <p className="text-xs text-slate-400">
                Simulate driver adjustments for <strong className="text-white">{attribution.metric}</strong> across <strong className="text-white">{attribution.dimension}</strong>
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

        {/* Counterfactual Notice Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>COUNTERFACTUAL / PROJECTED SIMULATION:</strong> Mathematical sensitivity modeling only. Does not alter underlying dataset.
            </span>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-200 transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Diff Metric Cards */}
          {simulationResult && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-xs text-slate-400">Verified Baseline</span>
                <div className="text-xl font-bold text-white mt-1">
                  {simulationResult.baselineTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Current verified row sum</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <span className="text-xs text-slate-400">Counterfactual Projection</span>
                <div className="text-xl font-bold text-indigo-400 mt-1">
                  {simulationResult.simulatedTotal.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Simulated outcome</div>
              </div>

              <div className={`p-4 rounded-xl border ${
                simulationResult.netProjectedDelta >= 0
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-rose-500/10 border-rose-500/20'
              }`}>
                <span className="text-xs text-slate-400">Net Projected Variance</span>
                <div className={`text-xl font-bold mt-1 flex items-center gap-1 ${
                  simulationResult.netProjectedDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {simulationResult.netProjectedDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {simulationResult.netProjectedDelta >= 0 ? '+' : ''}{simulationResult.netProjectedDelta.toLocaleString()} ({simulationResult.netProjectedPercent}%)
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Difference over baseline</div>
              </div>
            </div>
          )}

          {/* Interactive Sliders */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Segment Adjustments (% Change)</span>
              <span className="text-[11px] text-slate-500 font-normal">Bounded at 0 (cannot drop below zero)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attribution.drivers?.map((d) => {
                const currentVal = adjustments[d.segment] || 0;
                const segmentSim = simulationResult?.segmentBreakdown?.find(s => s.segment === d.segment);

                return (
                  <div
                    key={d.segment}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{d.segment}</div>
                        <div className="text-xs text-slate-400">
                          Baseline: <span className="font-mono text-slate-300">{d.currentValue.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          currentVal > 0
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : (currentVal < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-700 text-slate-300')
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
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>-50%</span>
                        <span>0%</span>
                        <span>+50%</span>
                      </div>
                    </div>

                    {/* Projected Segment Delta */}
                    {segmentSim && segmentSim.isAdjusted && (
                      <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Simulated:</span>
                        <span className="font-mono font-medium text-slate-200">
                          {segmentSim.simulatedValue.toLocaleString()} ({segmentSim.netDelta >= 0 ? '+' : ''}{segmentSim.netDelta.toLocaleString()})
                        </span>
                        {segmentSim.clampedAtZero && (
                          <span className="text-[10px] text-amber-400 font-semibold px-1.5 py-0.2 rounded bg-amber-500/10">
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
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  AI INTERPRETATION • Grounded Scenario Synthesis
                </span>
                <span className="text-[10px] text-slate-500">
                  ({simulationResult.aiGenerated ? 'Gemini 2.5 Flash' : 'Deterministic Rules'})
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {simulationResult.explanation || simulationResult.observationalSummary}
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Close Simulation
          </button>
        </div>

      </div>
    </div>
  );
}
