import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  ChevronRight,
  FileText,
  Calculator,
  Equal,
  RotateCcw
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { calculateGrossMetrics, DEFAULT_ILLUSTRATIVE_METRICS } from '../../utils/formulaCalculator';

gsap.registerPlugin(ScrollTrigger);

/**
 * StorytellingShowcase — Interactive Pinned Scroll Workflow
 * Steps through 4 verified product capabilities:
 * 1. Connect Data Sources (PostgreSQL, MongoDB, REST API, CSV/Excel)
 * 2. Standardize Formulas (Programmatic Gross Profit, Margin & Per-Hub Metrics)
 * 3. Explore Trends & Variances (Identify driver contributions)
 * 4. Automated Reporting & Briefings (Scheduled PDF digests & dashboards)
 */
export default function StorytellingShowcase({ onOpenDemo }) {
  const containerRef = useRef(null);
  const pinSectionRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Dynamic formula inputs for interactive testing
  const [formulaInputs, setFormulaInputs] = useState({
    revenue: 8.42,
    cogs: 2.66,
    hubs: 48
  });

  // Programmatic formula calculation dynamically computed from live inputs
  const formulaMetrics = useMemo(() => {
    return calculateGrossMetrics(
      Number(formulaInputs.revenue) || 0,
      Number(formulaInputs.cogs) || 0,
      Number(formulaInputs.hubs) || 0,
      { currencySymbol: '₹', unit: 'Cr' }
    );
  }, [formulaInputs]);

  const steps = [
    {
      step: '01',
      tag: 'CONNECT',
      title: 'Connect Business Data Sources',
      subtitle: 'Bring together production databases, APIs, and spreadsheet files into one workspace.',
      description: 'Connect PostgreSQL, MongoDB, REST API webhooks, and CSV/Excel files with direct schema introspection. RicozAnalytics reads tables, infers column datatypes, and prepares your data for analysis without complex pipelines.',
      highlights: [
        'Direct PostgreSQL and MongoDB database connectors',
        'REST API JSON payload ingestion with API key and Bearer auth',
        'Drag-and-drop CSV and Excel spreadsheet parsing'
      ],
      badge: 'Data Ingestion'
    },
    {
      step: '02',
      tag: 'CALCULATE',
      title: 'Standardize Business KPI Formulas',
      subtitle: 'Define financial metrics once and reuse them reliably across every dashboard.',
      description: 'Create standardized metrics such as Gross Profit, Gross Margin, and per-hub operational averages. Formulas evaluate programmatically and update across dashboards whenever new data is ingested.',
      highlights: [
        'Gross Profit = Invoiced Revenue - Direct COGS',
        'Gross Margin = (Gross Profit / Invoiced Revenue) × 100',
        'Gross Profit Per Hub = Gross Profit / Active Hub Count'
      ],
      badge: 'Formula Studio'
    },
    {
      step: '03',
      tag: 'ANALYZE',
      title: 'Identify Trends and Metric Variances',
      subtitle: 'Understand what factors drove changes in revenue and margin performance.',
      description: 'Break down variances between actual performance and targets by region, branch, or time horizon. Compare monthly trajectories to identify which hubs or categories contributed most to positive or negative variance.',
      highlights: [
        'Regional breakdown comparing actual vs planned revenue',
        'Factor identification across retail hubs and basket sizes',
        'Automated threshold alerts when metrics diverge from plans'
      ],
      badge: 'Variance Analysis'
    },
    {
      step: '04',
      tag: 'DECIDE',
      title: 'Share Reports and Monitor Dashboards',
      subtitle: 'Deliver scheduled executive briefs to managers and decision-makers.',
      description: 'Generate high-resolution PDF summaries and share live dashboard links with stakeholders. Control access permissions so team members see only the metrics relevant to their operational role.',
      highlights: [
        'Automated PDF summaries on scheduled cron timings',
        'Role-based permissions (Admin, Member, Viewer)',
        'Data exports in PDF, Excel, and CSV formats'
      ],
      badge: 'Executive Briefings'
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
  }, [steps.length]);

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
      className="relative bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white lg:h-[350vh] transition-colors duration-200"
    >
      {/* Pinned Viewport Container */}
      <div 
        ref={pinSectionRef} 
        className="w-full lg:h-screen flex flex-col justify-center py-16 lg:py-0 overflow-hidden relative border-t border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]"
      >
        {/* Architectural Grid & Ambient Gradient */}
        <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 dark:bg-red-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-rose-600/10 dark:bg-rose-600/15 rounded-full blur-3xl" />
        </div>

        {/* Global Progress Bar (Top of Pinned Screen) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 z-30">
          <div 
            className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-red-500 transition-all duration-150 ease-out"
            style={{ width: `${Math.max(5, scrollProgress * 100)}%` }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
          {/* Section Eyebrow Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-mono font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Step-by-Step Platform Workflow</span>
            </div>

            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-3">
              <span>Workflow Stage:</span>
              <span className="text-slate-900 dark:text-white font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                0{activeStep + 1} / 0{steps.length}
              </span>
            </div>
          </div>

          {/* Main 2-Column Split: Story Stepper (Left) vs. Interactive Mockup (Right) */}
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
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/30 scale-102'
                        : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <span>{s.step}</span>
                    <span className="hidden sm:inline opacity-80">{s.tag}</span>
                  </button>
                ))}
              </div>

              {/* Active Step Content */}
              <div className="space-y-4 min-h-[260px] flex flex-col justify-center">
                <div className="text-xs font-mono font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <span>STAGE {steps[activeStep].step}</span>
                  <span>•</span>
                  <span>{steps[activeStep].tag}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight transition-all duration-300">
                  {steps[activeStep].title}
                </h3>

                <p className="text-sm font-semibold text-rose-600 dark:text-rose-300/90 leading-snug">
                  {steps[activeStep].subtitle}
                </p>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  {steps[activeStep].description}
                </p>

                {/* Key Capability Bullet Points */}
                <div className="space-y-2 pt-2">
                  {steps[activeStep].highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
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
                  <span>Explore Guided Demo</span>
                  <ArrowRight size={14} />
                </button>

                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden sm:inline">
                  {activeStep < steps.length - 1 ? '↓ Scroll for next stage' : '✓ Full workflow completed'}
                </span>
              </div>
            </div>

            {/* ─── RIGHT COLUMN: INTERACTIVE VISUAL DISPLAY (7 COLS) ─── */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl bg-white dark:bg-slate-950 p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-500 min-h-[460px] flex flex-col justify-between text-slate-800 dark:text-slate-200">
                
                {/* Mockup Window Header Bar */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 pl-2">
                      ricoz-analytics // {steps[activeStep].tag.toLowerCase()}
                    </span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/80 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 text-[10px] font-mono font-bold">
                    {steps[activeStep].badge}
                  </span>
                </div>

                {/* ─── STAGE 01: MULTI-SOURCE INGESTION ─── */}
                {activeStep === 0 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Database size={14} className="text-red-600 dark:text-red-500" />
                        <span>Verified Business Data Connectors</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 font-bold">
                        ACTIVE INGESTION
                      </span>
                    </div>

                    {/* 4 Verified Data Source Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-slate-700 transition-colors">
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">PostgreSQL</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">Relational SQL</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Direct Connection</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-slate-700 transition-colors">
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">MongoDB</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">Document Store</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Collection Sync</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-slate-700 transition-colors">
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">REST APIs</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">JSON Endpoints</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Header &amp; Bearer</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-slate-700 transition-colors">
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">CSV &amp; JSON</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">Spreadsheets</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Drag-and-Drop</span>
                        </div>
                      </div>
                    </div>

                    {/* Dataset Ingestion Stream Preview */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <span className="font-bold text-slate-900 dark:text-white">DATASET_SCHEMA_DISCOVERY</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">AUTOMATIC TYPE INFERENCE</span>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                          <span className="truncate pr-2 font-mono">transactions.invoiced_revenue</span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">NUMERIC (INR)</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                          <span className="truncate pr-2 font-mono">supply_chain.cogs_amount</span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">NUMERIC (INR)</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                          <span className="truncate pr-2 font-mono">franchise_network.hub_code</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">VARCHAR(32)</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex items-center justify-between text-xs font-mono text-red-700 dark:text-red-200">
                      <span className="flex items-center gap-2">
                        <Zap size={15} className="text-red-600 dark:text-red-400" />
                        <span className="font-semibold">Automatic Column &amp; Relationship Detection</span>
                      </span>
                      <span className="text-slate-900 dark:text-white font-bold">Ready for Modeling</span>
                    </div>
                  </div>
                )}

                {/* ─── STAGE 02: FORMULA STUDIO (PHASE 5 REBUILD) ─── */}
                {activeStep === 1 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                      
                      {/* Header with clear validation, illustrative label and reset */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <span className="text-slate-900 dark:text-white font-bold flex items-center gap-2">
                          <Calculator size={15} className="text-red-600 dark:text-red-500" />
                          <span>Standardized KPI Calculation Engine</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFormulaInputs({ revenue: 8.42, cogs: 2.66, hubs: 48 })}
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition cursor-pointer"
                            title="Reset to default values"
                            id="formula-reset-btn"
                          >
                            <RotateCcw size={11} />
                            <span>Reset Defaults</span>
                          </button>
                          <span className="text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold">
                            Interactive Demo
                          </span>
                        </div>
                      </div>

                      {/* 1. INPUTS SECTION */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                          <span>1. Input Parameters (Editable)</span>
                          <span className="text-slate-400 font-normal">Type new values to test dynamic math</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">
                            <label htmlFor="formula-input-revenue" className="block text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-1">
                              Invoiced Revenue (₹ Cr)
                            </label>
                            <input
                              id="formula-input-revenue"
                              type="number"
                              step="0.01"
                              value={formulaInputs.revenue}
                              onChange={(e) => setFormulaInputs(prev => ({ ...prev, revenue: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 text-sm font-bold font-mono text-blue-950 dark:text-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                            <label htmlFor="formula-input-cogs" className="block text-[10px] text-amber-600 dark:text-amber-400 font-semibold mb-1">
                              Supply Chain COGS (₹ Cr)
                            </label>
                            <input
                              id="formula-input-cogs"
                              type="number"
                              step="0.01"
                              value={formulaInputs.cogs}
                              onChange={(e) => setFormulaInputs(prev => ({ ...prev, cogs: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded px-2 py-1 text-sm font-bold font-mono text-amber-950 dark:text-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                          <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900 text-purple-900 dark:text-purple-200">
                            <label htmlFor="formula-input-hubs" className="block text-[10px] text-purple-600 dark:text-purple-400 font-semibold mb-1">
                              Active Store Hubs
                            </label>
                            <input
                              id="formula-input-hubs"
                              type="number"
                              step="1"
                              min="1"
                              value={formulaInputs.hubs}
                              onChange={(e) => setFormulaInputs(prev => ({ ...prev, hubs: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded px-2 py-1 text-sm font-bold font-mono text-purple-950 dark:text-purple-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. CALCULATION FORMULAS */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          2. Mathematical Formulas (Dynamic Proof)
                        </div>
                        <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                          <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span>Gross Profit = Revenue - COGS</span>
                            <span className="font-bold text-slate-900 dark:text-white" id="formula-step-gross-profit">
                              {formulaMetrics.formatted.revenue} - {formulaMetrics.formatted.cogs} = {formulaMetrics.formatted.grossProfit}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span>Gross Margin (%) = (Gross Profit / Revenue) × 100</span>
                            <span className="font-bold text-slate-900 dark:text-white" id="formula-step-gross-margin">
                              ({formulaMetrics.formatted.grossProfit} / {formulaMetrics.formatted.revenue}) × 100 = {formulaMetrics.formatted.grossMargin}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span>Gross Profit Per Hub = Gross Profit / Active Hubs</span>
                            <span className="font-bold text-slate-900 dark:text-white" id="formula-step-per-hub">
                              {formulaMetrics.formatted.grossProfit} / {formulaMetrics.inputs.hubs} Hubs = {formulaMetrics.formatted.grossProfitPerHub}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3. COMPUTED RESULTS (PHASE 2 & 5 VERIFIED NUMBERS) */}
                      <div>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                          3. Computed Results (Verified Arithmetic)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80">
                            <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 font-sans font-semibold">
                              Gross Profit
                            </span>
                            <span className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-300" id="formula-output-gross-profit">
                              {formulaMetrics.formatted.grossProfit}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80">
                            <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 font-sans font-semibold">
                              Gross Margin
                            </span>
                            <span className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-300" id="formula-output-gross-margin">
                              {formulaMetrics.formatted.grossMargin}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80">
                            <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 font-sans font-semibold">
                              Gross Profit Per Hub
                            </span>
                            <span className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-300" id="formula-output-profit-per-hub">
                              {formulaMetrics.formatted.grossProfitPerHub}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Metric Definition & Governance Footnote */}
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-2">
                        <GitBranch size={15} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Consistent calculation across all dashboards, alerts, and report exports</span>
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Standardized Logic</span>
                    </div>
                  </div>
                )}

                {/* ─── STAGE 03: VARIANCE & TREND ANALYSIS ─── */}
                {activeStep === 2 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5">
                      <div className="flex items-center justify-between text-xs border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                          <span>Regional Performance Variance Breakdown</span>
                        </span>
                        <span className="text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold">
                          Quarterly Analysis
                        </span>
                      </div>

                      {/* Clear Diagnostic Statement */}
                      <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                        South Region recorded <strong className="text-emerald-600 dark:text-emerald-400">+28.4% Variance Surplus</strong> (₹3.82 Cr actual vs ₹2.97 Cr plan). Primary drivers identified across store hubs and order volume:
                      </p>

                      {/* Attribution Waterfall Steps */}
                      <div className="space-y-2 pt-1 font-mono text-xs">
                        {/* Baseline */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-slate-700 dark:text-slate-300 font-sans">1. Planned Revenue Target</span>
                          <span className="text-slate-700 dark:text-slate-300 font-bold">₹2.97 Cr (Plan)</span>
                        </div>

                        {/* Positive Delta 1 */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                          <span className="text-emerald-800 dark:text-emerald-200 font-sans">+ Store Hub Volume Expansion</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">+₹0.52 Cr (+17.5%)</span>
                        </div>

                        {/* Positive Delta 2 */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                          <span className="text-emerald-800 dark:text-emerald-200 font-sans">+ Average Basket Size Growth</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">+₹0.33 Cr (+11.1%)</span>
                        </div>

                        {/* Final Actual */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-emerald-500 dark:border-emerald-800 font-bold">
                          <span className="text-slate-900 dark:text-white font-sans">= Actual Invoiced Revenue</span>
                          <span className="text-emerald-600 dark:text-emerald-400 text-sm">₹3.82 Cr (+28.4% Surplus)</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 font-mono">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Actionable Insight Generated:</span>
                      </span>
                      <span className="text-slate-900 dark:text-white font-bold">Allocate 15% inventory safety buffer for South Region</span>
                    </div>
                  </div>
                )}

                {/* ─── STAGE 04: EXECUTIVE REPORT DISPATCH ─── */}
                {activeStep === 3 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5">
                      <div className="flex items-center justify-between text-xs border-b border-slate-200 dark:border-slate-800 pb-2.5">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <FileText size={14} className="text-red-600 dark:text-red-500" />
                          <span>Scheduled Executive Briefings</span>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-mono font-bold">
                          SCHEDULED DISPATCH
                        </span>
                      </div>

                      {/* Brief Card Preview */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs font-sans">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">Weekly Leadership Performance Digest</div>
                          <span className="text-[10px] font-mono bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 font-bold">
                            INTERNAL BRIEF
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Automated PDF briefings compiled and sent directly to operational managers and team stakeholders via email.
                        </p>
                        
                        <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-center">
                          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Total Invoiced</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">₹8.42 Cr</div>
                          </div>
                          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Gross Margin</div>
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">68.4%</div>
                          </div>
                          <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Hub Count</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">48 Hubs</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-xs pt-1 font-mono">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 font-sans text-xs">Role Permissions</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Admin, Member, Viewer</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 font-sans text-xs">Export Formats</span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold">PDF, Excel, CSV</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex items-center justify-between text-xs text-red-700 dark:text-red-200 font-mono">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={15} className="text-red-600 dark:text-red-400" />
                        <span className="font-semibold">Tenant Data Scoped to Your Organization</span>
                      </span>
                      <span className="text-slate-900 dark:text-white font-bold">Protected Access</span>
                    </div>
                  </div>
                )}

                {/* Bottom Interactive Mockup Footer Controls */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>STAGE: 0{activeStep + 1} / 0{steps.length}</span>
                  <div className="flex items-center gap-1.5">
                    {steps.map((_, i) => (
                      <span 
                        key={i} 
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          activeStep === i ? 'bg-red-600 w-5' : 'bg-slate-300 dark:bg-slate-700'
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
