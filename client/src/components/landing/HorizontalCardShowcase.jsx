import React, { useEffect, useRef, useState } from 'react';
import { 
  Zap, 
  Layers, 
  TrendingUp, 
  ShieldCheck, 
  Sparkles, 
  Activity, 
  Cpu, 
  ArrowRight,
  Database,
  BarChart3,
  Sliders,
  CheckCircle2,
  Lock,
  GitBranch,
  FileText,
  Calculator,
  BellRing
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { calculateGrossMetrics, DEFAULT_ILLUSTRATIVE_METRICS } from '../../utils/formulaCalculator';

gsap.registerPlugin(ScrollTrigger);

/**
 * HorizontalCardShowcase — Pinned Horizontal Scroll Section
 * Showcases 6 verified core product capabilities with:
 * - Mathematical accuracy (Gross Profit ₹5.76 Cr, Gross Margin 68.4%, Gross Profit/Hub ₹0.12 Cr)
 * - Factual capability descriptions without unverified benchmarks
 * - High-contrast, clean light-mode surfaces matching dark-mode elegance
 */
export default function HorizontalCardShowcase({ onOpenDemo }) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const [activeCard, setActiveCard] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

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
      features: ['Automated schema discovery', 'Credentials encrypted with AES-256-GCM', 'Multi-tenant organization isolation'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">VERIFIED_DATA_CONNECTORS</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">CONNECTED</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-blue-600 dark:text-blue-400 font-medium">PostgreSQL Direct Connection</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">Schema Verified</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-purple-600 dark:text-purple-400 font-medium">MongoDB Collection Sync</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">Collections Active</span>
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
      features: ['Dynamic time-range and region filters', 'Multi-series chart composition', 'Responsive desktop and mobile layouts'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">REVENUE PACING VS BUDGET</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">+24.8% FY26</span>
          </div>
          <div className="flex items-end justify-between h-14 gap-2 pt-1 px-1">
            {[
              { m: 'M1', t: 40, a: 45 },
              { m: 'M2', t: 55, a: 62 },
              { m: 'M3', t: 70, a: 80 },
              { m: 'M4', t: 85, a: 98 },
              { m: 'M5', t: 100, a: 118 }
            ].map((pt, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-full flex items-end justify-center gap-1 h-10">
                  <div className="w-2 bg-slate-300 dark:bg-slate-700 rounded-t" style={{ height: `${(pt.t / 125) * 100}%` }} title={`Target: ₹${pt.t}L`} />
                  <div className="w-2.5 bg-red-600 rounded-t" style={{ height: `${(pt.a / 125) * 100}%` }} title={`Actual: ₹${pt.a}L`} />
                </div>
                <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mt-1">{pt.m}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1 text-[9px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 font-mono">
            <span>■ Gray: Target Plan</span>
            <span className="text-red-600 dark:text-red-400 font-bold">■ Red: Actual Invoiced</span>
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
      features: ['Standardized gross profit and margin formulas', 'Programmatic arithmetic verification', 'Reusable across alerts and report exports'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">FORMULA: GROSS_MARGIN</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">PROGRAMMATIC</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono py-1">
            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              [Revenue: ₹8.42 Cr]
            </span>
            <span className="text-red-600 dark:text-red-400 font-bold">-</span>
            <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              [COGS: ₹2.66 Cr]
            </span>
            <span className="text-slate-600 dark:text-slate-400 font-bold">=</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
              ₹5.76 Cr (68.4%)
            </span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800/60 flex justify-between">
            <span>Per Hub: ₹5.76 Cr ÷ 48 Hubs = ₹0.12 Cr</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Illustrative Calculation</span>
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
        { label: 'Delivery', value: 'Email Notifications' },
        { label: 'Scope', value: 'Multi-Metric' }
      ],
      features: ['Configurable metric threshold rules', 'Notification delivery on condition trigger', 'Direct link to drill down into source records'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">THRESHOLD_EVALUATION</span>
            <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">WARNING DETECTED</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-700 dark:text-slate-200">Hub #19 Margin Contraction</span>
              <span className="text-red-600 dark:text-red-400 font-mono font-bold">-14.2% vs Plan</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 shadow-2xs">
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
      features: ['Interactive parameter adjustments', 'Gross margin sensitivity analysis', 'Historical baseline comparison'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">SCENARIO: +4.5% SUPPLY COGS SHIFT</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">SIMULATED</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono py-1">
            <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-500 dark:text-slate-400 block text-[9px]">Conservative</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">64.5%</span>
            </div>
            <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-500 dark:text-slate-400 block text-[9px]">Baseline</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">68.4%</span>
            </div>
            <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
              <span className="text-emerald-700 dark:text-emerald-400 block text-[9px]">Optimistic</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">71.2%</span>
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
      features: ['Tenant database isolation by organization ID', 'Role-based access control (Admin, Member, Viewer)', 'Audit trail logging for critical actions'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1.5 text-[10px]">
            <span className="font-bold text-slate-900 dark:text-white">ACCESS_CONTROL_MATRIX</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">ENFORCED</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-700 dark:text-slate-200">Organization Administrator</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">Full Management</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-slate-700 dark:text-slate-200">Team Member / Viewer</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold font-mono">Dashboard Read-Only</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    // Check if mobile or reduced-motion
    const isMobile = window.innerWidth < 1024;
    if (isMobile) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      const getScrollAmount = () => track.scrollWidth - window.innerWidth + 120;

      const tween = gsap.to(track, {
        x: () => -getScrollAmount(),
        ease: 'none',
      });

      ScrollTrigger.create({
        trigger: container,
        start: 'top top',
        end: () => `+=${getScrollAmount()}`,
        pin: true,
        animation: tween,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setScrollProgress(self.progress);
          const idx = Math.min(
            cards.length - 1,
            Math.floor(self.progress * cards.length)
          );
          setActiveCard(idx);
        }
      });
    }, container);

    return () => ctx.revert();
  }, [cards.length]);

  return (
    <section 
      ref={containerRef}
      id="capabilities-gallery"
      className="relative bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden py-16 lg:py-24 border-t border-slate-200 dark:border-slate-800 transition-colors duration-200"
    >
      <div className="max-w-[1480px] mx-auto w-full">
        
        {/* Section Header with Sticky Progress Scrubber */}
        <div className="px-4 sm:px-6 lg:px-12 mb-8 lg:mb-12">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800/80 pb-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
                <Sparkles size={12} className="text-red-600 dark:text-red-400" />
                <span>Core Platform Capabilities</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Designed for Reliable Business Intelligence.
              </h2>
            </div>

            {/* Progress Counter & Guide */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">Capability Module</div>
                <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                  0{activeCard + 1} / 0{cards.length}
                </div>
              </div>
              <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-150"
                  style={{ width: `${Math.max(10, scrollProgress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Card Track */}
        <div 
          ref={trackRef} 
          className="flex gap-6 lg:gap-8 px-4 sm:px-6 lg:px-12 w-full lg:w-max overflow-x-auto lg:overflow-visible pb-6 lg:pb-0 scrollbar-none"
        >
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="w-[85vw] sm:w-[480px] lg:w-[520px] shrink-0 rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-lg hover:shadow-xl flex flex-col justify-between transition-all duration-200 relative overflow-hidden text-slate-900 dark:text-slate-100"
              >
                {/* Subtle Ambient Card Gradient */}
                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${card.accent} opacity-5 dark:opacity-10 rounded-full blur-3xl pointer-events-none`} />

                <div>
                  {/* Category Pill & Icon */}
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {card.category}
                    </span>
                    <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-900 dark:text-white shadow-2xs">
                      <Icon size={20} className="text-red-600 dark:text-red-400" />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2.5">
                    {card.title}
                  </h3>
                  <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal mb-5">
                    {card.description}
                  </p>

                  {/* Realistic Interface Mockup Box */}
                  {card.mockup}

                  {/* 3 Metric Pills */}
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {card.stats.map((stat, sIdx) => (
                      <div key={sIdx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-center">
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{stat.label}</div>
                        <div className="text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Feature Checkpoints */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    {card.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Card Action */}
                <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">MODULE 0{idx + 1} OF 0{cards.length}</span>
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

        {/* Mobile Scroll Indicator Bar */}
        <div className="px-4 text-center lg:hidden pt-4 text-xs font-mono text-slate-500 dark:text-slate-400">
          ← Swipe horizontally to explore 6 capabilities →
        </div>

      </div>
    </section>
  );
}
