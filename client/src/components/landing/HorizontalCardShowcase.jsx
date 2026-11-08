import React, { useEffect, useRef, useState } from 'react';
import { 
  Database, 
  BarChart3, 
  Calculator, 
  BellRing, 
  TrendingUp, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DEFAULT_ILLUSTRATIVE_METRICS } from '../../utils/formulaCalculator';

gsap.registerPlugin(ScrollTrigger);

/**
 * HorizontalCardShowcase — Linear-Grade GSAP Horizontal Capability Showcase
 * Features:
 * - Exactly 6 production capability cards in a unified framed responsive track
 * - Mathematical integer-stride framing: ZERO half-visible or clipped cards
 * - 3 cards visible on wide desktop (>= 1280px), 2 on desktop (1024px-1279px), 1 on mobile
 * - GSAP matchMedia ScrollTrigger horizontal sliding with step-snapping
 * - Quick-jump module tabs and header step arrows for instant direct access
 * - Complete unclipped typography, break-words, and zero text truncation
 * - Verified production metrics (Revenue ₹8.42 Cr, COGS ₹2.66 Cr, Margin 68.4%, ₹0.12 Cr/hub)
 * - Full ScrollTrigger lifecycle cleanup via gsap.matchMedia().revert()
 * - Support for prefers-reduced-motion
 */
