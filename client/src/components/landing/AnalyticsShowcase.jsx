import React, { useState, useRef } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Activity, 
  Calendar, 
  Filter, 
  Download, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AnalyticsShowcase() {
  const [activeChart, setActiveChart] = useState('revenue');
  const [selectedTimeframe, setSelectedTimeframe] = useState('H1 FY26');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -y * 6, y: x * 6 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Revenue vs Target Data
  const revenuePoints = [
    { label: 'Jan', actual: 42, target: 38, margin: 64.2, variance: '+10.5%' },
    { label: 'Feb', actual: 58, target: 50, margin: 66.8, variance: '+16.0%' },
    { label: 'Mar', actual: 72, target: 65, margin: 65.4, variance: '+10.7%' },
    { label: 'Apr', actual: 89, target: 78, margin: 67.9, variance: '+14.1%' },
    { label: 'May', actual: 94, target: 85, margin: 68.1, variance: '+10.6%' },
    { label: 'Jun', actual: 118, target: 100, margin: 69.5, variance: '+18.0%' },
  ];

  // Regional Performance Data
  const regionalData = [
    { region: 'South Region (HQ & 48 Hubs)', revenue: '₹3.82 Cr', target: '₹3.50 Cr', percent: 109, growth: '+28.4%' },
    { region: 'North Region (32 Franchise Hubs)', revenue: '₹2.41 Cr', target: '₹2.30 Cr', percent: 105, growth: '+22.1%' },
    { region: 'West Region (24 Franchise Hubs)', revenue: '₹1.59 Cr', target: '₹1.50 Cr', percent: 106, growth: '+18.7%' },
    { region: 'East Region (16 Franchise Hubs)', revenue: '₹0.61 Cr', target: '₹0.60 Cr', percent: 102, growth: '+12.4%' },
  ];

  // Product Category Mix Data
  const categoryMix = [
    { name: 'Enterprise Franchise Licensure', share: 42, color: '#D91542', revenue: '₹3.54 Cr' },
    { name: 'Core Retail Inventory Billing', share: 28, color: '#F43F5E', revenue: '₹2.36 Cr' },
    { name: 'B2B Wholesale Operations', share: 18, color: '#FB7185', revenue: '₹1.52 Cr' },
    { name: 'Digital Services & Subscriptions', share: 12, color: '#FDA4AF', revenue: '₹1.01 Cr' },
  ];

  return (
    <section 
      id="analytics" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="py-20 lg:py-28 bg-slate-50/60 dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800"
      style={{ perspective: '1400px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <BarChart3 size={14} className="text-red-600 dark:text-red-400" />
            <span>Interactive Data Studio</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Deep-Dive Visualizations for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Immediate Clarity
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Move beyond static PDF printouts. Interactively explore franchise revenue trajectories, profit variances, and SKU velocity with sub-second recalculation.
          </p>

          {/* Visualization Mode Selector */}
          <div className="mt-8 inline-flex flex-wrap justify-center p-1.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs gap-1">
            <button
              type="button"
              onClick={() => setActiveChart('revenue')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeChart === 'revenue'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp size={15} />
              <span>Revenue Trajectory &amp; Target Pacing</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveChart('regional')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeChart === 'regional'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 size={15} />
              <span>Franchise Regional Distribution</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveChart('category')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeChart === 'category'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PieChart size={15} />
              <span>Product &amp; Channel Mix</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveChart('telemetry')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeChart === 'telemetry'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity size={15} />
              <span>Ingestion Stream Telemetry</span>
            </button>
          </div>
        </div>

        {/* Visual Showcase Stage Container with 3D Mouse Parallax */}
        <div 
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden transition-transform duration-300 ease-out"
          style={{
            transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
        >
          {/* Top Stage Control Header */}
          <div 
            className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50"
            style={{ transform: 'translateZ(15px)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Live Interactive Visualizer • {selectedTimeframe}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Time Horizon:</span>
              {['Q1 FY26', 'Q2 FY26', 'H1 FY26', 'Full Year'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTimeframe(t)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    selectedTimeframe === t
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Chart Canvas Body */}
          <div className="p-6 sm:p-10" style={{ transformStyle: 'preserve-3d' }}>
            {/* View 1: Revenue Trajectory & Target Pacing */}
            {activeChart === 'revenue' && (
              <div style={{ transform: 'translateZ(25px)' }}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Invoiced Revenue vs Target Trajectory (INR in Lakhs)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Hover over any month to inspect variance surplus and EBITDA margin %
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <span className="w-3 h-3 rounded bg-red-600" />
                      <span>Actual Invoiced</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400" />
                      <span>Forecast Target Baseline</span>
                    </div>
                  </div>
                </div>

                {/* SVG High-Precision Chart */}
                <div className="relative w-full h-72 sm:h-80 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-end">
                  {/* Grid Lines */}
                  <div className="absolute inset-x-4 inset-y-6 flex flex-col justify-between pointer-events-none opacity-40">
                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700 flex justify-between text-[10px] text-slate-400 -mt-2"><span>120L</span></div>
                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700 flex justify-between text-[10px] text-slate-400 -mt-2"><span>90L</span></div>
                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700 flex justify-between text-[10px] text-slate-400 -mt-2"><span>60L</span></div>
                    <div className="border-b border-dashed border-slate-300 dark:border-slate-700 flex justify-between text-[10px] text-slate-400 -mt-2"><span>30L</span></div>
                    <div className="border-b border-slate-300 dark:border-slate-700 flex justify-between text-[10px] text-slate-400"><span>0L</span></div>
                  </div>

                  {/* SVG Area & Bars */}
                  <div className="relative w-full h-full flex items-end justify-between px-4 sm:px-8 z-10">
                    {revenuePoints.map((item, idx) => {
                      const barHeight = `${(item.actual / 130) * 100}%`;
                      const targetHeight = `${(item.target / 130) * 100}%`;
                      const isHovered = hoveredIndex === idx;

                      return (
                        <div
                          key={item.label}
                          onMouseEnter={() => setHoveredIndex(idx)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                        >
                          {/* Floating Tooltip */}
                          {isHovered && (
                            <div className="absolute -top-16 z-30 bg-slate-900 text-white dark:bg-white dark:text-slate-900 p-2.5 rounded-xl shadow-2xl text-center whitespace-nowrap animate-fadeIn text-xs border border-slate-700 dark:border-slate-200">
                              <div className="font-bold">{item.label} FY26: ₹{item.actual}L</div>
                              <div className="text-[10px] opacity-80">Target: ₹{item.target}L • Margin: {item.margin}%</div>
                              <div className="text-[10px] font-bold text-emerald-400 dark:text-emerald-600">{item.variance} vs plan</div>
                            </div>
                          )}

                          {/* Target Dotted Marker */}
                          <div 
                            className="absolute w-8 sm:w-12 border-t-2 border-dashed border-slate-400 dark:border-slate-500 z-10 transition-all"
                            style={{ bottom: targetHeight }}
                          />

                          {/* Actual Bar with Spring Elevation */}
                          <div
                            className={`w-7 sm:w-12 rounded-t-xl transition-all duration-300 ${
                              isHovered
                                ? 'bg-gradient-to-t from-red-700 to-rose-500 shadow-xl shadow-red-600/50 scale-105'
                                : 'bg-gradient-to-t from-red-600 to-red-500 hover:from-red-600 hover:to-rose-400'
                            }`}
                            style={{ height: barHeight }}
                          />

                          {/* Month Label */}
                          <span className={`mt-3 text-xs font-bold transition-colors ${
                            isHovered ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-KPI Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 hover:border-red-400/40 transition-colors">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Invoiced (H1)</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">₹8.43 Cr</div>
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+14.2% Variance Surplus</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 hover:border-red-400/40 transition-colors">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Target Benchmark</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">₹7.50 Cr</div>
                    <div className="text-[10px] font-bold text-slate-500 mt-0.5">112.4% Achievement</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 hover:border-red-400/40 transition-colors">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Peak Month (Jun)</div>
                    <div className="text-xl font-black text-red-600 dark:text-red-400 font-mono mt-0.5">₹1.18 Cr</div>
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+29.4% YoY Run-Rate</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 hover:border-red-400/40 transition-colors">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">EBITDA Conversion</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">68.4%</div>
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+3.4% vs Benchmark</div>
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Franchise Regional Distribution */}
            {activeChart === 'regional' && (
              <div style={{ transform: 'translateZ(25px)' }}>
                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Regional Franchise Network Breakdown (48 Enterprise Hubs)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time transaction tracking across state clusters and branch hierarchies
                  </p>
                </div>

                <div className="space-y-4">
                  {regionalData.map((reg) => (
                    <div
                      key={reg.region}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 hover:border-red-300 dark:hover:border-red-900 hover:shadow-md transition-all group"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {reg.region}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{reg.revenue}</span>
                          <span className="text-slate-400">Target: {reg.target}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/80">
                            {reg.growth}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar with smooth fill */}
                      <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-500 transition-all duration-700"
                          style={{ width: `${Math.min(reg.percent, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-mono">
                        <span>Pacing: {reg.percent}% of target achieved</span>
                        <span>Telemetry: 100% reporting live</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View 3: Product & Channel Mix */}
            {activeChart === 'category' && (
              <div style={{ transform: 'translateZ(25px)' }}>
                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Revenue Contribution by Business Channel
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Proportional revenue split across retail, B2B wholesale, and franchise licensure
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  {/* Visual SVG Donut Graphic */}
                  <div className="flex justify-center items-center relative py-4">
                    <svg className="w-56 h-56 -rotate-90 hover:scale-105 transition-transform duration-300" viewBox="0 0 100 100">
                      {/* Segment 1: 42% */}
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#D91542" strokeWidth="16" strokeDasharray="100.2 138.8" strokeDashoffset="0" />
                      {/* Segment 2: 28% */}
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#F43F5E" strokeWidth="16" strokeDasharray="66.8 172.2" strokeDashoffset="-100.2" />
                      {/* Segment 3: 18% */}
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#FB7185" strokeWidth="16" strokeDasharray="43.0 196.0" strokeDashoffset="-167" />
                      {/* Segment 4: 12% */}
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#FDA4AF" strokeWidth="16" strokeDasharray="28.6 210.4" strokeDashoffset="-210" />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">₹8.43 Cr</span>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gross Revenue</span>
                    </div>
                  </div>

                  {/* Category Legend & Breakdown */}
                  <div className="space-y-3.5">
                    {categoryMix.map((item) => (
                      <div
                        key={item.name}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between hover:scale-102 transition-transform"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.revenue}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900 dark:text-white font-mono">{item.share}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* View 4: Ingestion Stream Telemetry */}
            {activeChart === 'telemetry' && (
              <div style={{ transform: 'translateZ(25px)' }}>
                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Live Event Ingestion Waveform &amp; Ingestion Cluster Health
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Streaming 1,200,000+ data events/hour with zero buffer backpressure
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-slate-950 text-white font-mono border border-slate-800 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="font-bold text-emerald-400">INGESTION_CLUSTER: US-EAST-01 &amp; HYD-HQ</span>
                    </div>
                    <span className="text-slate-400">Pipeline Status: Optimal • Zero Latency</span>
                  </div>

                  {/* Animated Waveform Visual */}
                  <div className="h-32 flex items-center justify-between gap-1 px-2 mb-4">
                    {[40, 65, 80, 55, 90, 75, 45, 95, 85, 60, 70, 85, 100, 90, 75, 60, 85, 95, 70, 50, 80, 90, 65, 85, 95, 75, 60, 90].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-red-600 to-rose-400 rounded-full transition-all duration-300 hover:scale-y-110"
                        style={{ height: `${h}%`, opacity: 0.35 + (h / 100) * 0.65 }}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-3 border-t border-slate-800 text-slate-300">
                    <div>
                      <div className="text-slate-500">P99 Query Latency</div>
                      <div className="text-base font-bold text-white mt-0.5">142 ms</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Throughput</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">14,200 ev/s</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Active CDC Pipes</div>
                      <div className="text-base font-bold text-white mt-0.5">16 Sinks</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Buffer Health</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">100% NOMINAL</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Bottom Metric Bar */}
        <div className="mt-10 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Ready to explore your enterprise metrics in this visual environment?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create a workspace in 60 seconds with our pre-loaded enterprise template dataset.
              </p>
            </div>
          </div>

          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-red-600/20 transition-all cursor-pointer hover:scale-105"
          >
            <span>Launch Live Interactive Cockpit</span>
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
