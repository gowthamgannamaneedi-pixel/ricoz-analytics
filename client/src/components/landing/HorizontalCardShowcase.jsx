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
  Lock
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * HorizontalCardShowcase — Pinned Horizontal Scroll Section
 * Inspired by Stellar Management's signature horizontal gallery interaction:
 * As the user scrolls vertically, the section pins to the viewport while 
 * wide enterprise capability cards glide horizontally across the screen with 
 * layered parallax depth and micro-animations.
 */
export default function HorizontalCardShowcase({ onOpenDemo }) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const [activeCard, setActiveCard] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const cards = [
    {
      id: 'mesh',
      category: 'Unified Data Fabric',
      title: 'Zero-ETL Multi-Cloud Connector Fabric',
      description: 'Run direct federated queries across PostgreSQL, Snowflake, MongoDB, and REST APIs without moving raw rows or paying secondary egress taxes.',
      icon: Database,
      accent: 'from-blue-600 to-indigo-600',
      stats: [
        { label: 'Query Latency', value: '< 250ms' },
        { label: 'Data Egress Cost', value: '$0' },
        { label: 'Connectors', value: '20+ Native' }
      ],
      features: ['Automated schema discovery', 'Incremental change data capture', 'Multi-tenant isolation']
    },
    {
      id: 'sentinel',
      category: 'Autonomous Guard',
      title: '24/7 Real-Time Anomaly Sentinel',
      description: 'Machine learning establishes rolling seasonal baselines and catches margin contractions and inventory depletion days before accounting reviews.',
      icon: Activity,
      accent: 'from-red-600 to-rose-600',
      stats: [
        { label: 'Detection Speed', value: 'Instant' },
        { label: 'False Positives', value: '< 0.2%' },
        { label: 'Coverage', value: '100% Metrics' }
      ],
      features: ['Dynamic Z-Score triggers', 'Autonomous incident routing', '1-Click ledger remediation']
    },
    {
      id: 'formula',
      category: 'Semantic Calculation',
      title: 'Visual Governed KPI & Formula Studio',
      description: 'Standardize enterprise financial formulas with an intuitive expression editor that propagates validated logic to every executive dashboard.',
      icon: Sliders,
      accent: 'from-purple-600 to-pink-600',
      stats: [
        { label: 'Execution', value: 'Sub-15ms' },
        { label: 'Formulas', value: 'Unlimited' },
        { label: 'Re-Use Rate', value: '99.4%' }
      ],
      features: ['Version-controlled definitions', 'Relational entity joins', 'Automatic query optimizer']
    },
    {
      id: 'simulation',
      category: 'Predictive Modeling',
      title: 'Monte Carlo What-If Econometric Engine',
      description: 'Simulate supply chain price shifts, tariff changes, and regional franchise fee indexing with statistical certainty before board meetings.',
      icon: TrendingUp,
      accent: 'from-emerald-600 to-teal-600',
      stats: [
        { label: 'Confidence', value: 'R² = 0.94' },
        { label: 'Simulations', value: '10,000 / sec' },
        { label: 'Accuracy', value: 'Enterprise Grade' }
      ],
      features: ['Interactive parameter sliders', 'EBITDA sensitivity waterfalls', 'Hedging recommendations']
    },
    {
      id: 'security',
      category: 'Sovereign Governance',
      title: 'Row-Level Branch Isolation & RBAC',
      description: 'Branch managers see only their franchise nodes. Regional directors view hub territory. Corporate executives inspect consolidated networks.',
      icon: Lock,
      accent: 'from-slate-700 to-slate-900',
      stats: [
        { label: 'Encryption', value: 'AES-256' },
        { label: 'Audit Logs', value: 'Immutable' },
        { label: 'SSO Providers', value: 'SAML / Okta' }
      ],
      features: ['Zero cross-branch exposure', 'Single Sign-On (SAML / OIDC)', 'Full forensic audit trails']
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
      className="relative bg-slate-950 text-white overflow-hidden border-t border-b border-slate-800"
    >
      {/* Pinned Gallery Viewport */}
      <div className="w-full lg:h-screen flex flex-col justify-between py-12 lg:py-16">
        
        {/* Header Bar with Scrub Progress */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                <Sparkles size={13} className="text-red-400" />
                <span>Enterprise Architecture Capabilities</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
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
          className="flex gap-6 lg:gap-8 px-4 sm:px-6 lg:px-16 w-full lg:w-max overflow-x-auto lg:overflow-visible pb-6 lg:pb-0 scrollbar-none"
        >
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="w-[85vw] sm:w-[480px] lg:w-[540px] shrink-0 rounded-3xl bg-slate-900/90 p-6 sm:p-8 border border-slate-800 hover:border-slate-700 shadow-2xl flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 relative overflow-hidden group"
              >
                {/* Subtle Ambient Card Gradient */}
                <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${card.accent} opacity-10 rounded-full blur-3xl pointer-events-none group-hover:opacity-20 transition-opacity`} />

                <div>
                  {/* Category Pill & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {card.category}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                      <Icon size={22} className="text-red-400" />
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-3 group-hover:text-red-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal mb-6">
                    {card.description}
                  </p>

                  {/* 3 Metric Pills */}
                  <div className="grid grid-cols-3 gap-2.5 mb-6">
                    {card.stats.map((stat, sIdx) => (
                      <div key={sIdx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <div className="text-[10px] font-mono text-slate-400">{stat.label}</div>
                        <div className="text-xs sm:text-sm font-mono font-bold text-white mt-0.5">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Feature Checkpoints */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    {card.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Card Action */}
                <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between">
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
          ← Swipe horizontally to explore modules →
        </div>

      </div>
    </section>
  );
}