export default function HorizontalCardShowcase({ onOpenDemo }) {
  const sectionRef = useRef(null);
  const pinContainerRef = useRef(null);
  const trackWrapperRef = useRef(null);
  const trackRef = useRef(null);

  const [activeCard, setActiveCard] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const formulaData = DEFAULT_ILLUSTRATIVE_METRICS;

  const cards = [
    {
      id: 'connectors',
      category: 'Data Integration',
      tag: 'Connect',
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
        'Automated schema discovery & typing',
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
      tag: 'Dashboards',
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
      tag: 'Formulas',
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
            <span>Per Hub: ₹5.76 Cr ÷ 48 Hubs = ₹0.12 Cr</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified</span>
          </div>
        </div>
      )
    },
    {
      id: 'sentinel',
      category: 'Automated Alerting',
      tag: 'Alerts',
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
              <span className="text-red-600 dark:text-red-400 font-mono font-bold">-14.2% vs Plan</span>
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
      tag: 'Scenarios',
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
      tag: 'Security',
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

  // GSAP ScrollTrigger Pinned Horizontal Slider with Integer Step Framing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const section = sectionRef.current;
    const pinContainer = pinContainerRef.current;
    const track = trackRef.current;
    if (!section || !pinContainer || !track) return;

    const mm = gsap.matchMedia();

    mm.add('(min-width: 1024px)', () => {
      const getScrollMetrics = () => {
        const firstCard = track.children[0];
        const cardW = firstCard ? firstCard.offsetWidth : 420;
        const gap = 24; // gap-6
        const stride = cardW + gap;
        const isWide = window.innerWidth >= 1280;
        const visibleCards = isWide ? 3 : 2;
        const maxStep = Math.max(1, cards.length - visibleCards);
        const maxTranslate = maxStep * stride;
        return { stride, maxStep, maxTranslate, visibleCards };
      };

      const anim = gsap.to(track, {
        x: () => -getScrollMetrics().maxTranslate,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          pin: pinContainer,
          start: 'top top',
          end: () => `+=${window.innerHeight * 2.2}`,
          scrub: 0.6,
          snap: {
            snapTo: (progress) => {
              const { maxStep } = getScrollMetrics();
              return Math.round(progress * maxStep) / maxStep;
            },
            duration: { min: 0.2, max: 0.4 },
            delay: 0.05,
            ease: 'power2.out'
          },
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            setScrollProgress(self.progress);
            const { maxStep, visibleCards } = getScrollMetrics();
            const step = Math.round(self.progress * maxStep);
            // Calculate active leading card index
            const activeIdx = Math.min(cards.length - 1, Math.round(self.progress * (cards.length - 1)));
            setActiveCard(activeIdx);
          }
        }
      });

      return () => {
        anim.kill();
      };
    });

    return () => mm.revert();
  }, [cards.length]);

  const handleMobileScroll = (direction) => {
    if (!trackWrapperRef.current) return;
    const cardEl = trackRef.current?.children[0];
    const cardWidth = cardEl ? cardEl.offsetWidth + 16 : 340;
    const current = trackWrapperRef.current.scrollLeft;
    const target = direction === 'next' ? current + cardWidth : current - cardWidth;
    trackWrapperRef.current.scrollTo({ left: target, behavior: 'smooth' });
  };

  const handleJumpToCard = (idx) => {
    setActiveCard(idx);
    if (window.innerWidth >= 1024 && sectionRef.current) {
      const isWide = window.innerWidth >= 1280;
      const visibleCards = isWide ? 3 : 2;
      const maxStep = Math.max(1, cards.length - visibleCards);
      const targetStep = Math.min(maxStep, idx);
      
      const st = ScrollTrigger.getById('capabilities-slider') || ScrollTrigger.getAll().find(s => s.trigger === sectionRef.current);
      if (st) {
        const targetScroll = st.start + (targetStep / maxStep) * (st.end - st.start);
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
      } else {
        const top = sectionRef.current.offsetTop;
        const height = sectionRef.current.offsetHeight;
        const targetScroll = top + (targetStep / maxStep) * (height - window.innerHeight);
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
    } else if (trackWrapperRef.current && trackRef.current) {
      const targetCard = trackRef.current.children[idx];
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  const handleNavStep = (direction) => {
    const nextIdx = direction === 'next'
      ? Math.min(cards.length - 1, activeCard + 1)
      : Math.max(0, activeCard - 1);
    handleJumpToCard(nextIdx);
  };

  return (
    <section 
      ref={sectionRef}
      id="capabilities-gallery"
      className="relative bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 transition-colors duration-200 py-12 sm:py-16 lg:py-0 lg:h-[300vh] overflow-x-clip"
    >
      {/* ─── PINNED CONTAINER ─── */}
      <div 
        ref={pinContainerRef}
        className="w-full lg:h-screen overflow-hidden flex flex-col justify-between py-6 lg:py-8 relative"
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[600px] h-[400px] bg-red-600/5 dark:bg-red-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Sticky Header with Title, Progress Bar, Module Switcher & Nav Controls */}
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 w-full shrink-0">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                <Sparkles size={12} className="text-red-600 dark:text-red-400" />
                <span>Core Platform Capabilities</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Designed for Reliable Business Intelligence.
              </h2>
            </div>

            {/* Linear-Style Progress Counter, Progress Bar & Step Arrows */}
            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                  Capability Module
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-red-600 dark:text-red-400 shadow-2xs">
                  0{activeCard + 1} / 0{cards.length}
                </span>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>

                {/* Desktop Step Controls */}
                <div className="hidden sm:flex items-center gap-1.5 ml-1">
                  <button
                    type="button"
                    onClick={() => handleNavStep('prev')}
                    disabled={activeCard === 0}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
                    aria-label="Previous capability module"
                    title="Previous module"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavStep('next')}
                    disabled={activeCard === cards.length - 1}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
                    aria-label="Next capability module"
                    title="Next module"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-36 sm:w-48 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-red-500 rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${Math.max(16, ((activeCard + 1) / cards.length) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Module Jump Tabs (Linear Style) */}
          <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none">
            {cards.map((card, idx) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleJumpToCard(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeCard === idx
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/25 scale-102'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
                }`}
              >
                <span>0{idx + 1}</span>
                <span>{card.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── FRAMED 6-CARD HORIZONTAL TRACK (ZERO CLIPPED CARDS) ─── */}
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 w-full my-auto py-2">
          <div 
            ref={trackWrapperRef}
            className="w-full overflow-x-auto lg:overflow-hidden snap-x snap-mandatory lg:snap-none scrollbar-none rounded-3xl"
          >
            <div 
              ref={trackRef}
              className="flex items-stretch gap-6 will-change-transform"
            >
              {cards.map((card, idx) => {
                const Icon = card.icon;
                const isCurrent = activeCard === idx;
                return (
                  <div
                    key={card.id}
                    className={`w-[calc(100vw-3rem)] max-w-[420px] sm:w-[380px] lg:w-[calc((100%-24px)/2)] xl:w-[calc((100%-48px)/3)] shrink-0 snap-center rounded-3xl rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 border transition-all duration-300 flex flex-col justify-between relative overflow-hidden text-slate-900 dark:text-slate-100 shadow-lg ${
                      isCurrent 
                        ? 'border-red-500/80 dark:border-red-500/70 shadow-red-500/10 scale-[1.005]' 
                        : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Subtle Ambient Card Gradient */}
                    <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${card.accent} opacity-5 dark:opacity-10 rounded-full blur-2xl pointer-events-none`} />

                    <div>
                      {/* Category Pill & Icon */}
                      <div className="flex items-center justify-between mb-3.5">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {card.category}
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-900 dark:text-white shadow-2xs">
                          <Icon size={17} className="text-red-600 dark:text-red-400" />
                        </div>
                      </div>

                      {/* Title & Description with break-words to guarantee complete visibility */}
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2 break-words leading-snug">
                        {card.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal mb-3.5 min-h-[40px] break-words">
                        {card.description}
                      </p>

                      {/* Mockup Box */}
                      {card.mockup}

                      {/* 3 Metric Pills */}
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3.5">
                        {card.stats.map((stat, sIdx) => (
                          <div key={sIdx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 text-center">
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-words">{stat.label}</div>
                            <div className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5 break-words">{stat.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Feature Checkpoints */}
                      <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        {card.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            <span className="break-words">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Card Action */}
                    <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        MODULE 0{idx + 1} OF 0{cards.length}
                      </span>
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
        </div>

        {/* Mobile Swipe Controls: Prev/Next & Dots (< 1024px) */}
        <div className="flex lg:hidden items-center justify-between mt-2 px-4 sm:px-6">
          <div className="flex items-center gap-1.5">
            {cards.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => handleJumpToCard(dotIdx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  activeCard === dotIdx ? 'w-6 bg-red-600' : 'w-2 bg-slate-300 dark:bg-slate-700'
                }`}
                aria-label={`Jump to card ${dotIdx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleMobileScroll('prev')}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs cursor-pointer"
              aria-label="Previous card"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleMobileScroll('next')}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs cursor-pointer"
              aria-label="Next card"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Bottom Helper Bar on Desktop */}
        <div className="hidden lg:flex max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 w-full shrink-0 pt-1.5 items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
          <span>← Scroll vertically, use module tabs or arrows to slide through all 6 capabilities →</span>
          <span>Zero half-visible cards • Fully framed in container</span>
        </div>
      </div>
    </section>
  );
}
