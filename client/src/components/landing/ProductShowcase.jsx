import React, { useState, useRef } from 'react';
import { 
  BarChart3, 
  Sliders, 
  Database, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  Download, 
  Clock, 
  ShieldCheck,
  Zap,
  Cpu,
  Share2,
  Table as TableIcon,
  Maximize2
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProductShowcase({ onOpenDemo }) {
  const [activeTab, setActiveTab] = useState(0);
  const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseTilt({ x: -y * 8, y: x * 8 });
  };

  const handleMouseLeave = () => {
    setMouseTilt({ x: 0, y: 0 });
  };

  const showcaseTabs = [
    {
      id: 'cockpit',
      label: 'Executive Cockpit',
      icon: BarChart3,
      tagline: 'Instant Leadership Clarity Across All Franchise Hubs',
      description: 'Consolidate multi-branch revenue streams, gross margin pacing, and regional store performance into a single unified cockpit that renders in sub-second time.',
      highlights: [
        'Real-time revenue pacing against quarterly board targets',
        'Multi-branch franchise rollups with one-click drilldowns',
        'Sub-second query caching with zero data pipeline latency'
      ],
      previewTitle: 'Ricoz Enterprise Executive Cockpit',
      badge: 'Real-time Streaming',
      badgeColor: 'emerald',
      renderGraphic: () => (
        <div className="space-y-4">
          {/* Top KPI Metric Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/40 transition-colors">
              <div className="text-[10px] text-slate-400 font-medium">Net Revenue (Q3)</div>
              <div className="text-lg font-black text-white font-mono mt-0.5">₹8,42,80,000</div>
              <div className="text-[9px] font-bold text-emerald-400 mt-0.5">+24.8% vs FY25</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/40 transition-colors">
              <div className="text-[10px] text-slate-400 font-medium">Operating Margin</div>
              <div className="text-lg font-black text-white font-mono mt-0.5">68.4%</div>
              <div className="text-[9px] font-bold text-emerald-400 mt-0.5">Target &gt;65% Met</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/40 transition-colors">
              <div className="text-[10px] text-slate-400 font-medium">Active Franchises</div>
              <div className="text-lg font-black text-white font-mono mt-0.5">48 Hubs</div>
              <div className="text-[9px] font-bold text-emerald-400 mt-0.5">100% Operational</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/40 transition-colors">
              <div className="text-[10px] text-slate-400 font-medium">Query Latency</div>
              <div className="text-lg font-black text-white font-mono mt-0.5">142 ms</div>
              <div className="text-[9px] font-bold text-emerald-400 mt-0.5">Sub-second P99</div>
            </div>
          </div>

          {/* Miniature Trajectory Graphic with Interactive Hover */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-bold text-slate-200">Revenue Trajectory vs Baseline Target (H1 FY26)</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">+₹92.8L Surplus</span>
            </div>
            <div className="h-28 flex items-end justify-between gap-2 px-2 pt-2">
              {[
                { m: 'Jan', val: 42, t: 38 },
                { m: 'Feb', val: 58, t: 50 },
                { m: 'Mar', val: 72, t: 65 },
                { m: 'Apr', val: 89, t: 78 },
                { m: 'May', val: 94, t: 85 },
                { m: 'Jun', val: 118, t: 100 },
              ].map((pt) => (
                <div key={pt.m} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer">
                  <div className="w-full flex items-end justify-center gap-1 h-20">
                    <div className="w-3 bg-slate-700 rounded-t" style={{ height: `${(pt.t / 125) * 100}%` }} title={`Target: ₹${pt.t}L`} />
                    <div className="w-3 bg-red-600 rounded-t shadow-sm shadow-red-600/50 group-hover:bg-rose-400 group-hover:scale-110 transition-all" style={{ height: `${(pt.val / 125) * 100}%` }} title={`Actual: ₹${pt.val}L`} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono group-hover:text-red-400 transition-colors">{pt.m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regional Table Row */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-300">South Region (HQ &amp; 48 Hubs): ₹3.82 Cr (109% of Target)</span>
            <span className="text-emerald-400 font-bold">+28.4% YoY</span>
          </div>
        </div>
      )
    },
    {
      id: 'formula',
      label: 'KPI Formula Studio',
      icon: Sliders,
      tagline: 'Define Business Metrics Without Touching SQL or Python',
      description: 'Build formulaic enterprise metrics with mathematical syntax validation, variance targets, and automated status thresholds (Healthy, Warning, Critical).',
      highlights: [
        'Compose mathematical formulas with interactive metric tokens',
        'Configure tolerance thresholds and automated anomaly floors',
        'Inherit dimensional filters (Store, Region, Category) automatically'
      ],
      previewTitle: 'Ricoz Dynamic Metric Studio',
      badge: 'Zero-Code Formula Compiler',
      badgeColor: 'amber',
      renderGraphic: () => (
        <div className="space-y-4 font-mono text-xs">
          {/* Formula Builder Mockup */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              Active Formula Definition: [EBITDA_MARGIN_PCT]
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-red-950 text-red-300 border border-red-800">[Net Invoiced Sales]</span>
              <span className="text-slate-400">-</span>
              <span className="px-2 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800">[Cost of Goods Sold]</span>
              <span className="text-slate-400">-</span>
              <span className="px-2 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800">[Operating OpEx]</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} /> Formula syntax valid &amp; verified
              </span>
              <span>Evaluated in 1.4 ms</span>
            </div>
          </div>

          {/* Tolerance Thresholds */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              Automated Status Thresholds
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-emerald-900/40 text-emerald-400">
                <span>Healthy Status (&gt; 65.0% Margin)</span>
                <span className="font-bold">Current: 68.4% (Healthy)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-amber-900/40 text-amber-400">
                <span>Warning Floor (55.0% - 65.0%)</span>
                <span>Automatic Slack Alert</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-rose-900/40 text-rose-400">
                <span>Critical Incident (&lt; 55.0%)</span>
                <span>P1 Incident Dispatch</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'modeling',
      label: 'Relational Schema Modeler',
      icon: Database,
      tagline: 'Automatic Entity-Relationship Discovery & Type Normalization',
      description: 'Visualize cross-table foreign key links, detect schema drifts, and validate data quality across thousands of tables without building manual data pipelines.',
      highlights: [
        'Automatic primary & foreign key relationship inference',
        'Continuous data profiling and null-value leakage detection',
        'Lineage tracking from source database to executive dashboard widget'
      ],
      previewTitle: 'Data Lineage & Relational Mapper',
      badge: 'Active Relational Graph',
      badgeColor: 'sky',
      renderGraphic: () => (
        <div className="space-y-3 font-mono text-xs">
          {/* Table Schema Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-white font-bold">orders_fact</span>
                <span className="text-[10px] text-emerald-400">1,420,890 rows</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between"><span>order_id (PK)</span><span className="text-slate-500">uuid</span></div>
                <div className="flex justify-between text-blue-400"><span>customer_id (FK)</span><span>uuid</span></div>
                <div className="flex justify-between text-purple-400"><span>branch_id (FK)</span><span>int4</span></div>
                <div className="flex justify-between"><span>gross_amount</span><span className="text-slate-500">numeric</span></div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-white font-bold">franchise_branches</span>
                <span className="text-[10px] text-emerald-400">48 Hubs</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between text-purple-400"><span>branch_id (PK)</span><span>int4</span></div>
                <div className="flex justify-between"><span>branch_name</span><span className="text-slate-500">varchar</span></div>
                <div className="flex justify-between"><span>region_code</span><span className="text-slate-500">varchar</span></div>
                <div className="flex justify-between"><span>target_arr</span><span className="text-slate-500">numeric</span></div>
              </div>
            </div>
          </div>

          {/* Lineage Mapping Bar */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-slate-300">FK Relation Verified: orders_fact.branch_id ➔ franchise_branches.branch_id</span>
            </div>
            <span className="text-emerald-400 font-bold">100% Integrity</span>
          </div>
        </div>
      )
    },
    {
      id: 'reports',
      label: 'Scheduled Briefing Studio',
      icon: FileText,
      tagline: 'Automated Executive PDF Reports Dispatched on Cron',
      description: 'Eliminate manual Monday morning slide-deck preparation. Configure cron schedules to compile beautiful, branded PDF digests with executive KPIs and charts.',
      highlights: [
        'Automated Monday morning PDF executive briefing dispatches',
        'Corporate branded headers, footers, and executive commentary',
        'Multi-format export: PDF, XLSX workbook, and raw CSV'
      ],
      previewTitle: 'Automated Briefing Scheduler',
      badge: 'Cron Automation Active',
      badgeColor: 'purple',
      renderGraphic: () => (
        <div className="space-y-4 text-xs">
          {/* Cron Job Specification */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-purple-400" />
                <span className="text-white font-bold">CRON SCHEDULE: 0 8 * * 1 (Every Monday 08:00 AM IST)</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                Active Schedule
              </span>
            </div>

            {/* Document Preview Box */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-12 rounded bg-red-600 text-white flex flex-col items-center justify-center font-bold text-[10px] shadow-sm">
                  <span>PDF</span>
                  <span className="text-[8px] font-normal">v2.4</span>
                </div>
                <div>
                  <div className="font-bold text-white text-xs">Q3-Enterprise-Revenue-Report-Upgraded.pdf</div>
                  <div className="text-[10px] text-slate-400">14 recipients (Board &amp; Regional VPs) • 66.7 KB</div>
                </div>
              </div>
              <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                <Download size={13} /> Ready
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1">
              <div>Next run: Monday at 08:00 AM IST</div>
              <div className="text-right text-emerald-400">Delivery status: 100% SLA Met</div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentTab = showcaseTabs[activeTab];

  return (
    <section 
      id="product" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800"
      style={{ perspective: '1400px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <Layers size={14} className="text-red-600 dark:text-red-400" />
            <span>Platform Capabilities Showcase</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            One Sovereign Platform.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Complete Operational Visibility.
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Explore how RicozAnalytics bridges the gap between complex database infrastructure and executive boardroom decision-making.
          </p>

          {/* Interactive Showcase Tabs with spring active pill */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {showcaseTabs.map((tab, idx) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                    activeTab === idx
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <TabIcon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3D Interactive Showcase Stage Frame */}
        <div 
          className="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden transition-transform duration-300 ease-out"
          style={{
            transform: `rotateX(${mouseTilt.x.toFixed(2)}deg) rotateY(${mouseTilt.y.toFixed(2)}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
        >
          {/* Top Window Bar */}
          <div 
            className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between"
            style={{ transform: 'translateZ(15px)' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-3 text-xs font-mono text-slate-400">ricoz.app/workspace/{currentTab.id}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">{currentTab.badge}</span>
            </div>
          </div>

          {/* Main Stage Grid with 3D Depth */}
          <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center" style={{ transformStyle: 'preserve-3d' }}>
            {/* Left Info Column (5 cols) */}
            <div className="lg:col-span-5 space-y-5" style={{ transform: 'translateZ(25px)' }}>
              <div className="inline-block text-[11px] font-mono font-bold uppercase tracking-wider text-red-400 bg-red-950/60 px-3 py-1 rounded-md border border-red-900/60">
                Pillar {activeTab + 1} of {showcaseTabs.length} • Illustrative Dataset
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                {currentTab.tagline}
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed">
                {currentTab.description}
              </p>

              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-slate-200">
                {currentTab.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4 flex flex-wrap items-center gap-3">
                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-red-600/30 transition-all inline-flex items-center gap-2 cursor-pointer hover:scale-105"
                >
                  <span>Test in Free Workspace</span>
                  <ArrowRight size={14} />
                </Link>
                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Schedule Walkthrough
                </button>
              </div>
            </div>

            {/* Right Interactive Graphic Container (7 cols) with Layer Elevation */}
            <div 
              className="lg:col-span-7 bg-slate-950/70 rounded-2xl p-5 sm:p-6 border border-slate-800/80 shadow-2xl transition-all duration-300"
              style={{ transform: 'translateZ(40px)' }}
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs">
                <span className="font-bold text-slate-200 font-mono">{currentTab.previewTitle}</span>
                <span className="text-[10px] text-slate-400 font-mono">Live Interactive Mockup</span>
              </div>

              {/* Render Tab Specific Graphic */}
              {currentTab.renderGraphic()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
