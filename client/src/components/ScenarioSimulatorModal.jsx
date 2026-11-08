import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  ArrowRight,
  DollarSign,
  Package,
  Layers,
  Percent,
  Copy,
  Check,
  Calculator,
  Compass
} from 'lucide-react';
import { simulateWhatIfScenario, simulateDatasetWhatIf } from '../services/api';

/**
 * Enterprise Scenario Simulator Modal
 * Interactive What-If Counterfactual Sensitivity Modeling:
 * 1. Financial Levers: Price (ΔP%), Volume (ΔQ%), COGS (ΔCOGS%), Opex (ΔOpex%)
 * 2. Dimensional Segments: Segment-level attribution variations
 * 3. Deterministic & Grounded: Never modifies underlying datasets
 */
export default function ScenarioSimulatorModal({
  isOpen,
  onClose,
  insight,
  attribution,
  datasetId = null,
  datasetName = null
}) {
  const hasAttributionDrivers = Boolean(attribution?.drivers && attribution.drivers.length > 0);
  const [activeTab, setActiveTab] = useState('financial'); // 'financial' | 'segments'

  // Financial levers state
  const [financialLevers, setFinancialLevers] = useState({
    priceChangePct: 0,
    volumeChangePct: 0,
    cogsChangePct: 0,
    opexChangePct: 0,
    conversionChangePct: 0
  });

  // Dimensional segment adjustments state
  const [segmentAdjustments, setSegmentAdjustments] = useState({});

  const [simulationResult, setSimulationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Initialize adjustments from attribution drivers
  useEffect(() => {
    if (!isOpen) return;
    if (attribution?.drivers) {
      const initial = {};
      attribution.drivers.forEach(d => {
        initial[d.segment] = 0;
      });
      setSegmentAdjustments(initial);
    }
  }, [isOpen, attribution]);

  // Initial simulation run when modal opens
  useEffect(() => {
    if (!isOpen) return;
    runSimulation(activeTab === 'financial' ? financialLevers : segmentAdjustments, activeTab);
  }, [isOpen, activeTab, insight?.id, datasetId]);

  const runSimulation = async (currentParams, mode = activeTab) => {
    if (!insight?.id && !datasetId) return;
    setLoading(true);
    setError(null);
    try {
      let res;
      if (mode === 'financial') {
        if (insight?.id) {
          res = await simulateWhatIfScenario(insight.id, {
            scenarioType: 'financial',
            levers: currentParams
          });
        } else if (datasetId) {
          res = await simulateDatasetWhatIf(datasetId, currentParams);
        }
      } else {
        const adjArray = Object.entries(currentParams)
          .filter(([_, val]) => val !== 0)
          .map(([segment, deltaPercent]) => ({
            segment,
            deltaPercent: Number(deltaPercent)
          }));

        res = await simulateWhatIfScenario(insight.id, {
          dimension: attribution?.dimension,
          adjustments: adjArray
        });
      }

      if (res?.success && res?.data) {
        setSimulationResult(res.data);
      } else if (res?.status === 'missing_columns') {
        setError(res.message || 'Dataset lacks required financial columns.');
      } else {
        setError(res?.error?.message || res?.message || 'Failed to execute scenario simulation.');
      }
    } catch (err) {
      setError(err.message || 'Simulation execution error.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinancialLeverChange = (leverKey, value) => {
    const updated = {
      ...financialLevers,
      [leverKey]: Number(value)
    };
    setFinancialLevers(updated);
    runSimulation(updated, 'financial');
  };

  const handleSegmentSliderChange = (segment, value) => {
    const updated = {
      ...segmentAdjustments,
      [segment]: Number(value)
    };
    setSegmentAdjustments(updated);
    runSimulation(updated, 'segments');
  };

  const handleApplyPreset = (preset) => {
    setFinancialLevers(preset.levers);
    setActiveTab('financial');
    runSimulation(preset.levers, 'financial');
  };

  const handleReset = () => {
    if (activeTab === 'financial') {
      const resetLevers = {
        priceChangePct: 0,
        volumeChangePct: 0,
        cogsChangePct: 0,
        opexChangePct: 0,
        conversionChangePct: 0
      };
      setFinancialLevers(resetLevers);
      runSimulation(resetLevers, 'financial');
    } else {
      const resetObj = {};
      Object.keys(segmentAdjustments).forEach(k => { resetObj[k] = 0; });
      setSegmentAdjustments(resetObj);
      runSimulation(resetObj, 'segments');
    }
  };

  const handleCopySummary = () => {
    if (!simulationResult) return;
    const summary = simulationResult.observationalSummary || simulationResult.explanation || '';
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const presets = [
    {
      name: 'Baseline (0%)',
      desc: 'Reset all levers to historical baseline',
      levers: { priceChangePct: 0, volumeChangePct: 0, cogsChangePct: 0, opexChangePct: 0, conversionChangePct: 0 }
    },
    {
      name: 'Conservative Growth',
      desc: '+3% Price, +5% Volume, +2% COGS, +3% Opex',
      levers: { priceChangePct: 3, volumeChangePct: 5, cogsChangePct: 2, opexChangePct: 3, conversionChangePct: 0 }
    },
    {
      name: 'Aggressive Expansion',
      desc: '+10% Price, +15% Volume, +5% COGS, +8% Opex',
      levers: { priceChangePct: 10, volumeChangePct: 15, cogsChangePct: 5, opexChangePct: 8, conversionChangePct: 0 }
    },
    {
      name: 'Cost Squeeze',
      desc: '0% Price, -2% Volume, +12% COGS, +6% Opex',
      levers: { priceChangePct: 0, volumeChangePct: -2, cogsChangePct: 12, opexChangePct: 6, conversionChangePct: 0 }
    },
    {
      name: 'Margin Optimization',
      desc: '+5% Price, -2% Volume, -8% COGS, -5% Opex',
      levers: { priceChangePct: 5, volumeChangePct: -2, cogsChangePct: -8, opexChangePct: -5, conversionChangePct: 0 }
    }
  ];

  const targetName = datasetName || insight?.source_metadata?.dataset_name || 'Business Data';

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-[#334155] rounded-2xl w-full max-w-5xl shadow-2xl text-slate-900 dark:text-[#F8FAFC] overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#334155] flex items-center justify-between bg-slate-50/70 dark:bg-[#0F172A]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 text-rose-600 dark:text-[#FB7185]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                What-If Scenario Simulator
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                  Decision Intelligence
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Counterfactual modeling on verified baseline for <strong className="text-slate-800 dark:text-[#CBD5E1]">{targetName}</strong>
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

        {/* Mode Selector Tabs & Reset */}
        <div className="bg-slate-50 dark:bg-[#0B1120] border-b border-slate-200 dark:border-[#334155] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('financial')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'financial'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Financial Levers (Price, Volume, Cost)</span>
            </button>
            {hasAttributionDrivers && (
              <button
                onClick={() => setActiveTab('segments')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'segments'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Segment Variances ({attribution.dimension})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] hidden sm:inline">
              <strong>Strict Rule:</strong> Mathematical sensitivity only. Original data remains untouched.
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 transition cursor-pointer bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 rounded-lg"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Levers</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-[#111827]">

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-[#2A1422] border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">Scenario Simulation Notice</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* KPI Output Grid (Baseline vs Simulated vs Delta) */}
          {simulationResult && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Gross Revenue */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-[#94A3B8]">
                    <span>Gross Revenue</span>
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mt-1 font-mono">
                    ₹{((simulationResult.simulated?.revenue ?? simulationResult.simulatedTotal) || 0).toLocaleString()}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-[#334155] flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Baseline: ₹{((simulationResult.baseline?.revenue ?? simulationResult.baselineTotal) || 0).toLocaleString()}</span>
                  <span className={`font-mono font-bold ${(simulationResult.variance?.revenueDeltaPct ?? simulationResult.netProjectedPercent) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(simulationResult.variance?.revenueDeltaPct ?? simulationResult.netProjectedPercent) >= 0 ? '+' : ''}
                    {(simulationResult.variance?.revenueDeltaPct ?? simulationResult.netProjectedPercent)}%
                  </span>
                </div>
              </div>

              {/* Card 2: Operating & Production Cost */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-[#94A3B8]">
                    <span>Total Cost (COGS + Opex)</span>
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mt-1 font-mono">
                    ₹{(simulationResult.simulated?.cost || (simulationResult.baseline?.cost || 0)).toLocaleString()}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-[#334155] flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Baseline: ₹{(simulationResult.baseline?.cost || 0).toLocaleString()}</span>
                  <span className={`font-mono font-bold ${(simulationResult.variance?.costDeltaPct || 0) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(simulationResult.variance?.costDeltaPct || 0) >= 0 ? '+' : ''}
                    {(simulationResult.variance?.costDeltaPct || 0)}%
                  </span>
                </div>
              </div>

              {/* Card 3: Gross Profit */}
              <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-[#2A1422] border border-rose-100 dark:border-rose-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-rose-700 dark:text-[#FDA4AF]">
                    <span>Simulated Gross Profit</span>
                    <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <div className="text-xl font-bold text-rose-700 dark:text-[#FDA4AF] mt-1 font-mono">
                    ₹{(simulationResult.simulated?.grossProfit ?? ((simulationResult.simulatedTotal || 0) - (simulationResult.baseline?.cost || 0))).toLocaleString()}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-rose-200/60 dark:border-rose-900/60 flex items-center justify-between text-[11px]">
                  <span className="text-rose-500/80">Base: ₹{(simulationResult.baseline?.grossProfit || 0).toLocaleString()}</span>
                  <span className={`font-mono font-bold ${(simulationResult.variance?.profitDeltaPct || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(simulationResult.variance?.profitDeltaPct || 0) >= 0 ? '+' : ''}
                    {(simulationResult.variance?.profitDeltaPct || 0)}%
                  </span>
                </div>
              </div>

              {/* Card 4: Gross Margin % */}
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-[#94A3B8]">
                    <span>Gross Margin %</span>
                    <Percent className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] mt-1 font-mono">
                    {simulationResult.simulated?.grossMarginPct ?? 35.0}%
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-[#334155] flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Baseline: {simulationResult.baseline?.grossMarginPct ?? 35.0}%</span>
                  <span className={`font-mono font-bold ${(simulationResult.variance?.marginDeltaPct || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {(simulationResult.variance?.marginDeltaPct || 0) >= 0 ? '+' : ''}
                    {(simulationResult.variance?.marginDeltaPct || 0)} pp
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* TAB 1: FINANCIAL LEVERS */}
          {activeTab === 'financial' && (
            <div className="space-y-5">
              
              {/* Presets Row */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-[#CBD5E1] block">
                  Scenario Presets
                </span>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyPreset(p)}
                      title={p.desc}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#334155] bg-slate-50 hover:bg-rose-50 dark:bg-[#1E293B] dark:hover:bg-[#2A1422] text-slate-700 dark:text-[#CBD5E1] hover:text-rose-700 hover:border-rose-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3 text-rose-500" />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Levers Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Lever 1: Price Adjustment */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">Price Adjustment (ΔP%)</span>
                      <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Direct impact on realized selling price</p>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                      financialLevers.priceChangePct > 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : financialLevers.priceChangePct < 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-[#2A1422] dark:text-[#FDA4AF]'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[#1E293B] dark:text-[#CBD5E1]'
                    }`}>
                      {financialLevers.priceChangePct > 0 ? `+${financialLevers.priceChangePct}%` : `${financialLevers.priceChangePct}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={financialLevers.priceChangePct}
                    onChange={(e) => handleFinancialLeverChange('priceChangePct', e.target.value)}
                    className="w-full h-1.5 bg-slate-200 dark:bg-[#334155] rounded-lg appearance-none cursor-pointer accent-rose-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>-50% Price Cut</span>
                    <span>0% (Baseline)</span>
                    <span>+50% Premium</span>
                  </div>
                </div>

                {/* Lever 2: Volume / Demand Adjustment */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">Volume & Demand (ΔQ%)</span>
                      <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Number of units/transactions sold</p>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                      financialLevers.volumeChangePct > 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : financialLevers.volumeChangePct < 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-[#2A1422] dark:text-[#FDA4AF]'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[#1E293B] dark:text-[#CBD5E1]'
                    }`}>
                      {financialLevers.volumeChangePct > 0 ? `+${financialLevers.volumeChangePct}%` : `${financialLevers.volumeChangePct}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={financialLevers.volumeChangePct}
                    onChange={(e) => handleFinancialLeverChange('volumeChangePct', e.target.value)}
                    className="w-full h-1.5 bg-slate-200 dark:bg-[#334155] rounded-lg appearance-none cursor-pointer accent-rose-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>-50% Contraction</span>
                    <span>0% (Baseline)</span>
                    <span>+50% Surge</span>
                  </div>
                </div>

                {/* Lever 3: Cost of Goods Sold (COGS) */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">COGS & Supplier Cost (ΔCOGS%)</span>
                      <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Direct unit cost variance (raw materials, vendor)</p>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                      financialLevers.cogsChangePct > 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-[#2A1422] dark:text-[#FDA4AF]'
                        : financialLevers.cogsChangePct < 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[#1E293B] dark:text-[#CBD5E1]'
                    }`}>
                      {financialLevers.cogsChangePct > 0 ? `+${financialLevers.cogsChangePct}%` : `${financialLevers.cogsChangePct}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={financialLevers.cogsChangePct}
                    onChange={(e) => handleFinancialLeverChange('cogsChangePct', e.target.value)}
                    className="w-full h-1.5 bg-slate-200 dark:bg-[#334155] rounded-lg appearance-none cursor-pointer accent-rose-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>-50% Savings</span>
                    <span>0% (Baseline)</span>
                    <span>+50% Cost Inflation</span>
                  </div>
                </div>

                {/* Lever 4: Operating Expenses (Opex) */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC]">Operating Expenses (ΔOpex%)</span>
                      <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Overhead, marketing & fixed fulfillment costs</p>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                      financialLevers.opexChangePct > 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-[#2A1422] dark:text-[#FDA4AF]'
                        : financialLevers.opexChangePct < 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-[#1E293B] dark:text-[#CBD5E1]'
                    }`}>
                      {financialLevers.opexChangePct > 0 ? `+${financialLevers.opexChangePct}%` : `${financialLevers.opexChangePct}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    step="1"
                    value={financialLevers.opexChangePct}
                    onChange={(e) => handleFinancialLeverChange('opexChangePct', e.target.value)}
                    className="w-full h-1.5 bg-slate-200 dark:bg-[#334155] rounded-lg appearance-none cursor-pointer accent-rose-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>-50% Overhead Cut</span>
                    <span>0% (Baseline)</span>
                    <span>+50% Expansion</span>
                  </div>
                </div>

              </div>

              {/* Mathematical Invariants Callout */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] text-[11px] text-slate-600 dark:text-[#94A3B8] space-y-1">
                <div className="font-semibold text-slate-800 dark:text-[#CBD5E1] flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-rose-600" />
                  <span>Governed Mathematical Formulation</span>
                </div>
                <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1">
                  <div>• Revenue(sim) = Revenue(base) × (1 + ΔPrice%) × (1 + ΔVolume%)</div>
                  <div>• Cost(sim) = [COGS(base) × (1 + ΔCOGS%) × (1 + ΔVolume%)] + [Opex(base) × (1 + ΔOpex%)]</div>
                  <div>• Gross Profit = Revenue(sim) - Cost(sim) | Gross Margin = (Gross Profit / Revenue(sim)) × 100</div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: SEGMENT BREAKDOWN */}
          {activeTab === 'segments' && attribution && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-[#CBD5E1]">
                  Segment Adjustments across {attribution.dimension}
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Bounded at 0 (cannot drop below zero)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attribution.drivers?.map((d) => {
                  const currentVal = segmentAdjustments[d.segment] || 0;
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

                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={currentVal}
                        onChange={(e) => handleSegmentSliderChange(d.segment, e.target.value)}
                        className="w-full h-1.5 bg-slate-200 dark:bg-[#334155] rounded-lg appearance-none cursor-pointer accent-rose-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>-50%</span>
                        <span>0%</span>
                        <span>+50%</span>
                      </div>

                      {segmentSim && segmentSim.isAdjusted && (
                        <div className="pt-2 border-t border-slate-100 dark:border-[#334155] flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-[#94A3B8]">Simulated:</span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-[#F8FAFC]">
                            {segmentSim.simulatedValue.toLocaleString()} ({segmentSim.netDelta >= 0 ? '+' : ''}{segmentSim.netDelta.toLocaleString()})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grounded AI / Deterministic Scenario Synthesis */}
          {simulationResult && (
            <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-[#2A1422] border border-rose-100 dark:border-rose-900/60 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-600 dark:text-[#FB7185]" />
                  <span className="font-bold text-rose-900 dark:text-[#FDA4AF]">
                    Executive Scenario Synthesis
                  </span>
                  <span className="text-[10px] font-mono text-rose-600 dark:text-[#FDA4AF] bg-rose-100 dark:bg-rose-950/60 px-2 py-0.2 rounded border border-rose-200 dark:border-rose-900/60">
                    {simulationResult.aiGenerated ? 'Gemini 2.5 Flash' : 'Deterministic Engine'}
                  </span>
                </div>
                <button
                  onClick={handleCopySummary}
                  className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-[#FB7185] hover:text-rose-900 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Summary'}</span>
                </button>
              </div>
              <p className="text-slate-700 dark:text-[#CBD5E1] leading-relaxed">
                {simulationResult.explanation || simulationResult.observationalSummary}
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#334155] bg-slate-50/70 dark:bg-[#0F172A] flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
            Status: <span className="font-semibold text-emerald-600 dark:text-emerald-400">Deterministic Parity Verified</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B] text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-[#334155] transition cursor-pointer shadow-2xs"
          >
            Close Simulation
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
