import React from 'react';
import { 
  Database, 
  BarChart3, 
  Calculator, 
  BellRing, 
  TrendingUp, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles 
} from 'lucide-react';
import { DEFAULT_ILLUSTRATIVE_METRICS } from '../../utils/formulaCalculator';

/**
 * HorizontalCardShowcase — Responsive 6-Card Capability Showcase (Option B Grid)
 * Completely eliminates horizontal clipping and scroll-trapping lag.
 * Renders all 6 core product capabilities in a clean, responsive 3-column grid
 * (1 col on mobile, 2 cols on tablet, 3 cols on desktop) with:
 * - Mathematical accuracy (Gross Profit ₹5.76 Cr, Gross Margin 68.4%, Gross Profit/Hub ₹0.12 Cr)
 * - 100% visible, unclipped cards on all viewports (1536px, 1366px, 1024px, 768px, 390px)
 * - Native, butter-smooth vertical page scrolling without GSAP pinning
 * - High-contrast, clean light and dark mode surfaces
 */
export default function HorizontalCardShowcase({ onOpenDemo }) {
  const formulaData = DEFAULT_ILLUSTRATIVE_METRICS;

  const cards = [
    {
      id: 'connectors',
      category: 'Data Integration',
      title: 'Multi-Source Data Connectors',
      description: 'Connect PostgreSQL, MongoDB, REST APIs, and dataset files (CSV & JSON) into a unified reporting interface, with Excel XLSX export.',
      icon: Database,
      accent: 'from-blue-600 to-indigo-600',
      stats: [
        { label: 'Databases', value: 'PostgreSQL & Mongo' },
        { label: 'APIs', value: 'REST & Webhooks' },
        { label: 'Files', value: 'CSV, JSON & XLSX' }
      ],
      features: [
        'Automated schema discovery',
        'Credentials encrypted with AES-256-GCM',
        'Multi-tenant organization isolation'
      ],
      mockup: (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">VERIFIED_CONNECTORS</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">CONNECTED</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-blue-600 dark:text-blue-400 font-medium">PostgreSQL Direct</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">Verified</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-purple-600 dark:text-purple-400 font-medium">MongoDB Sync</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">Active</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'dashboards',
      category: 'Analytics & Visualization',
      title: 'Interactive Business Dashboards',
      description: 'Explore enterprise revenue trends, gross margin performance, and regional store rollups with responsive chart widgets and live filtering.',
      icon: BarChart3,
      accent: 'from-red-600 to-rose-600',
      stats: [
        { label: 'Views', value: 'Executive Cockpit' },
        { label: 'Filters', value: 'Date & Region' },
        { label: 'Interactions', value: 'Hover & Drilldown' }
      ],
      features: [
        'Dynamic time-range and region filters',
        'Multi-series chart composition',
        'Responsive desktop and mobile layouts'
      ],
      mockup: (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">REVENUE PACING VS BUDGET</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">+24.8% FY26</span>
          </div>
          <div className="flex items-end justify-between h-12 gap-2 pt-1 px-1">
            {[
              { m: 'M1', t: 40, a: 45 },
              { m: 'M2', t: 55, a: 62 },
              { m: 'M3', t: 70, a: 80 },
              { m: 'M4', t: 85, a: 98 },
              { m: 'M5', t: 100, a: 118 }
            ].map((pt, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-full flex items-end justify-center gap-1 h-9">
                  <div className="w-2 bg-slate-300 dark:bg-slate-700 rounded-t" style={{ height: `${(pt.t / 125) * 100}%` }} title={`Target: ₹${pt.t}L`} />
                  <div className="w-2.5 bg-red-600 rounded-t" style={{ height: `${(pt.a / 125) * 100}%` }} title={`Actual: ₹${pt.a}L`} />
                </div>
                <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mt-1">{pt.m}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1 text-[9px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 font-mono">
            <span>■ Gray: Target</span>
            <span className="text-red-600 dark:text-red-400 font-bold">■ Red: Actual</span>
          </div>
        </div>
      )
    },
    {
      id: 'formula',
      category: 'KPI and Formula Studio',
      title: 'Governed KPI & Formula Studio',
      description: 'Standardize enterprise financial formulas with an expression builder that propagates verified mathematical logic to every executive dashboard.',
      icon: Calculator,
      accent: 'from-amber-600 to-orange-600',
      stats: [
        { label: 'Gross Profit', value: formulaData.formatted.grossProfit },
        { label: 'Gross Margin', value: formulaData.formatted.grossMargin },
        { label: 'Per Hub', value: formulaData.formatted.grossProfitPerHub }
      ],
      features: [
        'Standardized gross profit and margin formulas',
        'Programmatic arithmetic verification',
        'Reusable across alerts and report exports'
      ],
      mockup: (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">FORMULA: GROSS_MARGIN</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">PROGRAMMATIC</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono py-1">
            <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[9px]">
              ₹8.42 Cr
            </span>
            <span className="text-red-600 dark:text-red-400 font-bold text-[9px]">-</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9px]">
              ₹2.66 Cr
            </span>
            <span className="text-slate-600 dark:text-slate-400 font-bold text-[9px]">=</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[9px]">
              ₹5.76 Cr (68.4%)
            </span>
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800/60 flex justify-between">
            <span>Per Hub: ₹5.76 Cr ÷ 48 = ₹0.12 Cr</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified</span>
          </div>
        </div>
      )
    },
    {
      id: 'sentinel',
      category: 'Automated Alerting',
      title: 'Automated Anomaly & Threshold Alerts',
      description: 'Configure automated threshold checks across operational KPIs to alert managers when margins, order counts, or revenues deviate from targets.',
      icon: BellRing,
      accent: 'from-purple-600 to-pink-600',
      stats: [
        { label: 'Detection', value: 'Automated Rules' },
        { label: 'Delivery', value: 'Email Alerts' },
        { label: 'Scope', value: 'Multi-Metric' }
      ],
      features: [
        'Configurable metric threshold rules',
        'Notification delivery on condition trigger',
        'Direct link to drill down into source records'
      ],
      mockup: (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">THRESHOLD_EVALUATION</span>
            <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">WARNING DETECTED</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-700 dark:text-slate-200">Hub #19 Margin Contraction</span>
              <span className="text-red-600 dark:text-red-400 font-mono font-bold">-14.2%</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-700 dark:text-slate-200">Email Notification Status</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">Dispatched</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'simulation',
      category: 'Scenario Planning',
      title: 'Scenario Simulation & Trend Modeling',
      description: 'Model the projected effect of cost shifts, fee adjustments, and revenue changes to make data-backed operational plans before review meetings.',
      icon: TrendingUp,
      accent: 'from-emerald-600 to-teal-600',
      stats: [
        { label: 'Simulation', value: 'What-If Corridors' },
        { label: 'Inputs', value: 'Interactive Sliders' },
        { label: 'Outputs', value: 'Margin Sensitivity' }
      ],
      features: [
        'Interactive parameter adjustments',
        'Gross margin sensitivity analysis',
        'Historical baseline comparison'
      ],
      mockup: (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">SCENARIO: +4.5% COGS SHIFT</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">SIMULATED</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono py-1">
            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-500 dark:text-slate-400 block text-[9px]">Bear</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold text-[10px]">64.5%</span>
            </div>
            <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-500 dark:text-slate-400 block text-[9px]">Base</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold text-[10px]">68.4%</span>
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
              <span className="text-emerald-700 dark:text-emerald-400 block text-[9px]">Bull</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">71.2%</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'security',
      category: 'Governance & Security',
      title: 'Role-Based Access & Data Tenancy',
      description: 'Control who sees what with role-based permissions (Admin, Member, Viewer) and protect enterprise metrics with tenant-isolated database storage.',
      icon: Lock,
      accent: 'from-slate-700 to-slate-900',
      stats: [
        { label: 'Encryption', value: 'AES-256-GCM' },
        { label: 'Roles', value: 'Server-Enforced' },
        { label: 'Audit Logs', value: 'Activity Tracked' }
      ],
      features: [
        'Tenant database isolation by organization ID',
        'Role-based access control (Admin, Member, Viewer)',
        'Audit trail logging for critical actions'
      ],
      mockup: (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">ACCESS_CONTROL_MATRIX</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">ENFORCED</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-700 dark:text-slate-200">Organization Administrator</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">Full Access</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-700 dark:text-slate-200">Team Member / Viewer</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold font-mono">Read-Only</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <section 
      id="capabilities-gallery"
      className="relative bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-white py-16 sm:py-20 lg:py-24 border-t border-slate-200 dark:border-slate-800 transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-slate-200 dark:border-slate-800/80 pb-8 mb-10 lg:mb-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
              <Sparkles size={12} className="text-red-600 dark:text-red-400" />
              <span>Core Platform Capabilities</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Designed for Reliable Business Intelligence.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Explore the 6 core modules powering verified data ingestion, governed formulas, automated alerting, and executive reporting.
            </p>
          </div>

          {/* Module Counter Pill */}
          <div className="flex items-center gap-3 shrink-0 self-start md:self-end">
            <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shadow-2xs">
              06 Production Modules
            </span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
        </div>

        {/* Responsive 3x2 Grid (Option B) - Zero Horizontal Clipping */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-900/60 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden text-slate-900 dark:text-slate-100 group"
              >
                {/* Subtle Ambient Card Gradient */}
                <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${card.accent} opacity-5 dark:opacity-10 rounded-full blur-2xl pointer-events-none group-hover:opacity-15 transition-opacity`} />

                <div>
                  {/* Category Pill & Icon */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {card.category}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-900 dark:text-white shadow-2xs group-hover:scale-105 transition-transform">
                      <Icon size={18} className="text-red-600 dark:text-red-400" />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal mb-4 min-h-[40px]">
                    {card.description}
                  </p>

                  {/* Realistic Interface Mockup Box */}
                  {card.mockup}

                  {/* 3 Metric Pills */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {card.stats.map((stat, sIdx) => (
                      <div key={sIdx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 text-center">
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">{stat.label}</div>
                        <div className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5 truncate">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Feature Checkpoints */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    {card.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Card Action */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">MODULE 0{idx + 1} OF 0{cards.length}</span>
                  <button
                    type="button"
                    onClick={onOpenDemo}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <span>View Module Demo</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
