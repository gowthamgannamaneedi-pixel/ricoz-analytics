import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Play, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Database, 
  Layers, 
  Zap, 
  Activity, 
  BarChart3, 
  FileText, 
  AlertTriangle,
  Cpu,
  RefreshCw,
  Search,
  Filter,
  Download,
  Share2,
  Lock,
  Building2,
  Sliders,
  Calculator
} from 'lucide-react';
import { useCounter } from './useScrollAnimation';
import Hero3DCanvas from './Hero3DCanvas';

export default function LandingHero({ onOpenDemo }) {
  const [activeTab, setActiveTab] = useState('executive');
  const [hoveredMonth, setHoveredMonth] = useState('Jun');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, normX: 0, normY: 0 });
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef(null);

  // Animated counters
  const revenueNum = useCounter(84200000, 0, true, 1600);
  const hubsNum = useCounter(48, 0, true, 1200);
  const marginNum = useCounter(68.4, 1, true, 1400);

  // Mouse move handler for Hero 3D Parallax Tilt
  const handleMouseMove = (e) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normX = (x / rect.width) * 2 - 1; // -1 to 1
    const normY = (y / rect.height) * 2 - 1; // -1 to 1
    setMousePos({ x, y, normX, normY });
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const monthlyData = [
    { month: 'Jan', val: 42, target: 38, margin: '64.2%', variance: '+10.5%' },
    { month: 'Feb', val: 58, target: 50, margin: '66.8%', variance: '+16.0%' },
    { month: 'Mar', val: 72, target: 65, margin: '65.4%', variance: '+10.7%' },
    { month: 'Apr', val: 89, target: 78, margin: '67.9%', variance: '+14.1%' },
    { month: 'May', val: 94, target: 85, margin: '68.1%', variance: '+10.6%' },
    { month: 'Jun', val: 118, target: 100, margin: '69.5%', variance: '+18.0%' },
  ];

  const currentHovered = monthlyData.find(m => m.month === hoveredMonth) || monthlyData[5];

  // Calculate 3D perspective tilt angles
  const scrollFlattenFactor = Math.max(0, 1 - scrollY / 600);
  const tiltX = -mousePos.normY * 9 * scrollFlattenFactor;
  const tiltY = mousePos.normX * 9 * scrollFlattenFactor;

  const headlineWords = [
    { text: 'Turn', highlight: false },
    { text: 'Business', highlight: false },
    { text: 'Data', highlight: false },
    { text: 'Into', highlight: false },
    { text: 'Clear', highlight: true },
    { text: 'Operational', highlight: true },
    { text: 'Decisions', highlight: true },
  ];

  return (
    <section 
      ref={heroRef}
      onMouseMove={handleMouseMove}
      className="relative pt-10 pb-20 md:pt-16 md:pb-32 overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-white dark:from-[#0B0F19] dark:via-slate-900/60 dark:to-[#0B0F19] transition-colors duration-200"
    >
      {/* Three.js Interactive 3D Background Canvas (Original Design) */}
      <Hero3DCanvas />

      {/* Architectural Grid */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-70 dark:opacity-25" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Trust Pill Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-md hover:border-red-500/50 transition-colors duration-200 cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            <span className="uppercase tracking-wider font-mono text-[11px] text-red-600 dark:text-red-400 font-bold">Business Intelligence</span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <span className="text-slate-600 dark:text-slate-400 hidden sm:inline font-normal">Fast, Governed SaaS Analytics</span>
          </div>
        </div>

        {/* Hero Headline */}
        <div className="max-w-4xl mx-auto text-center space-y-5 mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.18] flex flex-wrap justify-center gap-x-3 gap-y-1">
            {headlineWords.map((word, idx) => (
              <span key={idx} className="overflow-hidden inline-block align-bottom py-0.5">
                <span
                  className={`inline-block transition-all duration-700 ${
                    word.highlight
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700 dark:from-red-500 dark:via-rose-400 dark:to-red-400'
                      : ''
                  }`}
                  style={{
                    animation: `maskSlideUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 55}ms both`,
                  }}
                >
                  {word.text}
                </span>
              </span>
            ))}
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            RicozAnalytics connects databases, APIs, and spreadsheets into a unified reporting interface—monitoring key business KPIs, projecting operational trends, and delivering scheduled executive digests.
          </p>

          {/* Two Clear Primary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base transition-all duration-200 shadow-xl shadow-red-600/25 hover:shadow-red-600/40 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer overflow-hidden"
            >
              <span className="relative z-10">Start 14-Day Free Trial</span>
              <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href="#product"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-bold text-base border border-slate-200 dark:border-slate-800 backdrop-blur-md transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
            >
              <Play size={15} className="text-red-600 fill-red-600" />
              <span>Explore Interactive Demo</span>
            </a>
          </div>

          {/* Reassurance Trust Pills */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 pt-4 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 
              <span>Direct PostgreSQL &amp; MongoDB connectors</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 
              <span>Standardized formula KPI studio</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 
              <span>Server-enforced RBAC &amp; AES-256 encryption</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 
              <span>Automated threshold anomaly alerts</span>
            </span>
          </div>
        </div>

        {/* ─── ENTERPRISE DASHBOARD COCKPIT CONTAINER ─────────────── */}
        <div className="relative mt-8 max-w-6xl mx-auto">
          {/* Floating Status Badge 1: Top Right */}
          <div className="hidden lg:flex items-center gap-2.5 absolute -top-4 right-4 z-40 px-4 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-lg text-xs font-medium text-slate-800 dark:text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles size={15} />
            </div>
            <div>
              <div className="font-bold text-[11px] text-slate-900 dark:text-white flex items-center gap-1">
                <span>Threshold Sentinel</span>
                <span className="text-emerald-500 font-mono">0 Breaches</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Multi-metric monitoring active</div>
            </div>
          </div>

          {/* Floating Status Badge 2: Bottom Left */}
          <div className="hidden lg:flex items-center gap-2.5 absolute -bottom-4 left-4 z-40 px-4 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-lg text-xs text-slate-800 dark:text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 flex items-center justify-center shrink-0">
              <Activity size={15} />
            </div>
            <div>
              <div className="font-bold text-[11px] text-slate-900 dark:text-white">Data Connection Active</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">PostgreSQL &amp; MongoDB Verified</div>
            </div>
          </div>

          {/* Main Dashboard Chassis */}
          <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
            {/* Window Browser Titlebar */}
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
              </div>

              {/* Address / Breadcrumb Bar */}
              <div className="flex items-center gap-2 px-4 py-1 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300 max-w-sm w-full justify-center shadow-2xs">
                <Lock size={12} className="text-emerald-500" />
                <span className="truncate">ricoz.app/workspace/executive-cockpit</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider hidden sm:inline">
                  DEMO WORKSPACE
                </span>
              </div>
            </div>

            {/* Dashboard Sub-Header & Controls */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Building2 size={15} className="text-red-600 dark:text-red-500" />
                  <span>Retail Network HQ (48 Hubs • Sample Data)</span>
                </div>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500 dark:text-slate-400 font-mono hidden md:inline">Q3 FY2026</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('executive')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    activeTab === 'executive'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
                  }`}
                >
                  Executive View
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('trajectory')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    activeTab === 'trajectory'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
                  }`}
                >
                  Data Sources
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('anomaly')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    activeTab === 'anomaly'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/60'
                  }`}
                >
                  Variance Diagnostics
                </button>
              </div>
            </div>

            {/* Main Inside Dashboard View */}
            <div className="p-5 sm:p-7 space-y-6">
              {/* 4 Realistic KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Invoiced Revenue */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-red-400 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">
                    <span>Net Invoiced Revenue</span>
                    <TrendingUp size={14} className="text-emerald-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                    ₹{revenueNum.toLocaleString('en-IN')}
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Target: ₹7.50 Cr</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">+12.3% Achieved</span>
                  </div>
                </div>

                {/* KPI 2: Gross Margin (CORRECTLY LABELLED) */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-red-400 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">
                    <span>Gross Margin (Sample)</span>
                    <Calculator size={14} className="text-red-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                    {marginNum}%
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Gross Profit: ₹5.76 Cr</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">₹0.12 Cr / Hub</span>
                  </div>
                </div>

                {/* KPI 3: Store Hubs */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-red-400 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">
                    <span>Active Store Hubs</span>
                    <Building2 size={14} className="text-blue-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                    {hubsNum} Hubs
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Sample Network</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">4 Regions</span>
                  </div>
                </div>

                {/* KPI 4: Data Connection */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-red-400 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">
                    <span>Data Connection</span>
                    <Database size={14} className="text-amber-500" />
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                    Verified Sync
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">PostgreSQL Master</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Connected</span>
                  </div>
                </div>
              </div>

              {/* Main Chart Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[340px]">
                {/* VIEW 1: EXECUTIVE COCKPIT VIEW */}
                {activeTab === 'executive' && (
                  <>
                    {/* Interactive Chart Canvas */}
                    <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between animate-fadeIn shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <BarChart3 size={16} className="text-red-600 dark:text-red-500" />
                            <span>Revenue vs Target Trajectory (H1 FY26)</span>
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Currency: INR Lakhs • Illustrative Retail Dataset</p>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Actual Invoiced
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-400" /> Target
                          </span>
                        </div>
                      </div>

                      {/* SVG Chart Graphic */}
                      <div className="relative w-full h-52 bg-white dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-end overflow-hidden shadow-inner">
                        <div className="absolute inset-x-3 inset-y-4 flex flex-col justify-between pointer-events-none">
                          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
                            <span className="text-[9px] font-mono text-slate-400 w-8 text-right font-semibold">₹120L</span>
                            <div className="flex-1" />
                          </div>
                          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
                            <span className="text-[9px] font-mono text-slate-400 w-8 text-right font-semibold">₹80L</span>
                            <div className="flex-1" />
                          </div>
                          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
                            <span className="text-[9px] font-mono text-slate-400 w-8 text-right font-semibold">₹40L</span>
                            <div className="flex-1" />
                          </div>
                          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
                            <span className="text-[9px] font-mono text-slate-400 w-8 text-right font-semibold">₹0L</span>
                            <div className="flex-1" />
                          </div>
                        </div>

                        {/* Chart Bars */}
                        <div className="relative w-full h-full flex items-end justify-between pl-10 pr-3 sm:pr-6 z-10">
                          {monthlyData.map((m) => {
                            const isHovered = hoveredMonth === m.month;
                            const heightPct = (m.val / 125) * 100;
                            const targetHeight = (m.target / 125) * 100;

                            return (
                              <div
                                key={m.month}
                                onMouseEnter={() => setHoveredMonth(m.month)}
                                className="relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer group"
                              >
                                {isHovered && (
                                  <div className="absolute -top-12 z-30 bg-slate-900 text-white px-2 py-1 rounded-md text-[10px] font-mono shadow-xl whitespace-nowrap animate-fadeIn border border-slate-700">
                                    ₹{m.val} Lakhs ({m.variance})
                                  </div>
                                )}

                                <div 
                                  className="absolute w-8 border-t-2 border-dashed border-slate-400"
                                  style={{ bottom: `${targetHeight}%` }}
                                  title={`Target: ₹${m.target}L`}
                                />

                                <div
                                  className={`w-6 sm:w-10 rounded-t transition-all duration-300 ${
                                    isHovered
                                      ? 'bg-gradient-to-t from-red-700 to-rose-400 shadow-lg shadow-red-600/40 scale-105'
                                      : 'bg-gradient-to-t from-red-600 to-red-500 hover:scale-102'
                                  }`}
                                  style={{ height: `${heightPct}%` }}
                                />

                                <span className={`mt-2 text-[10px] font-mono font-bold ${
                                  isHovered ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'
                                }`}>
                                  {m.month}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Selected Month: <strong className="text-slate-900 dark:text-white">{currentHovered.month} FY26 (₹{currentHovered.val}L)</strong></span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">+29.4% YoY Run-Rate</span>
                      </div>
                    </div>

                    {/* Regional Performance Panel */}
                    <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between animate-fadeIn shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Regional Performance</span>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">Target Met</span>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                              <span>South (HQ &amp; 48 Hubs)</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">₹3.8 Cr</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full" style={{ width: '100%' }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                              <span>North Region</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">₹2.4 Cr</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full" style={{ width: '84%' }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                              <span>West Region</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">₹1.6 Cr</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full" style={{ width: '72%' }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                              <span>East Region</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">₹0.6 Cr</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full" style={{ width: '55%' }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          <FileText size={15} className="text-red-600 dark:text-red-500" />
                          <span>Executive Reports: PDF &amp; XLSX</span>
                        </div>
                        <Link
                          to="/login"
                          className="text-red-600 dark:text-red-400 hover:text-red-700 font-bold text-[11px] flex items-center gap-1"
                        >
                          <span>View Live</span>
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  </>
                )}

                {/* VIEW 2: MULTI-SOURCE CONNECTORS */}
                {activeTab === 'trajectory' && (
                  <div className="lg:col-span-12 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 animate-fadeIn font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                        <Database size={16} className="text-red-600 dark:text-red-500" />
                        <span>Verified Multi-Source Data Connectors</span>
                      </div>
                      <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/80">
                        DIRECT CONNECTIONS ACTIVE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">PostgreSQL</div>
                        <div className="text-base font-bold text-slate-900 dark:text-white mt-1">Relational SQL</div>
                        <div className="text-emerald-600 dark:text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Client Connection
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">MongoDB</div>
                        <div className="text-base font-bold text-slate-900 dark:text-white mt-1">Document Store</div>
                        <div className="text-emerald-600 dark:text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Collection Ingestion
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">REST API</div>
                        <div className="text-base font-bold text-slate-900 dark:text-white mt-1">JSON Payloads</div>
                        <div className="text-emerald-600 dark:text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Bearer &amp; API Key
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">CSV &amp; Excel</div>
                        <div className="text-base font-bold text-slate-900 dark:text-white mt-1">Spreadsheets</div>
                        <div className="text-emerald-600 dark:text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Drag-and-Drop
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-300 shadow-2xs">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Automated schema discovery with AES-256-GCM credential encryption at rest</span>
                      </span>
                      <span className="text-red-600 dark:text-red-400 font-bold">Security Verified</span>
                    </div>
                  </div>
                )}

                {/* VIEW 3: VARIANCE DIAGNOSTICS */}
                {activeTab === 'anomaly' && (
                  <div className="lg:col-span-12 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 animate-fadeIn font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                        <Sparkles size={16} className="text-red-600 dark:text-red-500" />
                        <span>Operational Variance &amp; Threshold Monitoring</span>
                      </div>
                      <span className="text-slate-600 dark:text-slate-400 text-xs font-bold bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        Sample Analysis
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-slate-700 dark:text-slate-300 font-sans shadow-2xs">
                      <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                        DIAGNOSTIC SUMMARY // Q3 SURPLUS ATTRIBUTION
                      </div>
                      <p className="text-sm text-slate-900 dark:text-white font-medium leading-relaxed">
                        South Region revenue surged <strong className="text-emerald-600 dark:text-emerald-400">+28.4%</strong> (₹3.82 Cr vs ₹2.97 Cr planned target). Primary contributors identified across retail hubs:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Store Hub Growth</div>
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+16.2% Impact</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Bangalore &amp; Chennai hubs</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Average Basket Size</div>
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+7.4% Impact</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Retail SKU volume</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Logistics Cost Shift</div>
                        <div className="text-sm font-bold text-red-600 dark:text-red-400 mt-0.5">-2.1% Impact</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Direct freight headwind</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="flex flex-col items-center justify-center pt-8 text-slate-400">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-70">Scroll To Explore Workflow</span>
          <div className="w-px h-8 bg-gradient-to-b from-red-500 to-transparent mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
