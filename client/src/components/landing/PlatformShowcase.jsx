import React, { useState } from 'react';
import { 
  Database, 
  Layers, 
  BarChart3, 
  Sliders, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  AlertCircle,
  Sparkles,
  Zap,
  Activity,
  GitBranch,
  Table,
  Check,
  ShieldCheck,
  PieChart
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInView } from './useScrollAnimation';

export default function PlatformShowcase({ onOpenDemo }) {
  const [selectedPillar, setSelectedPillar] = useState(0);
  const [sectionRef, inView] = useInView({ threshold: 0.15 });

  const pillars = [
    {
      step: '01',
      title: 'Connect & Model Data in Minutes',
      tagline: 'Zero Complex ETL Overhead',
      desc: 'Seamlessly ingest SQL tables, cloud storage, spreadsheets, and Webhook feeds. Automatic type inference builds clean relational data models instantly.',
      icon: Database,
      delayClass: 'rz-delay-100',
      details: [
        'Supports PostgreSQL, MySQL, Supabase, Snowflake, CSV & REST',
        'Automatic primary & foreign key relationship mapper',
        'Data profiling & automatic null-value cleansing alerts'
      ],
      previewContent: {
        title: 'Data Ingestion & Relationship Modeler',
        badge: 'ACTIVE SCHEMA',
        badgeColor: 'emerald',
        items: [
          { name: 'orders_fact_table', rows: '1,420,890 rows', status: 'Synced', rate: '120 req/s' },
          { name: 'customers_dimension', rows: '240,500 rows', status: 'Synced', rate: 'Live Stream' },
          { name: 'franchise_branches', rows: '48 hubs', status: 'Synced', rate: 'Healthy' },
          { name: 'inventory_ledger', rows: '650,200 rows', status: 'Syncing', rate: '98% complete' },
        ]
      }
    },
    {
      step: '02',
      title: 'Build Drag-and-Drop Interactive Dashboards',
      tagline: 'Pixel-Perfect Visual Cockpits',
      desc: 'Assemble intuitive executive cockpits with customizable metric widgets, multi-series time-charts, funnel analysis, and cross-metric filtering.',
      icon: BarChart3,
      delayClass: 'rz-delay-200',
      details: [
        'Dynamic multi-column grid with responsive sizing',
        'Global date range and regional franchise filter bars',
        'Real-time automated polling and instant export capabilities'
      ],
      previewContent: {
        title: 'Executive Financial & KPI Dashboard',
        badge: 'INTERACTIVE VIEW',
        badgeColor: 'red',
        items: [
          { name: 'Gross Revenue Target Widget', rows: '₹8.42 Cr (+18%)', status: 'On Target', rate: 'Monthly' },
          { name: 'Regional Variance Matrix', rows: '4 Zones Reporting', status: 'Active', rate: 'Real-time' },
          { name: 'Top 10 Fast-Moving SKUs', rows: '94.2% In Stock', status: 'Healthy', rate: 'Live Feed' },
          { name: 'Customer Retention Rate', rows: '78.4% (QoQ +4%)', status: 'Strong', rate: 'Daily' },
        ]
      }
    },
    {
      step: '03',
      title: 'AI Anomaly Detection & Proactive Incident Alerts',
      tagline: 'Automated 24/7 Intelligence',
      desc: 'Never miss a revenue dip or operational bottleneck. The embedded AI engine continuously tracks threshold breaches and sends instant notifications.',
      icon: Sparkles,
      delayClass: 'rz-delay-300',
      details: [
        'Custom multi-condition alert rules with variance thresholds',
        'Instant notifications via Slack, Email, and Webhooks',
        'Automated root-cause diagnostic drawer with recommended actions'
      ],
      previewContent: {
        title: 'Incident Monitor & AI Root-Cause Diagnostic',
        badge: 'AUTONOMOUS AGENT',
        badgeColor: 'blue',
        items: [
          { name: 'Incident #402: Branch #12 Revenue Dip', rows: 'Variance -18.2%', status: 'Investigating', rate: 'P1 Urgent' },
          { name: 'Anomaly #401: Order Spike South Hub', rows: '+44% vs baseline', status: 'Resolved', rate: 'Handled' },
          { name: 'Scheduled: Weekly Executive Briefing', rows: 'PDF & Excel export', status: 'Ready', rate: 'Mondays 9 AM' },
          { name: 'AI Forecast Model Training', rows: '98.8% R² score', status: 'Up to Date', rate: 'Continuous' },
        ]
      }
    }
  ];

  const current = pillars[selectedPillar];

  return (
    <section 
      ref={sectionRef}
      id="dashboards" 
      className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] border-b border-slate-200 dark:border-slate-800 transition-colors duration-200 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`max-w-3xl mx-auto text-center space-y-4 mb-16 rz-reveal ${inView ? 'is-revealed' : ''}`}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wider">
            One Unified Platform
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Complete Visibility Across Your Entire Operation
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Eliminate silos between engineering, data analysts, and executive leadership with an integrated workspace.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Interactive Selector Cards with Staggered Scroll Reveal */}
          <div className="lg:col-span-5 space-y-4">
            {pillars.map((pillar, idx) => {
              const isSelected = selectedPillar === idx;
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.step}
                  onClick={() => setSelectedPillar(idx)}
                  className={`cursor-pointer rounded-2xl p-5 sm:p-6 transition-all duration-300 border text-left rz-reveal ${pillar.delayClass} ${
                    inView ? 'is-revealed' : ''
                  } ${
                    isSelected
                      ? 'bg-red-50/70 dark:bg-red-950/30 border-red-500 shadow-lg ring-1 ring-red-500/30 -translate-y-0.5'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-all ${
                        isSelected
                          ? 'bg-red-600 text-white shadow-md shadow-red-500/30 scale-105'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {pillar.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-red-700 dark:text-red-400' : 'text-slate-400'}`}>
                          {pillar.tagline}
                        </span>
                      </div>
                      <h3 className={`text-base font-bold mb-1.5 ${isSelected ? 'text-slate-950 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                        {pillar.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {pillar.desc}
                      </p>

                      {isSelected && (
                        <div className="mt-4 pt-3 border-t border-red-200/60 dark:border-red-900/40 space-y-2 animate-fadeIn">
                          {pillar.details.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium">
                              <CheckCircle2 size={13} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                              <span>{d}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Dynamic Preview Mockup Container with Zoho-Inspired Analytics Graphics */}
          <div className={`lg:col-span-7 rz-reveal-scale rz-delay-250 ${inView ? 'is-revealed' : ''}`}>
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-7 shadow-2xl text-white">
              {/* Top Window Bar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center shadow-xs">
                    <current.icon size={22} />
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-bold text-white">{current.previewContent.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Stage: {current.step} — Live Environment</div>
                  </div>
                </div>

                <span className="px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-950 border border-red-700/50 text-red-400 shadow-xs">
                  {current.previewContent.badge}
                </span>
              </div>

              {/* Dynamic Analytics Visual Illustration for Active Pillar (Large Scale, Zoho Inspired) */}
              <div className="mb-5 p-4 sm:p-5 bg-slate-950/90 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative">
                {selectedPillar === 0 && (
                  /* Pillar 01: Relational Schema & Ingestion Flow Visual */
                  <div className="space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono flex items-center gap-1.5 font-semibold text-slate-300">
                        <GitBranch size={14} className="text-red-400" />
                        Relational Foreign Key Topology
                      </span>
                      <span className="text-emerald-400 font-mono text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                        120 req/s Streaming
                      </span>
                    </div>

                    <div className="relative h-44 sm:h-48 w-full">
                      <svg className="w-full h-full" viewBox="0 0 540 160">
                        <defs>
                          <linearGradient id="schemaFactGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1E293B" />
                            <stop offset="100%" stopColor="#0F172A" />
                          </linearGradient>
                        </defs>
                        {/* Central Fact Node */}
                        <rect x="185" y="45" width="170" height="66" rx="10" fill="url(#schemaFactGrad)" stroke="#DC2626" strokeWidth="2.5" />
                        <rect x="185" y="45" width="170" height="20" rx="10" fill="#DC2626" fillOpacity="0.2" />
                        <text x="270" y="60" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">
                          orders_fact_table
                        </text>
                        <text x="270" y="82" fill="#F87171" fontSize="10.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                          1,420,890 records
                        </text>
                        <text x="270" y="100" fill="#94A3B8" fontSize="8.5" fontFamily="monospace" textAnchor="middle">
                          PRIMARY KEY: order_id
                        </text>

                        {/* Customer Dimension Node Left */}
                        <rect x="10" y="15" width="135" height="50" rx="8" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
                        <text x="77" y="35" fill="#E2E8F0" fontSize="11" fontWeight="600" textAnchor="middle">customers_dim</text>
                        <text x="77" y="52" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">240,500 rows</text>

                        {/* Branch Hubs Node Left Bottom */}
                        <rect x="10" y="90" width="135" height="50" rx="8" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
                        <text x="77" y="110" fill="#E2E8F0" fontSize="11" fontWeight="600" textAnchor="middle">franchise_branches</text>
                        <text x="77" y="127" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">48 regional hubs</text>

                        {/* Inventory Ledger Node Right */}
                        <rect x="395" y="52" width="135" height="50" rx="8" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
                        <text x="462" y="72" fill="#E2E8F0" fontSize="11" fontWeight="600" textAnchor="middle">inventory_ledger</text>
                        <text x="462" y="89" fill="#94A3B8" fontSize="9" fontFamily="monospace" textAnchor="middle">650,200 rows</text>

                        {/* Animated Bezier Connectors with Streaming Dashes */}
                        <path d="M 145,40 C 165,40 165,70 185,70" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="5 5" className="rz-anim-flow" />
                        <path d="M 145,115 C 165,115 165,85 185,85" fill="none" stroke="#10B981" strokeWidth="2.5" strokeDasharray="5 5" className="rz-anim-flow" />
                        <path d="M 355,78 L 395,78" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="5 5" className="rz-anim-flow" />

                        {/* Glowing packet circles */}
                        <circle cx="165" cy="55" r="3.5" fill="#EF4444" className="animate-pulse" />
                        <circle cx="165" cy="100" r="3.5" fill="#10B981" className="animate-pulse" />
                        <circle cx="375" cy="78" r="3.5" fill="#F59E0B" className="animate-pulse" />
                      </svg>
                    </div>
                  </div>
                )}

                {selectedPillar === 1 && (
                  /* Pillar 02: Interactive Visual Cockpit Preview */
                  <div className="space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono flex items-center gap-1.5 font-semibold text-slate-300">
                        <BarChart3 size={14} className="text-red-400" />
                        Executive Cockpit Layout Preview
                      </span>
                      <span className="text-red-400 font-mono text-[10px] bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40">
                        Live Auto-Refresh
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 h-44 sm:h-48 items-center">
                      {/* Mini Revenue Curve Widget */}
                      <div className="h-full p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col justify-between shadow-md">
                        <div className="text-[11px] font-semibold text-slate-300 font-mono">Revenue Velocity</div>
                        <svg className="w-full h-20 overflow-visible" viewBox="0 0 100 45">
                          <defs>
                            <linearGradient id="p2RevGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#DC2626" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#DC2626" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d="M0,40 Q25,35 45,22 T75,15 T100,6 L100,45 L0,45 Z" fill="url(#p2RevGrad)" />
                          <path d="M0,40 Q25,35 45,22 T75,15 T100,6" fill="none" stroke="#EF4444" strokeWidth="2.5" className="rz-anim-dash" />
                          <circle cx="100" cy="6" r="3.5" fill="#EF4444" />
                        </svg>
                        <div className="text-[10px] font-mono text-emerald-400 font-bold">+18% vs Target</div>
                      </div>

                      {/* Mini Donut Retention Widget */}
                      <div className="h-full p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col items-center justify-between shadow-md">
                        <div className="text-[11px] font-semibold text-slate-300 font-mono">Retention QoQ</div>
                        <div className="w-16 h-16 -rotate-90 relative flex items-center justify-center">
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#1E293B" strokeWidth="3.5" />
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#DC2626" strokeWidth="3.5" strokeDasharray="88" strokeDashoffset="19" strokeLinecap="round" />
                          </svg>
                          <span className="absolute rotate-90 text-[11px] font-mono text-white font-bold">78.4%</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">QoQ +4% Growth</div>
                      </div>

                      {/* Mini SKU Bar Distribution Widget */}
                      <div className="h-full p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col justify-between shadow-md">
                        <div className="text-[11px] font-semibold text-slate-300 font-mono">Fast Moving SKUs</div>
                        <div className="flex items-end justify-between gap-1.5 h-20">
                          <div className="w-3.5 bg-red-600 rounded-t-sm h-[85%]" />
                          <div className="w-3.5 bg-red-500 rounded-t-sm h-[65%]" />
                          <div className="w-3.5 bg-rose-400 rounded-t-sm h-[94%]" />
                          <div className="w-3.5 bg-slate-700 rounded-t-sm h-[45%]" />
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">94.2% In Stock</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPillar === 2 && (
                  /* Pillar 03: AI Incident Telemetry & Diagnostic Visual */
                  <div className="space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono flex items-center gap-1.5 font-semibold text-slate-300">
                        <AlertCircle size={14} className="text-amber-400" />
                        Continuous Anomaly Sentinel Telemetry
                      </span>
                      <span className="text-amber-400 font-mono text-[10px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                        P1 Active Alert
                      </span>
                    </div>

                    <div className="relative h-44 sm:h-48 w-full">
                      <svg className="w-full h-full" viewBox="0 0 540 160">
                        <defs>
                          <linearGradient id="corridorPillarGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>

                        {/* Normal Operating Corridor (Green Area) */}
                        <path d="M 0,40 Q 150,30 300,38 T 540,35 L 540,95 Q 300,98 150,90 T 0,95 Z" fill="url(#corridorPillarGrad)" />

                        {/* Upper & Lower Threshold Bounds */}
                        <line x1="0" y1="35" x2="540" y2="35" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="0" y1="110" x2="540" y2="110" stroke="#DC2626" strokeWidth="1.8" strokeDasharray="5 5" />
                        <text x="535" y="104" fill="#F87171" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="end">Tolerance Threshold (-15%)</text>

                        {/* Telemetry Stream Wave */}
                        <path
                          d="M 0,65 Q 60,60 120,68 T 240,62 T 320,66 L 370,126 L 420,70 T 490,66 T 540,62"
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />

                        {/* Breach Node at Branch #12 with Alert Ping */}
                        <circle cx="370" cy="126" r="20" fill="none" stroke="#EF4444" strokeWidth="1.5" className="rz-anim-pulse" />
                        <circle cx="370" cy="126" r="6" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />

                        {/* Alert Callout Flag */}
                        <rect x="260" y="118" width="96" height="24" rx="6" fill="#1E293B" stroke="#DC2626" strokeWidth="1.5" />
                        <text x="308" y="134" fill="#FCA5A5" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                          -18.2% DIP
                        </text>
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Items List Inside Mockup — 100% Preserved Text & Values */}
              <div className="space-y-3">
                {current.previewContent.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/70 flex items-center justify-between hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                      <div className="truncate">
                        <div className="text-xs sm:text-sm font-bold text-slate-200 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.rows}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-mono text-slate-300 font-medium">{item.rate}</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Footer inside Mockup */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-400">
                  Ready to test with your own company datasets?
                </span>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-md"
                >
                  <span>Launch Module</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
