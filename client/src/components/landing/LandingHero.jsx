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
  Sliders
} from 'lucide-react';
import { useCounter } from './useScrollAnimation';

const Hero3DCanvas = React.lazy(() => import('./Hero3DCanvas'));

export default function LandingHero({ onOpenDemo }) {
  const [activeTab, setActiveTab] = useState('executive');
  const [hoveredMonth, setHoveredMonth] = useState('Jun');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, normX: 0, normY: 0 });
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef(null);

  // Animated counters
  const revenueNum = useCounter(84280000, 0, true, 1600);
  const hubsNum = useCounter(48, 0, true, 1200);
  const marginNum = useCounter(68.4, 1, true, 1400);
  const latencyNum = useCounter(142, 0, true, 1000);

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
  // Gentle initial tilt that flattens as the user scrolls down into the page
  const scrollFlattenFactor = Math.max(0, 1 - scrollY / 600);
  const tiltX = -mousePos.normY * 9 * scrollFlattenFactor + (1 - scrollFlattenFactor) * 0;
  const tiltY = mousePos.normX * 9 * scrollFlattenFactor;

  // Staggered headline words for text-reveal animation
  const headlineWords = [
    { text: 'Turn', highlight: false },
    { text: 'Fragmented', highlight: false },
    { text: 'Business', highlight: false },
    { text: 'Data', highlight: false },
    { text: 'Into', highlight: false },
    { text: 'Unified', highlight: true },
    { text: 'Real-Time', highlight: true },
    { text: 'Action', highlight: true },
  ];

  return (
    <section 
      ref={heroRef}
      onMouseMove={handleMouseMove}
      className="relative pt-10 pb-24 md:pt-16 md:pb-36 overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-white dark:from-[#0B0F19] dark:via-slate-900/60 dark:to-[#0B0F19] transition-colors duration-200"
      style={{ perspective: '1400px' }}
    >
      {/* Three.js Interactive 3D Background Canvas (Lazy-loaded) */}
      <React.Suspense fallback={null}>
        <Hero3DCanvas />
      </React.Suspense>

      {/* Ambient Lighting & Architectural Grid (Restrained, Minimal) */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-70 dark:opacity-25" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Trust Pill Badge with Entrance Shimmer */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-2xs text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-md hover:border-red-500/50 transition-colors duration-200 cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            <span className="uppercase tracking-wider font-mono text-[11px] text-red-600 dark:text-red-400 font-bold">Enterprise Intelligence</span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <span className="text-slate-600 dark:text-slate-400 hidden sm:inline font-normal">Next-Gen Real-Time Analytics</span>
          </div>
        </div>

        {/* Hero Headline with Animated Word Reveal */}
        <div className="max-w-4xl mx-auto text-center space-y-5 mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15] flex flex-wrap justify-center gap-x-3 gap-y-1">
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
            RicozAnalytics connects databases, warehouses, and spreadsheets into a sovereign intelligence cockpit—monitoring enterprise KPIs, projecting AI forecasts, and delivering automated leadership digests in real-time.
          </p>

          {/* Two Clear Primary CTAs as Specified */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base transition-all duration-200 shadow-xl shadow-red-600/25 hover:shadow-red-600/40 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer overflow-hidden"
            >
              <span className="relative z-10">Start Free Trial</span>
              <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href="#product"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl bg-white/90 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-bold text-base border border-slate-200 dark:border-slate-800 backdrop-blur-md transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
            >
              <Play size={15} className="text-red-600 fill-red-600" />
              <span>Explore Platform</span>
            </a>
          </div>

          {/* Reassurance Trust Pills */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 pt-4 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 
              <span>Sub-second multi-source queries</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 
              <span>Zero-code KPI metric builder</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 
              <span>Enterprise RBAC &amp; TLS Encryption</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 
              <span>Real-time anomaly AI alerts</span>
            </span>
          </div>
        </div>

        {/* ─── NEXT-GEN 3D INTERACTIVE DASHBOARD CONTAINER ──────────────── */}
        <div 
          className="relative mt-10 max-w-6xl mx-auto transition-transform duration-200 ease-out"
          style={{
            transform: `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
        >
          {/* Subtle Floating Dashboard Element 1: Top Right (Parallax Layer +60px) */}
          <div 
            className="hidden lg:flex items-center gap-2.5 absolute -top-7 -right-6 z-40 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl text-xs font-medium text-slate-800 dark:text-slate-200 transition-transform duration-300 ease-out"
            style={{
              transform: `translate3d(${mousePos.normX * 24}px, ${mousePos.normY * 18}px, 60px)`,
            }}
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles size={15} />
            </div>
            <div>
              <div className="font-bold text-[11px] text-slate-900 dark:text-white flex items-center gap-1">
                <span>Autonomous Sentinel</span>
                <span className="text-emerald-500 font-mono">0 Breaches</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">1.2M events/hr • 14ms latency</div>
            </div>
          </div>

          {/* Subtle Floating Dashboard Element 2: Bottom Left (Parallax Layer +50px) */}
          <div 
            className="hidden lg:flex items-center gap-2.5 absolute -bottom-6 -left-6 z-40 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl text-xs text-slate-800 dark:text-slate-200 transition-transform duration-300 ease-out"
            style={{
              transform: `translate3d(${-mousePos.normX * 22}px, ${-mousePos.normY * 16}px, 50px)`,
            }}
          >
            <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 flex items-center justify-center shrink-0">
              <Activity size={15} />
            </div>
            <div>
              <div className="font-bold text-[11px] text-slate-900 dark:text-white">Continuous Zero-ETL Sync</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">PostgreSQL &amp; Snowflake Active</div>
            </div>
          </div>

          {/* Main 3D Dashboard Chassis */}
          <div 
            className="rounded-3xl bg-slate-950 border border-slate-800 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Window Browser Titlebar */}
            <div 
              className="px-4 py-3 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-4"
              style={{ transform: 'translateZ(15px)' }}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
              </div>

              {/* Address / Breadcrumb Bar */}
              <div className="flex items-center gap-2 px-4 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 max-w-sm w-full justify-center">
                <Lock size={12} className="text-emerald-400" />
                <span className="truncate">ricoz.app/workspace/enterprise-cockpit</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider hidden sm:inline">
                  LIVE STREAMING
                </span>
              </div>
            </div>

            {/* Dashboard Sub-Header & Controls (Layer +25px) */}
            <div 
              className="px-5 py-3.5 bg-slate-900/50 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs"
              style={{ transform: 'translateZ(25px)' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Building2 size={15} className="text-red-500" />
                  <span>Ricoz Network HQ (All 48 Enterprise Hubs)</span>
                </div>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-mono hidden md:inline">Q3 FY2026 (Live Streaming)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('executive')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    activeTab === 'executive'
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  Executive Cockpit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('trajectory')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    activeTab === 'trajectory'
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  Multi-Source ETL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('anomaly')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                    activeTab === 'anomaly'
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  AI Anomaly Copilot
                </button>
              </div>
            </div>

            {/* Main Inside Dashboard View */}
            <div className="p-5 sm:p-7 space-y-6" style={{ transformStyle: 'preserve-3d' }}>
              {/* 4 Realistic KPI Cards (Layer +35px) */}
              <div 
                className="grid grid-cols-2 lg:grid-cols-4 gap-4"
                style={{ transform: 'translateZ(35px)' }}
              >
                {/* KPI 1: Invoiced Revenue */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between hover:border-red-500/50 transition-colors">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                    <span>Net Invoiced Revenue</span>
                    <TrendingUp size={14} className="text-emerald-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                    ₹{revenueNum.toLocaleString('en-IN')}
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400">Target: ₹7.50 Cr</span>
                    <span className="font-bold text-emerald-400">112% Achieved</span>
                  </div>
                </div>

                {/* KPI 2: Operating Margin */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between hover:border-red-500/50 transition-colors">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                    <span>Operating Margin (EBITDA)</span>
                    <Sliders size={14} className="text-red-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                    {marginNum}%
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400">Benchmark: &gt; 65.0%</span>
                    <span className="font-bold text-emerald-400">+3.4% Surplus</span>
                  </div>
                </div>

                {/* KPI 3: Franchise Hubs */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between hover:border-red-500/50 transition-colors">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                    <span>Active Franchise Hubs</span>
                    <Building2 size={14} className="text-blue-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                    {hubsNum} Hubs
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400">100% Operational</span>
                    <span className="font-bold text-emerald-400">Zero Drops</span>
                  </div>
                </div>

                {/* KPI 4: Ingestion Latency */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between hover:border-red-500/50 transition-colors">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                    <span>P99 Query Latency</span>
                    <Zap size={14} className="text-amber-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                    {latencyNum} ms
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400">1.2M events/hr</span>
                    <span className="font-bold text-emerald-400">Sub-second</span>
                  </div>
                </div>
              </div>

              {/* Main Interactive Chart & Side Panel Row (Layer +30px) */}
              <div 
                className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[340px]"
                style={{ transform: 'translateZ(30px)' }}
              >
                {/* VIEW 1: EXECUTIVE COCKPIT VIEW */}
                {activeTab === 'executive' && (
                  <>
                    {/* Interactive Chart Canvas (8 cols) */}
                    <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between animate-fadeIn">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <BarChart3 size={16} className="text-red-500" />
                            <span>Revenue vs Target Trajectory (H1 FY26)</span>
                          </h3>
                          <p className="text-[11px] text-slate-300">Currency: INR Lakhs • Real-time audit verified</p>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Actual Invoiced
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-400" /> Target
                          </span>
                        </div>
                      </div>

                      {/* SVG Chart Graphic with Animated Drawing & Y-Axis Scale */}
                      <div className="relative w-full h-52 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex flex-col justify-end overflow-hidden">
                        {/* Y-Axis Scale Values & Grid lines */}
                        <div className="absolute inset-x-3 inset-y-4 flex flex-col justify-between pointer-events-none">
                          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                            <span className="text-[9px] font-mono text-slate-500 w-8 text-right">₹120L</span>
                            <div className="flex-1" />
                          </div>
                          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                            <span className="text-[9px] font-mono text-slate-500 w-8 text-right">₹80L</span>
                            <div className="flex-1" />
                          </div>
                          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                            <span className="text-[9px] font-mono text-slate-500 w-8 text-right">₹40L</span>
                            <div className="flex-1" />
                          </div>
                          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                            <span className="text-[9px] font-mono text-slate-500 w-8 text-right">₹0L</span>
                            <div className="flex-1" />
                          </div>
                        </div>

                        {/* Chart Bars & Interactive Markers */}
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
                                  <div className="absolute -top-12 z-30 bg-slate-900 border border-red-500 text-white px-2 py-1 rounded-md text-[10px] font-mono shadow-xl whitespace-nowrap animate-fadeIn">
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
                                      ? 'bg-gradient-to-t from-red-700 to-rose-400 shadow-xl shadow-red-600/60 scale-105'
                                      : 'bg-gradient-to-t from-red-600 to-red-500 hover:scale-102'
                                  }`}
                                  style={{ height: `${heightPct}%` }}
                                />

                                <span className={`mt-2 text-[10px] font-mono font-bold ${
                                  isHovered ? 'text-red-400' : 'text-slate-300'
                                }`}>
                                  {m.month}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800 text-[11px] text-slate-400">
                        <span>Active Selected: <strong className="text-white">{currentHovered.month} FY26 (₹{currentHovered.val}L)</strong></span>
                        <span className="text-emerald-400 font-bold">+29.4% Growth vs Prev Year</span>
                      </div>
                    </div>

                    {/* Right Regional Performance Panel (4 cols) */}
                    <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between animate-fadeIn">
                      <div>
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                          <span className="text-xs font-bold text-white">Regional Performance</span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">100% Target Met</span>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs text-slate-300 mb-1">
                              <span>South (HQ &amp; 48 Hubs)</span>
                              <span className="font-mono font-bold text-white">₹3.8 Cr</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full" style={{ width: '100%' }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-300 mb-1">
                              <span>North Region</span>
                              <span className="font-mono font-bold text-white">₹2.4 Cr</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full" style={{ width: '84%' }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-300 mb-1">
                              <span>West Region</span>
                              <span className="font-mono font-bold text-white">₹1.6 Cr</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full" style={{ width: '72%' }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-slate-300 mb-1">
                              <span>East Region</span>
                              <span className="font-mono font-bold text-white">₹0.6 Cr</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full" style={{ width: '55%' }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-300">
                          <FileText size={15} className="text-red-500" />
                          <span>Executive Briefing: PDF &amp; XLSX</span>
                        </div>
                        <Link
                          to="/login"
                          className="text-red-400 hover:text-red-300 font-bold text-[11px] flex items-center gap-1"
                        >
                          <span>View Live</span>
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  </>
                )}

                {/* VIEW 2: MULTI-SOURCE ZERO-ETL VIEW */}
                {activeTab === 'trajectory' && (
                  <div className="lg:col-span-12 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4 animate-fadeIn font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-white font-bold">
                        <Database size={16} className="text-red-500" />
                        <span>Federated Multi-Source Connectors (Zero-ETL Fabric)</span>
                      </div>
                      <span className="text-emerald-400 text-xs font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/80">
                        P99 Latency: 142ms • Zero Data Drops
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-slate-400 text-[11px]">PostgreSQL Master</div>
                        <div className="text-base font-bold text-white mt-1">42,890 evt/sec</div>
                        <div className="text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live CDC Streaming
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-slate-400 text-[11px]">Snowflake DW</div>
                        <div className="text-base font-bold text-white mt-1">1.2 TB Ingestion</div>
                        <div className="text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Zero-Copy Pushdown
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-slate-400 text-[11px]">MongoDB Shards</div>
                        <div className="text-base font-bold text-white mt-1">18 Cluster Nodes</div>
                        <div className="text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Read Replica Sync
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-slate-400 text-[11px]">Webhook Streams</div>
                        <div className="text-base font-bold text-white mt-1">214 ms Avg Latency</div>
                        <div className="text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Event Gateway OK
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Active Telemetry: 100% of 48 Franchise branch stores streaming without backpressure</span>
                      </span>
                      <span className="text-red-400 font-bold">Audit Verified</span>
                    </div>
                  </div>
                )}

                {/* VIEW 3: AI ANOMALY COPILOT VIEW */}
                {activeTab === 'anomaly' && (
                  <div className="lg:col-span-12 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4 animate-fadeIn font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-white font-bold">
                        <Sparkles size={16} className="text-red-500" />
                        <span>Autonomous AI Anomaly Sentinel &amp; Root-Cause Copilot</span>
                      </div>
                      <span className="text-red-400 text-xs font-bold bg-red-950/80 px-2.5 py-1 rounded-lg border border-red-800/80">
                        Confidence: 99.4% (p &lt; 0.01)
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-slate-300 font-sans">
                      <div className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                        DIAGNOSTIC SUMMARY // Q3 SURPLUS ATTRIBUTION
                      </div>
                      <p className="text-sm text-white font-medium leading-relaxed">
                        South Region revenue surged <strong className="text-emerald-400">+28.4%</strong> (₹3.82 Cr vs ₹2.97 Cr target). Autonomous variance decomposition attributes 65% of expansion to high-ticket reorders across 14 newly provisioned Bangalore and Chennai franchise nodes.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Node Expansion Driver</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">+16.2% Impact</div>
                        <div className="text-[10px] text-slate-500 mt-1">Bangalore &amp; Chennai hubs</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Basket Size Acceleration</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">+7.4% Impact</div>
                        <div className="text-[10px] text-slate-500 mt-1">Enterprise SKU upgrade</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Fuel &amp; Freight Headwind</div>
                        <div className="text-sm font-bold text-red-400 mt-0.5">-2.1% Impact</div>
                        <div className="text-[10px] text-slate-500 mt-1">Absorbed by gross margin</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Stellar-style Architectural Scroll Indicator */}
        <div className="flex flex-col items-center justify-center pt-8 text-slate-400">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-70">Scroll To Explore Workflow</span>
          <div className="w-px h-8 bg-gradient-to-b from-red-500 to-transparent mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
