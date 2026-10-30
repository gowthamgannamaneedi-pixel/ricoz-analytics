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
  FileText
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * HorizontalCardShowcase — Pinned Horizontal Scroll Section
 * Inspired by Stellar Management's signature horizontal gallery interaction:
 * As the user scrolls vertically, the section pins to the viewport while 
 * 6 enterprise capability cards glide horizontally across the screen with 
 * layered parallax depth, realistic UI interface previews, and micro-interactions.
 */
export default function HorizontalCardShowcase({ onOpenDemo }) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const [activeCard, setActiveCard] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const cards = [
    {
      id: 'mesh',
      category: 'Unified Data Integration',
      title: 'Zero-ETL Multi-Cloud Connector Fabric',
      description: 'Run direct federated queries across PostgreSQL, Snowflake, MongoDB, Google Sheets, and REST APIs without moving raw rows or paying secondary egress taxes.',
      icon: Database,
      accent: 'from-blue-600 to-indigo-600',
      stats: [
        { label: 'Query Latency', value: '< 250ms' },
        { label: 'Data Egress Cost', value: '$0' },
        { label: 'Connectors', value: '20+ Native' }
      ],
      features: ['Automated schema discovery', 'Incremental change data capture', 'Multi-tenant isolation'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-white">FEDERATED_INGESTION_FABRIC</span>
            <span className="text-emerald-400 font-mono font-bold">P99: 142ms</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-800">
              <span className="text-blue-400 font-medium">PostgreSQL Primary (CDC)</span>
              <span className="text-emerald-400 font-mono font-bold">42.8K evt/s</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-800">
              <span className="text-purple-400 font-medium">Snowflake Data Lake</span>
              <span className="text-emerald-400 font-mono font-bold">Zero-Copy Pushdown</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'dashboards',
      category: 'Dynamic Analytics Dashboards',
      title: 'Interactive Multi-Series Visualization Studio',
      description: 'Explore live enterprise revenue streams, gross margin pacing, and regional store rollups with sub-second recalculation and instant cross-metric filtering.',
      icon: BarChart3,
      accent: 'from-red-600 to-rose-600',
      stats: [
        { label: 'Render Time', value: '18ms' },
        { label: 'Metric Types', value: '40+ Custom' },
        { label: 'Slicing', value: 'Real-time' }
      ],
      features: ['Dynamic dimensional filters', 'Custom chart composition', 'Automatic responsive scaling'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-white">REVENUE PACING VS BUDGET</span>
            <span className="text-emerald-400 font-mono font-bold">+24.8% FY26</span>
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
                  <div className="w-2 bg-slate-700 rounded-t" style={{ height: `${(pt.t / 125) * 100}%` }} title={`Target: ₹${pt.t}L`} />
                  <div className="w-2.5 bg-red-600 rounded-t" style={{ height: `${(pt.a / 125) * 100}%` }} title={`Actual: ₹${pt.a}L`} />
                </div>
                <span className="text-[9px] font-mono text-slate-400 mt-1">{pt.m}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-1 text-[9px] text-slate-400 border-t border-slate-800/60 font-mono">
            <span>■ Gray: Target Budget</span>
            <span className="text-red-400 font-bold">■ Red: Actual Invoiced</span>
          </div>
        </div>
      )
    },
    {
      id: 'formula',
      category: 'KPI and Formula Studio',
      title: 'Visual Governed KPI & Formula Studio',
      description: 'Standardize enterprise financial formulas with an intuitive expression editor that propagates validated logic to every executive dashboard.',
      icon: Sliders,
      accent: 'from-amber-600 to-orange-600',
      stats: [
        { label: 'Execution', value: 'Sub-15ms' },
        { label: 'Formulas', value: 'Unlimited' },
        { label: 'Re-Use Rate', value: '99.4%' }
      ],
      features: ['Version-controlled definitions', 'Relational entity joins', 'Automatic query optimizer'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-white">EXPRESSION: [EBITDA_MARGIN]</span>
            <span className="text-emerald-400 font-mono font-bold">VALIDATED</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono py-1">
            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">[Revenue]</span>
            <span className="text-red-400 font-bold">-</span>
            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">[COGS]</span>
            <span className="text-slate-400 font-bold">÷</span>
            <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">[Revenue]</span>
            <span className="text-emerald-400 font-bold">=</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">68.4%</span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 flex justify-between">
            <span>Query Runtime: 14ms</span>
            <span className="text-emerald-400">Propagated to 48 Hubs</span>
          </div>
        </div>
      )
    },
    {
      id: 'sentinel',
      category: 'AI-Powered Insights',
      title: '24/7 Autonomous Root-Cause Copilot',
      description: 'Machine learning establishes rolling seasonal baselines and catches margin contractions and inventory depletion days before accounting reviews.',
      icon: Sparkles,
      accent: 'from-purple-600 to-pink-600',
      stats: [
        { label: 'Detection Speed', value: 'Instant' },
        { label: 'False Positives', value: '< 0.2%' },
        { label: 'Coverage', value: '100% Metrics' }
      ],
      features: ['Dynamic Z-Score triggers', 'Autonomous incident routing', '1-Click ledger remediation'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-white">ROOT-CAUSE ATTRIBUTION</span>
            <span className="text-purple-400 font-mono font-bold">p &lt; 0.01 CONFIDENCE</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-800">
              <span className="text-slate-200">South Hub Enterprise Reorders</span>
              <span className="text-emerald-400 font-mono font-bold">+16.2% Driver</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-800">
              <span className="text-slate-200">High-Ticket Order Basket Size</span>
              <span className="text-emerald-400 font-mono font-bold">+7.4% Driver</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'simulation',
      category: 'Forecasting and Scenario Analysis',
      title: 'Monte Carlo What-If Econometric Engine',
      description: 'Simulate supply chain price shifts, tariff changes, and regional franchise fee indexing with statistical certainty before board meetings.',
      icon: TrendingUp,
      accent: 'from-emerald-600 to-teal-600',
      stats: [
        { label: 'Confidence', value: 'R² = 0.94' },
        { label: 'Simulations', value: '10,000 / sec' },
        { label: 'Accuracy', value: 'Enterprise' }
      ],
      features: ['Interactive parameter sliders', 'EBITDA sensitivity waterfalls', 'Hedging recommendations'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-white">90-DAY CASH RUNWAY CORRIDOR</span>
            <span className="text-emerald-400 font-mono font-bold">R² = 0.94</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono py-1">
            <div className="p-1 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">P10 Worst</span>
              <span className="text-slate-200 font-bold">11.2 Mo</span>
            </div>
            <div className="p-1 rounded bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[9px]">P50 Median</span>
              <span className="text-slate-200 font-bold">13.4 Mo</span>
            </div>
            <div className="p-1 rounded bg-emerald-950/60 border border-emerald-800">
              <span className="text-emerald-400 block text-[9px]">P90 Target</span>
              <span className="text-emerald-300 font-bold">14.8 Mo</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'security',
      category: 'Enterprise Governance and Collaboration',
      title: 'Row-Level Branch Isolation & Sovereign RBAC',
      description: 'Branch managers see only their franchise nodes. Regional directors view hub territory. Corporate executives inspect consolidated networks.',
      icon: Lock,
      accent: 'from-slate-700 to-slate-900',
      stats: [
        { label: 'Encryption', value: 'AES-256' },
        { label: 'Audit Logs', value: 'Immutable' },
        { label: 'SSO Providers', value: 'SAML / Okta' }
      ],
      features: ['Zero cross-branch exposure', 'Single Sign-On (SAML / OIDC)', 'Full forensic audit trails'],
      mockup: (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-2 mb-4">
          <div className="flex justify-between items-center text-slate-300 border-b border-slate-800/80 pb-1.5 text-[10px]">
            <span className="font-bold text-white">ROW-LEVEL SECURITY (RLS) MATRIX</span>
            <span className="text-emerald-400 font-mono font-bold">ACTIVE</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-800">
              <span className="text-slate-200">HQ Leadership Level</span>
              <span className="text-emerald-400 font-bold font-mono">Consolidated (48 Hubs)</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-800">
              <span className="text-slate-200">Branch Manager Level</span>
              <span className="text-blue-400 font-bold font-mono">Store-Isolated (1 Hub)</span>
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
      className="relative bg-slate-950 text-white overflow-hidden py-16 lg:py-24 border-t border-slate-800"
    >
      <div className="max-w-[1480px] mx-auto w-full">
        
        {/* Section Header with Sticky Progress Scrubber */}
        <div className="px-4 sm:px-6 lg:px-12 mb-8 lg:mb-12">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-800/80 pb-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
                <Sparkles size={12} className="text-red-400" />
                <span>Enterprise Architecture Capabilities</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                Designed for Mission-Critical Operations.
              </h2>
            </div>

            {/* Progress Counter & Guide */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-mono text-slate-400">Card Gallery Track</div>
                <div className="text-sm font-mono font-bold text-white">
                  0{activeCard + 1} / 0{cards.length}
                </div>
              </div>
              <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
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
                className="w-[85vw] sm:w-[480px] lg:w-[520px] shrink-0 rounded-3xl bg-slate-900/90 p-6 sm:p-7 border border-slate-800 hover:border-slate-700 shadow-2xl flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 relative overflow-hidden group"
              >
                {/* Subtle Ambient Card Gradient */}
                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${card.accent} opacity-10 rounded-full blur-3xl pointer-events-none group-hover:opacity-20 transition-opacity`} />

                <div>
                  {/* Category Pill & Icon */}
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {card.category}
                    </span>
                    <div className="w-11 h-11 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                      <Icon size={20} className="text-red-400" />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2.5 group-hover:text-red-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal mb-5">
                    {card.description}
                  </p>

                  {/* Realistic Interface Mockup Box */}
                  {card.mockup}

                  {/* 3 Metric Pills */}
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {card.stats.map((stat, sIdx) => (
                      <div key={sIdx} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <div className="text-[10px] font-mono text-slate-400">{stat.label}</div>
                        <div className="text-xs sm:text-sm font-mono font-bold text-white mt-0.5">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Feature Checkpoints */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    {card.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Card Action */}
                <div className="pt-5 mt-5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">STAGE 0{idx + 1} OF 0{cards.length}</span>
                  <button
                    type="button"
                    onClick={onOpenDemo}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer group-hover:translate-x-0.5"
                  >
                    <span>Inspect Module</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Scroll Indicator Bar */}
        <div className="px-4 text-center lg:hidden pt-4 text-xs font-mono text-slate-400">
          ← Swipe horizontally to explore 6 modules →
        </div>

      </div>
    </section>
  );
}
