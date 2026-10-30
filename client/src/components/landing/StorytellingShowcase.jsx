import React, { useEffect, useRef, useState } from 'react';
import { 
  Database, 
  Layers, 
  Sparkles, 
  Activity, 
  CheckCircle2, 
  ArrowRight, 
  TrendingUp, 
  AlertTriangle, 
  Cpu, 
  ShieldCheck, 
  Zap, 
  BarChart3,
  GitBranch,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * StorytellingShowcase — Stellar Management-Style Pinned Scroll Storytelling
 * As the user scrolls vertically through the pinned viewport, the narrative 
 * steps through 4 chronological enterprise milestones with synchronized visual 
 * mockup transformations, progressive telemetry streams, and smooth crossfades.
 */
export default function StorytellingShowcase({ onOpenDemo }) {
  const containerRef = useRef(null);
  const pinSectionRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const steps = [
    {
      step: '01',
      tag: 'CONNECT',
      title: 'Connect Multiple Business Data Sources',
      subtitle: 'Eliminate complex batch data pipelines and fragile nightly cron jobs.',
      description: 'Stream transactions directly from production PostgreSQL, Snowflake, MongoDB, Google Sheets, and REST Webhooks into a unified semantic memory layer with sub-250ms ingestion latency.',
      highlights: [
        'Zero transformation schema backpressure',
        'Direct federated querying without secondary egress fees',
        'Continuous real-time change data capture (CDC)'
      ],
      badge: 'Multi-Source Federation'
    },
    {
      step: '02',
      tag: 'MODEL',
      title: 'Transform Raw Data into Governed Business Metrics',
      subtitle: 'Build once. Standardize enterprise business logic across the company.',
      description: 'Define EBITDA, Customer Acquisition Cost, and Regional Store Velocity in a visual drag-and-drop formula canvas. Changes instantly synchronize across all dashboards, reports, and AI models.',
      highlights: [
        'Version-controlled KPI formula definitions',
        'Automatic SQL query tree optimization',
        'Cross-source relational entity joins'
      ],
      badge: 'Semantic Formula Studio'
    },
    {
      step: '03',
      tag: 'DISCOVER',
      title: 'Identify Hidden Patterns, Trends & Anomalies',
      subtitle: 'Never ask "why did revenue change?" in a boardroom again.',
      description: 'When regional gross margins or inventory turn rates deviate from expected seasonal baselines, the autonomous attribution engine evaluates millions of permutations in 0.38 seconds to pinpoint exact root causes.',
      highlights: [
        'Attribution waterfall with p < 0.01 statistical significance',
        'Dynamic seasonal trend baseline modeling',
        'Proactive anomaly alerts before ledger closes'
      ],
      badge: 'AI Diagnostic Engine'
    },
    {
      step: '04',
      tag: 'DECIDE',
      title: 'Turn Analytics into Actionable Business Decisions',
      subtitle: 'Transform raw charts into prescriptive corporate decisions.',
      description: 'Automated executive briefs delivered at 7:00 AM every Monday to board members, regional franchise directors, and department heads with 1-click ledger credit authorization and prescriptive action playbooks.',
      highlights: [
        'Automated PDF & Slack leadership digests',
        '1-click discrepancy workflow dispatch',
        'Franchise row-level security masking'
      ],
      badge: 'Autonomous Decision Cockpit'
    }
  ];

  useEffect(() => {
    const container = containerRef.current;
    const pinSection = pinSectionRef.current;
    if (!container || !pinSection) return;

    // Check if screen is mobile / tablet
    const isMobile = window.innerWidth < 1024;
    if (isMobile) return; // On mobile, we use tab buttons rather than sticky pin

    // Check prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: container,
        start: 'top top',
        end: 'bottom bottom',
        pin: pinSection,
        scrub: 0.6,
        onUpdate: (self) => {
          setScrollProgress(self.progress);
          const rawIdx = Math.floor(self.progress * steps.length);
          const clampedIdx = Math.min(rawIdx, steps.length - 1);
          setActiveStep(clampedIdx);
        }
      });
    }, container);

    return () => ctx.revert();
  }, []);

  const handleStepClick = (idx) => {
    setActiveStep(idx);
    const isMobile = window.innerWidth < 1024;
    if (!isMobile && containerRef.current) {
      const containerTop = containerRef.current.offsetTop;
      const containerHeight = containerRef.current.offsetHeight;
      const targetScroll = containerTop + (idx / (steps.length - 1)) * (containerHeight - window.innerHeight);
      window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  };

  return (
    <section 
      ref={containerRef} 
      id="storytelling" 
      className="relative bg-slate-900 text-white lg:h-[350vh]"
    >
      {/* Pinned Viewport Container */}
      <div 
        ref={pinSectionRef} 
        className="w-full lg:h-screen flex flex-col justify-center py-16 lg:py-0 overflow-hidden relative border-t border-b border-slate-800"
      >
        {/* Subtle Architectural Grid & Ambient Gradient */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl" />
        </div>

        {/* Global Progress Bar (Top of Pinned Screen) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 z-30">
          <div 
            className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-red-500 transition-all duration-150 ease-out"
            style={{ width: `${Math.max(5, scrollProgress * 100)}%` }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
          {/* Section Eyebrow Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-400 text-xs font-mono font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Choreographed Product Storytelling</span>
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
              <span>Scroll to explore stages:</span>
              <span className="text-white font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                0{activeStep + 1} / 0{steps.length}
              </span>
            </div>
          </div>

          {/* Main 2-Column Split: Story Stepper (Left) vs. Dynamic Cockpit Mockup (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* ─── LEFT COLUMN: PROGRESS STEPPER & COPY (5 COLS) ─── */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              
              {/* Stepper Navigation Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {steps.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleStepClick(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                      activeStep === idx
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-102'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
                    }`}
                  >
                    <span>{s.step}</span>
                    <span className="hidden sm:inline opacity-80">{s.tag}</span>
                  </button>
                ))}
              </div>

              {/* Active Step Content with Animated Reveal */}
              <div className="space-y-4 min-h-[260px] flex flex-col justify-center">
                <div className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <span>STAGE {steps[activeStep].step}</span>
                  <span>•</span>
                  <span>{steps[activeStep].tag}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight transition-all duration-300">
                  {steps[activeStep].title}
                </h3>

                <p className="text-sm font-semibold text-rose-300/90 leading-snug">
                  {steps[activeStep].subtitle}
                </p>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                  {steps[activeStep].description}
                </p>

                {/* Key Capability Bullet Points */}
                <div className="space-y-2 pt-2">
                  {steps[activeStep].highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-slate-200">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Step CTA */}
              <div className="pt-2 flex items-center gap-4">
                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm transition-all duration-200 shadow-md shadow-red-600/30 hover:scale-102 cursor-pointer"
                >
                  <span>Experience Interactive Demo</span>
                  <ArrowRight size={14} />
                </button>

                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  {activeStep < steps.length - 1 ? '↓ Scroll for next stage' : '✓ Full workflow completed'}
                </span>
              </div>
            </div>

            {/* ─── RIGHT COLUMN: DYNAMIC ENTERPRISE COCKPIT MOCKUP (7 COLS) ─── */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl bg-slate-950 p-4 sm:p-6 border border-slate-800 shadow-2xl overflow-hidden transition-all duration-500 min-h-[460px] flex flex-col justify-between">
                
                {/* Mockup Window Header Bar */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-xs font-mono text-slate-400 pl-2">
                      ricoz-core-os // {steps[activeStep].tag.toLowerCase().replace(/[\s-]/g, '_')}
                    </span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 text-[10px] font-mono font-bold">
                    {steps[activeStep].badge}
                  </span>
                </div>

                {/* ─── STAGE 01: ZERO-ETL INGESTION VISUAL ─── */}
                {activeStep === 0 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                      <span className="font-bold text-white flex items-center gap-2">
                        <Database size={14} className="text-red-500" />
                        <span>Direct Multi-Source Federated Ingestion Fabric</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 font-bold">
                        P99: 142ms LATENCY
                      </span>
                    </div>

                    {/* 4 Data Source Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="text-[10px] font-semibold text-slate-300">PostgreSQL OLTP</div>
                        <div className="text-sm font-bold text-white mt-1">42,890 evt/s</div>
                        <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Sub-250ms CDC</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="text-[10px] font-semibold text-slate-300">Snowflake DW</div>
                        <div className="text-sm font-bold text-white mt-1">1.2 TB Query</div>
                        <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Zero-Copy</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="text-[10px] font-semibold text-slate-300">MongoDB Clusters</div>
                        <div className="text-sm font-bold text-white mt-1">18 Nodes</div>
                        <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Active Shards</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="text-[10px] font-semibold text-slate-300">REST &amp; Webhooks</div>
                        <div className="text-sm font-bold text-white mt-1">214 ms Stream</div>
                        <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Streaming</span>
                        </div>
                      </div>
                    </div>

                    {/* Animated Data Pipeline Stream Graphic */}
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-300 border-b border-slate-800 pb-2">
                        <span className="font-bold text-white">LIVE_EVENT_INGESTION_STREAM</span>
                        <span className="text-emerald-400 font-bold">1,280,000 EVT/HR • ZERO BACKPRESSURE</span>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center text-slate-200 bg-slate-950/60 p-1.5 rounded border border-slate-800/60">
                          <span className="truncate pr-2 font-mono">[19:24:02] INGEST: Store #812 Bangalore West</span>
                          <span className="text-emerald-400 font-bold shrink-0">+₹48,200</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-200 bg-slate-950/60 p-1.5 rounded border border-slate-800/60">
                          <span className="truncate pr-2 font-mono">[19:24:02] CDC_COMMIT: Store #402 Mumbai Central</span>
                          <span className="text-emerald-400 font-bold shrink-0">+₹1,12,400</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-200 bg-slate-950/60 p-1.5 rounded border border-slate-800/60">
                          <span className="truncate pr-2 font-mono">[19:24:03] INVENTORY: SKU-RCZ-PRO-09 Auto-Synced</span>
                          <span className="text-blue-400 font-bold shrink-0">QTY -24</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 flex items-center justify-between text-xs font-mono text-red-200">
                      <span className="flex items-center gap-2">
                        <Zap size={15} className="text-red-400" />
                        <span className="font-semibold">Ricoz Federated Data Mesh Active</span>
                      </span>
                      <span className="text-white font-bold">100% Ingestion Integrity</span>
                    </div>
                  </div>
                )}

                {/* ─── STAGE 02: FORMULA STUDIO VISUAL ─── */}
                {activeStep === 1 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2.5">
                        <span className="text-white font-bold flex items-center gap-2">
                          <Sliders size={14} className="text-red-500" />
                          <span>Visual Governed KPI Formula Builder</span>
                        </span>
                        <span className="text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/60 text-[10px] font-mono font-bold">
                          SYNTAX VALIDATED (14ms Compile)
                        </span>
                      </div>
                      
                      {/* Visual Flow Nodes instead of raw code */}
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                        <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          Metric: [Regional_EBITDA_Velocity]
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          <span className="px-3 py-1.5 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-300 font-bold text-xs">
                            Invoiced Revenue: ₹8.42 Cr
                          </span>
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-red-400 font-black flex items-center justify-center text-sm">
                            -
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300 font-bold text-xs">
                            Supply Chain COGS: ₹2.66 Cr
                          </span>
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-black flex items-center justify-center text-sm">
                            ÷
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-purple-950/80 border border-purple-800 text-purple-300 font-bold text-xs">
                            Active Store Hubs: 48
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs mt-2">
                          <span className="font-semibold text-slate-300">Computed Output:</span>
                          <span className="font-mono font-black text-emerald-400 text-sm">
                            ₹1.20 Cr / Hub (68.4% Operating Margin)
                          </span>
                        </div>
                      </div>

                      {/* Engine Execution Performance */}
                      <div className="grid grid-cols-3 gap-2.5 text-xs pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                          <div className="text-[10px] font-mono text-slate-400">Execution Speed</div>
                          <div className="text-xs font-mono font-bold text-white mt-0.5">14 ms</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                          <div className="text-[10px] font-mono text-slate-400">Rows Scanned</div>
                          <div className="text-xs font-mono font-bold text-white mt-0.5">1.42 Million</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                          <div className="text-[10px] font-mono text-slate-400">Cache Hit Rate</div>
                          <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">99.4%</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs text-slate-200">
                      <span className="flex items-center gap-2">
                        <GitBranch size={15} className="text-emerald-400" />
                        <span>Propagated to 48 franchise dashboards &amp; AI models</span>
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">100% Synchronized</span>
                    </div>
                  </div>
                )}

                {/* ─── STAGE 03: ROOT-CAUSE ATTRIBUTION VISUAL ─── */}
                {activeStep === 2 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2.5">
                        <span className="font-bold text-white flex items-center gap-2">
                          <TrendingUp size={14} className="text-emerald-400" />
                          <span>Autonomous Variance Attribution Waterfall</span>
                        </span>
                        <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 text-[10px] font-mono font-bold">
                          p &lt; 0.01 (High Significance)
                        </span>
                      </div>

                      {/* Clear Diagnostic Statement */}
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">
                        South Region generated <strong className="text-emerald-400">+28.4% Surplus</strong> (₹3.82 Cr vs ₹2.97 Cr plan). Primary driver: High-ticket enterprise reorders at Bangalore &amp; Chennai franchise hubs.
                      </p>

                      {/* Attribution Waterfall Steps */}
                      <div className="space-y-2 pt-1 font-mono text-xs">
                        {/* Baseline */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                          <span className="text-slate-300 font-sans">1. Baseline Planned Target</span>
                          <span className="text-slate-300 font-bold">₹6.62 Cr (Budget)</span>
                        </div>

                        {/* Positive Delta 1 */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-900/60">
                          <span className="text-emerald-200 font-sans">+ Bangalore &amp; Chennai Store Expansion</span>
                          <span className="text-emerald-400 font-bold">+₹1.36 Cr (+16.2%)</span>
                        </div>

                        {/* Positive Delta 2 */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-900/60">
                          <span className="text-emerald-200 font-sans">+ Enterprise Average Basket Size Surge</span>
                          <span className="text-emerald-400 font-bold">+₹0.62 Cr (+7.4%)</span>
                        </div>

                        {/* Negative Delta */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-red-950/40 border border-red-900/60">
                          <span className="text-red-200 font-sans">- Regional Logistics Fuel Surcharge</span>
                          <span className="text-red-400 font-bold">-₹0.18 Cr (-2.1%)</span>
                        </div>

                        {/* Final Actual */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-emerald-800 font-bold">
                          <span className="text-white font-sans">= Final Actual Invoiced Revenue</span>
                          <span className="text-emerald-400 text-sm">₹8.42 Cr (+28.4% Surplus)</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-between text-xs text-emerald-200 font-mono">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-400" />
                        <span>Prescriptive Action Generated:</span>
                      </span>
                      <span className="text-white font-bold">15% Inventory Safety Buffer Added</span>
                    </div>
                  </div>
                )}

                {/* ─── STAGE 04: EXECUTIVE COCKPIT VISUAL ─── */}
                {activeStep === 3 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2.5">
                        <span className="font-bold text-white flex items-center gap-2">
                          <FileText size={14} className="text-red-500" />
                          <span>Executive Brief Dispatch Engine</span>
                        </span>
                        <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 text-[10px] font-mono font-bold">
                          SCHEDULED: 07:00 AM EVERY MONDAY
                        </span>
                      </div>

                      {/* Brief Card Preview */}
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs font-sans">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-white text-sm">Weekly Leadership Performance Digest</div>
                          <span className="text-[10px] font-mono bg-purple-950/80 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-800 font-bold">
                            BOARD CONFIDENTIAL
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Delivered automatically to 14 executive stakeholders across Email, Slack, and secure iOS Mobile PWA.
                        </p>
                        
                        <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-center">
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400">Net Invoiced</div>
                            <div className="text-xs font-bold text-white mt-0.5">₹8.42 Cr</div>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400">Growth vs Plan</div>
                            <div className="text-xs font-bold text-emerald-400 mt-0.5">+24.8%</div>
                          </div>
                          <div className="p-2 rounded bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400">Operating Health</div>
                            <div className="text-xs font-bold text-emerald-400 mt-0.5">100% SLA</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs pt-1 font-mono">
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 font-sans text-xs">Security Masking</span>
                          <span className="text-emerald-400 font-bold">Row-Level (RLS)</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 font-sans text-xs">Audit Verification</span>
                          <span className="text-blue-400 font-bold">Immutable SHA-256</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 flex items-center justify-between text-xs text-red-200 font-mono">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={15} className="text-red-400" />
                        <span className="font-semibold">Ready for enterprise franchise networks</span>
                      </span>
                      <span className="text-white font-bold">Full Governance Active</span>
                    </div>
                  </div>
                )}

                {/* Bottom Interactive Mockup Footer Controls */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>STAGE: 0{activeStep + 1} / 0{steps.length}</span>
                  <div className="flex items-center gap-1.5">
                    {steps.map((_, i) => (
                      <span 
                        key={i} 
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          activeStep === i ? 'bg-red-500 w-5' : 'bg-slate-700'
                        }`} 
                      />
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
