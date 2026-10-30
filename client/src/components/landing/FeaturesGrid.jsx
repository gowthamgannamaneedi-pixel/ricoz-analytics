import React from 'react';
import { 
  Database, 
  BarChart3, 
  Zap, 
  FileSpreadsheet, 
  BellRing, 
  Sparkles, 
  CheckCircle, 
  ArrowRight,
  Sliders,
  Share2,
  LineChart,
  Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInView } from './useScrollAnimation';

export default function FeaturesGrid() {
  const [gridRef, gridInView] = useInView({ threshold: 0.15 });

  const features = [
    {
      icon: Database,
      badge: 'Data Management & Ingestion',
      title: 'Unified Multi-Source Data Lake',
      description:
        'Connect PostgreSQL, MySQL, REST APIs, CSV uploads, Snowflake, and Google Sheets into a consolidated sovereign warehouse with schema auto-inference.',
      highlights: [
        'Automated schema discovery & data type validation',
        'Real-time streaming & scheduled micro-batching',
        'Relational data modeling & cross-table foreign key linking'
      ],
      linkText: 'Explore Data Sources',
      linkUrl: '/login',
      delayClass: 'rz-delay-100',
      productVisual: (
        <div className="w-full h-32 mb-5 p-3 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Ingestion Gateway
            </span>
            <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              Auto-Inference Active
            </span>
          </div>
          <div className="relative h-16 w-full flex items-center justify-between px-1">
            <div className="flex flex-col gap-1.5 z-10">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-700/80 text-[10px] font-mono text-slate-200 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                PostgreSQL
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-700/80 text-[10px] font-mono text-slate-200 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Snowflake
              </div>
            </div>
            <div className="flex-1 mx-2 relative h-10">
              <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                <path d="M 0,10 C 40,10 60,20 100,20" fill="none" stroke="#DC2626" strokeWidth="2" strokeDasharray="4 4" className="rz-anim-flow" />
                <path d="M 0,30 C 40,30 60,20 100,20" fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" className="rz-anim-flow" />
                <circle cx="50" cy="15" r="2.5" fill="#DC2626" className="animate-pulse" />
                <circle cx="50" cy="25" r="2.5" fill="#10B981" className="animate-pulse" />
              </svg>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gradient-to-br from-red-950/90 to-slate-900 border border-red-700/60 text-center z-10 shadow-md">
              <div className="text-[10px] font-bold text-white font-mono">SOVEREIGN LAKE</div>
              <div className="text-[8.5px] font-mono text-red-300">1.2M rows/hr</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-900">
            <span>Relational FK Discovery</span>
            <span className="text-emerald-400">Zero Data Drops</span>
          </div>
        </div>
      )
    },
    {
      icon: Sliders,
      badge: 'Metrics & Performance',
      title: 'Dynamic KPI & Goal Tracking Engine',
      description:
        'Define formulaic enterprise KPIs, assign performance targets, calculate variances, and monitor department scorecards without writing SQL.',
      highlights: [
        'Custom metric formulas (e.g., Target vs Actuals, ROI, CAGR)',
        'Automated status grading (Healthy, Warning, Critical)',
        'Hierarchical grouping by Franchise, Region, or Department'
      ],
      linkText: 'Explore KPI Studio',
      linkUrl: '/login',
      delayClass: 'rz-delay-150',
      productVisual: (
        <div className="w-full h-32 mb-5 p-3 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Sliders size={12} className="text-red-400" />
              Formula Studio
            </span>
            <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              112% Achieved
            </span>
          </div>
          <div className="bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between text-[10.5px] font-mono">
            <span className="text-red-400 font-bold">[EBITDA]</span>
            <span className="text-slate-500">=</span>
            <span className="text-slate-300">[Gross Margin]</span>
            <span className="text-slate-500">-</span>
            <span className="text-amber-400">[Operating Cost]</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>Target: ₹7.50 Cr</span>
              <span className="text-white font-bold">Actual: ₹8.43 Cr</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-emerald-500 rounded-full w-[88%] shadow-xs" />
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-900">
            <span>Status: HEALTHY</span>
            <span className="text-emerald-400">+₹92.8L Variance Surplus</span>
          </div>
        </div>
      )
    },
    {
      icon: BarChart3,
      badge: 'Visualization & Cockpits',
      title: 'Interactive Visual Dashboards',
      description:
        'Build customizable analytical dashboards with drag-and-drop charts, multi-dimensional filter bars, and responsive layouts designed for decision makers.',
      highlights: [
        '20+ chart variations (Area, Multi-Bar, Donut, Heatmaps)',
        'Interactive drilldowns and cross-filtering',
        'Role-customized views for executives vs store managers'
      ],
      linkText: 'Explore Dashboards',
      linkUrl: '/login',
      delayClass: 'rz-delay-200',
      productVisual: (
        <div className="w-full h-32 mb-5 p-3 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <BarChart3 size={12} className="text-red-400" />
              Cockpit Grid View
            </span>
            <span className="text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40 text-[9px]">
              Interactive Drilldown
            </span>
          </div>
          <div className="flex items-end justify-between gap-2 h-16 px-2">
            <div className="flex-1 flex items-end gap-1.5 h-full">
              <div className="flex-1 bg-slate-800 hover:bg-red-600/80 rounded-t-sm h-[40%] transition-all" />
              <div className="flex-1 bg-red-600 rounded-t-sm h-[65%] transition-all" />
              <div className="flex-1 bg-slate-800 hover:bg-red-600/80 rounded-t-sm h-[50%] transition-all" />
              <div className="flex-1 bg-rose-500 rounded-t-sm h-[85%] transition-all" />
              <div className="flex-1 bg-emerald-500 rounded-t-sm h-[100%] transition-all" />
            </div>
            <div className="w-14 h-14 -rotate-90 flex-shrink-0 flex items-center justify-center relative">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#1E293B" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#DC2626" strokeWidth="3.5" strokeDasharray="88" strokeDashoffset="28" strokeLinecap="round" />
              </svg>
              <span className="absolute rotate-90 text-[9px] font-mono text-white font-bold">68%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-900">
            <span>Multi-Series Area & Bar</span>
            <span className="text-slate-300">Cross-Metric Filtering</span>
          </div>
        </div>
      )
    },
    {
      icon: FileSpreadsheet,
      badge: 'Reports & Exports',
      title: 'Automated Reports & Scheduled Delivery',
      description:
        'Configure cron schedules to automatically compile pixel-perfect executive PDF summaries and formatted Excel workbooks delivered right to your inbox.',
      highlights: [
        'Scheduled daily, weekly, and monthly email dispatches',
        'Comprehensive PDF reports with corporate branding',
        'Raw data export in CSV, XLSX, and JSON formats'
      ],
      linkText: 'Explore Automated Reports',
      linkUrl: '/login',
      delayClass: 'rz-delay-250',
      productVisual: (
        <div className="w-full h-32 mb-5 p-3 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <FileSpreadsheet size={12} className="text-red-400" />
              Executive Briefing Engine
            </span>
            <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 text-[9px]">
              Cron Active
            </span>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
            <div className="w-9 h-11 bg-red-600/20 border border-red-500/40 rounded flex flex-col items-center justify-center flex-shrink-0 text-red-400 font-mono font-bold text-[9px]">
              PDF
              <div className="w-5 h-0.5 bg-red-400 mt-1 opacity-60" />
              <div className="w-3 h-0.5 bg-red-400 mt-0.5 opacity-60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-slate-200 truncate font-mono">Weekly_Board_Digest.pdf</div>
              <div className="text-[9.5px] font-mono text-slate-400">Schedule: Every Mon 09:00 AM IST</div>
              <div className="text-[8.5px] font-mono text-emerald-400 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Delivered to 14 Stakeholders
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-900">
            <span>Formats: PDF, XLSX, CSV</span>
            <span className="text-slate-300">Corporate Branding</span>
          </div>
        </div>
      )
    },
    {
      icon: BellRing,
      badge: 'Incidents & Real-Time Monitoring',
      title: 'Proactive Alerting & SLA Safeguards',
      description:
        'Eliminate blind spots with instant automated alerts triggered when key business metrics, margins, or branch thresholds drop below tolerance.',
      highlights: [
        'Multi-condition threshold evaluation rules',
        'Multi-channel dispatch (Email, Slack, Webhooks, In-App)',
        'Incident tracking with root-cause diagnostic drawer'
      ],
      linkText: 'Explore Alert Systems',
      linkUrl: '/login',
      delayClass: 'rz-delay-300',
      productVisual: (
        <div className="w-full h-32 mb-5 p-3 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-rose-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Incident Sentinel
            </span>
            <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40 text-[9px]">
              P1 Alert Active
            </span>
          </div>
          <div className="relative h-12 w-full">
            <svg className="w-full h-full" viewBox="0 0 200 48" preserveAspectRatio="none">
              <line x1="0" y1="36" x2="200" y2="36" stroke="#EF4444" strokeWidth="1" strokeDasharray="3 3" />
              <path d="M 0,16 Q 40,14 80,18 T 130,16 L 150,38 L 170,20 T 200,18" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
              <circle cx="150" cy="38" r="8" fill="none" stroke="#EF4444" strokeWidth="1" className="rz-anim-pulse" />
              <circle cx="150" cy="38" r="3" fill="#EF4444" />
            </svg>
            <div className="absolute right-2 top-0 bg-rose-950/90 text-rose-300 text-[9px] font-mono px-2 py-0.5 rounded border border-rose-700/60 font-bold">
              -18.2% Tolerance Breach
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-900">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Dispatched: Slack &bull; Email &bull; Webhook
            </span>
            <span className="text-amber-400">Root Cause Ready</span>
          </div>
        </div>
      )
    },
    {
      icon: Sparkles,
      badge: 'Predictive Intelligence',
      title: 'AI Analytics Copilot & Forecasts',
      description:
        'Leverage embedded machine learning to project upcoming revenue trajectories, identify anomalies before they impact EBITDA, and ask questions in plain English.',
      highlights: [
        'Automated time-series regression & seasonality forecasting',
        'Root-cause anomaly detection across high-volume datasets',
        'Natural language business query conversational assistant'
      ],
      linkText: 'Explore AI Assistant',
      linkUrl: '/login',
      delayClass: 'rz-delay-350',
      productVisual: (
        <div className="w-full h-32 mb-5 p-3 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Sparkles size={12} className="text-red-400" />
              Copilot Intelligence
            </span>
            <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 text-[9px]">
              96.4% Confidence
            </span>
          </div>
          <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
            <div className="text-[10px] font-mono text-slate-300 truncate">
              <span className="text-red-400 font-bold">Ask AI:</span> &ldquo;Why did South region surge +24.8%?&rdquo;
            </div>
            <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 text-[8.5px] font-mono border border-red-800/50 flex-shrink-0">
              R&sup2; 98.8%
            </span>
          </div>
          <div className="relative h-6 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 200 24" preserveAspectRatio="none">
              <path d="M 0,20 Q 50,18 100,12 T 150,8 T 200,2" fill="none" stroke="#DC2626" strokeWidth="2" className="rz-anim-dash" />
              <path d="M 0,22 Q 50,20 100,15 T 150,12 T 200,6" fill="none" stroke="#64748B" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx="200" cy="2" r="3" fill="#DC2626" />
            </svg>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-900">
            <span>Time-Series Regression</span>
            <span className="text-emerald-400">Natural Language Insights</span>
          </div>
        </div>
      )
    },
  ];

  return (
    <section 
      ref={gridRef}
      id="features" 
      className="py-20 lg:py-28 bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`max-w-3xl mx-auto text-center space-y-4 mb-16 rz-reveal ${gridInView ? 'is-revealed' : ''}`}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-100/70 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wider">
            Why RicozAnalytics
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Enterprise Architecture Built for Modern Decision Velocity
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            From raw transaction ingestion to automated leadership briefings, RicozAnalytics handles every tier of your modern business intelligence lifecycle.
          </p>
        </div>

        {/* 6 Core Cards Grid with Staggered Scroll Reveal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`group bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-2xl hover:border-red-400 dark:hover:border-red-800 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between rz-reveal ${feature.delayClass} ${
                gridInView ? 'is-revealed' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-13 h-13 p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors duration-300 shadow-xs">
                    <feature.icon size={26} />
                  </div>
                  <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-md uppercase tracking-wider border border-red-100 dark:border-red-900/50">
                    {feature.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  {feature.title}
                </h3>

                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  {feature.description}
                </p>

                {/* Zoho-inspired Substantial Product Visualization Stage */}
                {feature.productVisual}

                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 mb-6">
                  {feature.highlights.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <CheckCircle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                to={feature.linkUrl}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 group-hover:translate-x-1 transition-transform"
              >
                <span>{feature.linkText}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
