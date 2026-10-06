import React, { useState } from 'react';
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
  FileSpreadsheet, 
  AlertTriangle,
  Cpu,
  RefreshCw,
  Search,
  Filter,
  Download
} from 'lucide-react';

export default function LandingHero({ onOpenDemo }) {
  const [activeTab, setActiveTab] = useState('executive');

  // Interactive mock data for the in-hero live preview
  const monthlyRevenueData = [
    { month: 'Jan', val: 42, target: 38 },
    { month: 'Feb', val: 58, target: 50 },
    { month: 'Mar', val: 72, target: 65 },
    { month: 'Apr', val: 89, target: 78 },
    { month: 'May', val: 94, target: 85 },
    { month: 'Jun', val: 118, target: 100 },
  ];

  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-white dark:from-[#0B0F19] dark:via-slate-900/50 dark:to-[#0B0F19] transition-colors duration-200">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-12 left-1/4 w-96 h-96 bg-red-500/5 dark:bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute top-28 right-1/4 w-[28rem] h-[28rem] bg-red-600/5 dark:bg-red-600/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Pill Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200/80 dark:border-red-900/50 shadow-sm text-red-700 dark:text-red-300 text-xs sm:text-sm font-semibold tracking-wide">
            <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            <span className="uppercase tracking-wider">Enterprise Data Intelligence Platform</span>
            <span className="text-red-400 dark:text-red-500">|</span>
            <span className="text-slate-600 dark:text-slate-300 hidden sm:inline font-normal">Next-Gen Real-Time Analytics</span>
          </div>
        </div>

        {/* Main Display Headline */}
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
            Turn Fragmented Business Data Into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-red-600 to-rose-700 dark:from-red-500 dark:via-rose-400 dark:to-red-400">
              Unified Real-Time Action
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            RicozAnalytics connects your databases, monitors enterprise KPIs, builds high-performance dashboards, generates automated executive reports, and triggers proactive AI alerts—all in one sovereign workspace.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base transition-all duration-200 shadow-lg shadow-red-600/25 hover:shadow-red-600/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Launch Free Workspace</span>
              <ArrowRight size={18} />
            </Link>

            <button
              onClick={onOpenDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-base transition-all duration-200 shadow-sm hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer"
            >
              <Play size={16} className="text-red-600 dark:text-red-400 fill-red-600 dark:fill-red-400" />
              <span>Schedule Enterprise Demo</span>
            </button>
          </div>

          {/* Trust Value Badges — Clean Symmetrical Grid Layout */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
            <div className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Sub-second multi-source queries</span>
            </div>
            <div className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Zero code KPI metric builder</span>
            </div>
            <div className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>SOC2 &amp; Granular RBAC ready</span>
            </div>
            <div className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Real-time anomaly AI alerts</span>
            </div>
          </div>
        </div>

        {/* Live Product Preview Frame / MacBook Window Simulator */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="relative rounded-2xl bg-slate-900 p-2 sm:p-3 shadow-2xl shadow-slate-900/20 border border-slate-800">
            {/* Top Browser / OS Bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="ml-2 text-xs font-mono text-slate-400 hidden sm:inline">
                  ricoz.in/analytics/enterprise-hub
                </span>
              </div>

              {/* View Switcher Tabs inside product */}
              <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/60">
                <button
                  onClick={() => setActiveTab('executive')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'executive'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Executive Cockpit
                </button>
                <button
                  onClick={() => setActiveTab('pipeline')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'pipeline'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Multi-Source ETL
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    activeTab === 'ai'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  AI Anomaly Copilot
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">LIVE PIPELINE</span>
              </div>
            </div>

            {/* Inner Interactive Product Canvas */}
            <div className="bg-slate-950 rounded-xl p-4 sm:p-6 text-slate-100 min-h-[380px]">
              {activeTab === 'executive' && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Top Live Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Total Monthly Revenue</span>
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded text-[10px]">+24.8%</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-white">₹8,42,80,000</div>
                      <div className="text-[11px] text-slate-500 mt-1">Target: ₹7.50 Cr • 112% Achieved</div>
                    </div>

                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Active Branch Hubs</span>
                        <span className="text-red-400 font-bold bg-red-950/60 px-1.5 py-0.5 rounded text-[10px]">100% Sync</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-white">48 Hubs</div>
                      <div className="text-[11px] text-slate-500 mt-1">All regions reporting live metrics</div>
                    </div>

                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Gross Margin Index</span>
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded text-[10px]">+3.2%</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-white">68.4%</div>
                      <div className="text-[11px] text-slate-500 mt-1">Benchmark: &gt; 65.0%</div>
                    </div>

                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Data Ingestion Latency</span>
                        <span className="text-blue-400 font-bold bg-blue-950/60 px-1.5 py-0.5 rounded text-[10px]">Sub-sec</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-white">180 ms</div>
                      <div className="text-[11px] text-slate-500 mt-1">Streaming over 1.2M events/hr</div>
                    </div>
                  </div>

                  {/* Visual Chart Area & Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={16} className="text-red-500" />
                          <span className="text-sm font-bold text-white">Revenue vs Target Trajectory (H1 FY26)</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">Currency: INR Lakhs</span>
                      </div>

                      {/* Pure CSS/SVG Simulated Crisp Responsive Bar & Area Chart */}
                      <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-800">
                        {monthlyRevenueData.map((item) => (
                          <div key={item.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                            <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              ₹{item.val}L
                            </div>
                            <div className="w-full max-w-[40px] flex items-end gap-1 h-full justify-center">
                              {/* Actual bar */}
                              <div
                                style={{ height: `${(item.val / 130) * 100}%` }}
                                className="w-full bg-gradient-to-t from-red-700 to-red-500 rounded-t-md transition-all duration-500 group-hover:brightness-125"
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-400">{item.month}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-red-500" /> Actual Invoiced
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-slate-700" /> Forecast Baseline
                          </span>
                        </div>
                        <span className="text-emerald-400 font-medium font-mono">+29.4% Growth vs Prev Year</span>
                      </div>
                    </div>

                    {/* Right Mini Widget: Regional Performance */}
                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-white">Regional Performance</span>
                          <span className="text-xs text-emerald-400 font-medium">100% Target Met</span>
                        </div>
                        <div className="space-y-2.5">
                          {[
                            { name: 'South (HQ & Hubs)', percent: 92, val: '₹3.8 Cr' },
                            { name: 'North Region', percent: 84, val: '₹2.4 Cr' },
                            { name: 'West Region', percent: 76, val: '₹1.6 Cr' },
                            { name: 'East Region', percent: 68, val: '₹0.6 Cr' },
                          ].map((region) => (
                            <div key={region.name} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-300">{region.name}</span>
                                <span className="font-mono text-slate-200 font-bold">{region.val}</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full"
                                  style={{ width: `${region.percent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 p-2.5 rounded-lg bg-red-950/30 border border-red-900/40 flex items-center justify-between">
                        <span className="text-xs text-red-200">Export Ready: PDF &amp; XLSX</span>
                        <Link to="/login" className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1">
                          View Live <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'pipeline' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Active Data Connectors &amp; Schema Pipelines</h4>
                      <p className="text-xs text-slate-400">Automated multi-source sync with zero ETL latency overhead.</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-xs font-mono">
                      8 Connectors Connected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { name: 'PostgreSQL Primary Cluster', type: 'Database (Relational)', records: '2,840,192 records', status: 'Streaming (14ms)', icon: Database },
                      { name: 'Franchise POS Cloud API', type: 'REST / Webhook Ingestion', records: '49,200 events/hr', status: 'Healthy', icon: Zap },
                      { name: 'ERP Finance & Inventory DB', type: 'MySQL Enterprise', records: '810,400 rows synced', status: 'Streaming (22ms)', icon: Database },
                      { name: 'Executive Sales Sheets', type: 'Live Google Sheet / CSV', records: 'Auto-refreshed (5m)', status: 'Active', icon: FileSpreadsheet },
                    ].map((source) => (
                      <div key={source.name} className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center flex-shrink-0">
                          <source.icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{source.name}</div>
                          <div className="text-[11px] text-slate-400">{source.type} • {source.records}</div>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                          {source.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-900/50 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
                    + Connect any SQL, Snowflake, MongoDB, BigQuery, CSV, or Custom API in under 60 seconds.
                  </div>
                </div>
              )}

              {activeTab === 'ai' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Cpu size={18} className="text-red-500" />
                      <div>
                        <h4 className="text-sm font-bold text-white">Ricoz AI Copilot &amp; Anomaly Detector</h4>
                        <p className="text-xs text-slate-400">Continuous background inference monitoring all business metrics.</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-red-950/80 border border-red-800/80 text-red-300 text-xs font-mono">
                      AI Model: Ricoz-Inference-v2
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 bg-red-950/20 rounded-xl border border-red-900/40">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-400 mb-1">
                        <AlertTriangle size={15} />
                        <span>Insight #108: Channel Surge Detected in North Franchise</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        North franchise hub orders increased by +42% over average 30-day baseline following regional festival campaign. Recommended stock allocation: +1,200 units by Friday.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                        <Sparkles size={15} />
                        <span>Predictive Forecast: Q3 Revenue Confidence Interval 96.4%</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Based on trailing 12-month regression and seasonality parameters, projected Q3 total revenue is on track to reach ₹26.4 Cr (± 2.8%).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
