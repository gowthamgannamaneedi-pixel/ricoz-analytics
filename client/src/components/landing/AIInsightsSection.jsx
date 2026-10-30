import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Bot, 
  Send, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  Cpu, 
  ShieldCheck,
  ChevronRight,
  Sliders,
  HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Interactive3DCard from './Interactive3DCard';

export default function AIInsightsSection({ onOpenDemo }) {
  const [activeQueryIndex, setActiveQueryIndex] = useState(0);

  const queryDemos = [
    {
      prompt: 'Why did South region revenue jump +28.4% this quarter?',
      category: 'Root-Cause Diagnosis',
      correlation: 'Significance: p < 0.01 (High)',
      executiveSummary: 'Revenue surge in South Region (HQ & 48 Hubs) was primarily driven by high-velocity retail reorders at Bangalore and Chennai hubs, combined with a 14.2% increase in average ticket size following the Q2 corporate product expansion.',
      drivers: [
        { name: 'Bangalore & Chennai Hub expansion', impact: '+16.2%', positive: true },
        { name: 'Average order basket size increase', impact: '+7.4%', positive: true },
        { name: 'Repeat subscription contracts', impact: '+4.8%', positive: true },
      ],
      recommendedAction: 'Increase safety stock allocation by 15% at Chennai fulfillment node before next quarter to avoid stockouts.',
      metrics: {
        latency: '0.38s query response',
        scannedRows: '1,420,890 transactions analyzed',
        model: 'Ricoz Autonomous Copilot v2.4'
      }
    },
    {
      prompt: 'Predict Q4 EBITDA impact if raw supply costs rise by 4.5%',
      category: 'Predictive What-If Simulation',
      correlation: 'Model Fit: R² = 0.94',
      executiveSummary: 'A 4.5% increase in baseline supply chain input costs will compress projected EBITDA by ₹38.6 Lakhs (-2.1% margin erosion), but will remain comfortably above your board threshold of 65.0% due to franchise fee indexing.',
      drivers: [
        { name: 'Gross raw material input cost shift', impact: '-₹38.6L', positive: false },
        { name: 'Automatic franchise margin hedge', impact: '+₹14.2L', positive: true },
        { name: 'Net projected EBITDA buffer', impact: '66.3% margin', positive: true },
      ],
      recommendedAction: 'Activate dynamic Tier-2 vendor routing in Procurement module to offset 60% of the anticipated variance.',
      metrics: {
        latency: '0.45s Monte Carlo simulation',
        scannedRows: '48 branch cost models evaluated',
        model: 'Ricoz Predictive Econometric Engine'
      }
    },
    {
      prompt: 'Scan for margin and inventory anomalies across all 48 branches',
      category: 'Proactive Anomaly Sentinel',
      correlation: 'Anomaly Deviation: 3.4σ',
      executiveSummary: 'Anomaly Sentinel detected 1 critical margin divergence: Hub #19 (Hyderabad West) exhibited a -14.2% margin contraction over the last 72 hours despite volume growth, traced to an unapplied vendor promotion rebate.',
      drivers: [
        { name: 'Hub #19 Unapplied vendor discount code', impact: '-14.2%', positive: false },
        { name: '47 other branches reporting healthy margins', impact: 'Nominal', positive: true },
        { name: 'Corrective rebate credit slip pending', impact: '+₹4.2L recoverable', positive: true },
      ],
      recommendedAction: 'Automated discrepancy ticket #ANM-8041 dispatched to Regional Finance Director with 1-click ledger credit authorization.',
      metrics: {
        latency: 'Real-time telemetry scan',
        scannedRows: 'Continuous background monitoring',
        model: 'Ricoz Anomaly Sentinel v3.1'
      }
    }
  ];

  const currentQuery = queryDemos[activeQueryIndex];

  return (
    <section 
      id="ai-insights" 
      className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800"
      style={{ perspective: '1400px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <Sparkles size={14} className="text-red-600 dark:text-red-400" />
            <span>Autonomous Intelligence</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Ask Plain English Questions.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Get Executive Answers.
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Stop waiting days for data analysts to write SQL. Ricoz AI Copilot inspects millions of rows, diagnoses root causes, forecasts EBITDA, and alerts you before margin leakages occur.
          </p>
        </div>

        {/* Interactive AI Studio Grid with 3D Depth */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Interactive Query Simulator (7 cols) */}
          <div className="lg:col-span-7 bg-slate-50/80 dark:bg-slate-900/80 rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-xl transition-all duration-300">
            {/* Terminal Header */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/30">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ricoz Copilot Studio</h3>
                  <div className="text-[10px] text-slate-400">Natural Language Enterprise Query Engine</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  Model Confidence: {currentQuery.confidence}
                </span>
              </div>
            </div>

            {/* Clickable Prompt Suggestion Chips */}
            <div className="mb-6 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Try Asking One of These Business Questions:
              </div>
              <div className="flex flex-col gap-2">
                {queryDemos.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveQueryIndex(idx)}
                    className={`w-full text-left p-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex items-center justify-between cursor-pointer ${
                      activeQueryIndex === idx
                        ? 'bg-red-600 text-white shadow-xl shadow-red-600/30 scale-101'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:border-red-300 hover:scale-101'
                    }`}
                  >
                    <span className="truncate pr-2 font-semibold">"{q.prompt}"</span>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded shrink-0 ${
                      activeQueryIndex === idx
                        ? 'bg-white/20 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {q.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Live Answer Container */}
            <div className="bg-white dark:bg-slate-950 rounded-2xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-xs font-bold mb-3">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Sparkles size={14} className="animate-pulse" />
                  <span>Synthesized Executive Intelligence</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                  {currentQuery.correlation}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium mb-5">
                {currentQuery.executiveSummary}
              </p>

              {/* Waterfall Driver Breakdown */}
              <div className="mb-5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Key Variance Drivers Identified:
                </div>
                {currentQuery.drivers.map((d, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{d.name}</span>
                    <span className={`font-mono font-bold ${
                      d.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {d.impact}
                    </span>
                  </div>
                ))}
              </div>

              {/* Prescriptive Recommended Action */}
              <div className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/50">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1 flex items-center gap-1.5">
                  <Zap size={12} />
                  <span>Recommended Executive Action:</span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-semibold">
                  {currentQuery.recommendedAction}
                </p>
              </div>

              {/* Technical Scan Metrics */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                <span>{currentQuery.metrics.latency}</span>
                <span>{currentQuery.metrics.scannedRows}</span>
                <span>{currentQuery.metrics.model}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive 3D Anomaly Sentinel Card (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <Interactive3DCard
              maxTilt={12}
              scale={1.03}
              glare={true}
              className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4" style={{ transform: 'translateZ(20px)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-md shadow-red-600/30">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Autonomous Anomaly Sentinel</h4>
                    <div className="text-[10px] text-slate-400">24/7 Continuous Metric Deviation Guard</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  Active Guard
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4" style={{ transform: 'translateZ(10px)' }}>
                Unlike static alerts that only ring when a threshold is breached, Ricoz Machine Learning establishes dynamic seasonal baselines and detects subtle margin leakages in real-time.
              </p>

              {/* Live Incident Demonstration */}
              <div 
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-2 mb-4 shadow-inner"
                style={{ transform: 'translateZ(25px)' }}
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span>INCIDENT_ID: #ANM-8041</span>
                  <span className="text-amber-400 font-bold">P1 WARNING</span>
                </div>
                <div className="text-slate-200">
                  Margin variance detected in West Region Hub 19 (-14.2% from dynamic baseline).
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 pt-1 border-t border-slate-800">
                  <CheckCircle2 size={13} />
                  <span>Automated dispatch sent to Slack &amp; Regional VP</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400" style={{ transform: 'translateZ(15px)' }}>
                <span>False-positive rate: &lt; 0.02%</span>
                <span className="text-red-400 font-bold">Zero alert fatigue</span>
              </div>
            </Interactive3DCard>

            {/* Privacy & Governance Safeguard Card */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 shadow-md">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Zero Data Leakage Sovereign Guarantee
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Your enterprise data is NEVER used to train public foundation models. All AI analysis executes inside your sovereign tenant boundary with full encryption and audit logs.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <Link
                  to="/register"
                  className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                >
                  <span>Experience AI Copilot live in trial</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
