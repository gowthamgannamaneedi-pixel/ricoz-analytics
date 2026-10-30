import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Sliders, 
  Database, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  Download, 
  Clock, 
  ShieldCheck,
  Zap,
  Cpu,
  Share2,
  Table as TableIcon,
  Search,
  Filter,
  Calendar,
  Building2,
  ChevronRight,
  Send,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * ProductShowcase — Interactive Enterprise Product Simulator
 * Shows the actual RicozAnalytics platform in action:
 * - Dataset selection (Franchise Retail, E-Commerce, Supply Chain)
 * - Dynamic filters (Date range, Region)
 * - 5 functional view modes:
 *   1. Executive Cockpit (KPIs, Charts, Regional Progress)
 *   2. Data Explorer & Table (Live search, sorting, records)
 *   3. AI Copilot (Natural language conversational insights)
 *   4. Forecasting & Scenarios (Interactive what-if slider)
 *   5. Executive Report Dispatcher (Scheduled PDF/XLSX briefs)
 */
export default function ProductShowcase({ onOpenDemo }) {
  const [selectedDataset, setSelectedDataset] = useState('franchise');
  const [activeTab, setActiveTab] = useState('cockpit'); // cockpit, table, copilot, forecast, report
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('q3');
  const [tableSearch, setTableSearch] = useState('');
  const [growthSlider, setGrowthSlider] = useState(15); // for forecasting
  const [copilotQuery, setCopilotQuery] = useState('');
  const [chatLog, setChatLog] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am your Ricoz AI Copilot. I analyze live transactions across all 48 franchise hubs. Ask a question or click a prompt below.'
    }
  ]);

  // Dataset configurations
  const datasets = [
    { id: 'franchise', name: 'Franchise Retail Operations', count: '48 Hubs • Q3 FY26' },
    { id: 'ecommerce', name: 'Omnichannel E-Commerce', count: '124,800 Orders • H1' },
    { id: 'supplychain', name: 'Supply Chain & Logistics', count: '18 Warehouses • Live' },
  ];

  // Dynamic calculations based on dataset and filters
  const currentMetrics = useMemo(() => {
    let multiplier = 1;
    if (selectedDataset === 'ecommerce') multiplier = 1.35;
    if (selectedDataset === 'supplychain') multiplier = 0.82;
    if (selectedRegion === 'south') multiplier *= 0.45;
    if (selectedRegion === 'north') multiplier *= 0.28;
    if (selectedRegion === 'west') multiplier *= 0.19;
    if (selectedRegion === 'east') multiplier *= 0.08;

    const baseRev = Math.round(84280000 * multiplier);
    const targetRev = Math.round(75000000 * multiplier);
    const surplus = baseRev - targetRev;

    return {
      revenue: baseRev,
      target: targetRev,
      surplus: surplus,
      surplusPct: '+24.8%',
      margin: selectedDataset === 'supplychain' ? '54.2%' : '68.4%',
      hubs: selectedRegion === 'all' ? (selectedDataset === 'supplychain' ? '18 Nodes' : '48 Hubs') : (selectedRegion === 'south' ? '22 Hubs' : '10 Hubs'),
      latency: '142 ms'
    };
  }, [selectedDataset, selectedRegion]);

  // Interactive Table Rows
  const tableRows = useMemo(() => {
    const raw = [
      { code: 'HUB-812', city: 'Bangalore West', region: 'South', rev: '₹1.48 Cr', target: '₹1.15 Cr', variance: '+28.7%', status: 'Exceeding' },
      { code: 'HUB-402', city: 'Mumbai Central', region: 'West', rev: '₹1.12 Cr', target: '₹1.05 Cr', variance: '+6.6%', status: 'Healthy' },
      { code: 'HUB-204', city: 'Delhi Connaught', region: 'North', rev: '₹1.35 Cr', target: '₹1.20 Cr', variance: '+12.5%', status: 'Healthy' },
      { code: 'HUB-318', city: 'Chennai OMR', region: 'South', rev: '₹1.22 Cr', target: '₹0.95 Cr', variance: '+28.4%', status: 'Exceeding' },
      { code: 'HUB-501', city: 'Hyderabad Hitec', region: 'South', rev: '₹1.12 Cr', target: '₹0.88 Cr', variance: '+27.2%', status: 'Exceeding' },
      { code: 'HUB-109', city: 'Kolkata SaltLake', region: 'East', rev: '₹0.62 Cr', target: '₹0.60 Cr', variance: '+3.3%', status: 'On Target' },
      { code: 'HUB-604', city: 'Pune Baner', region: 'West', rev: '₹0.48 Cr', target: '₹0.55 Cr', variance: '-12.7%', status: 'Alert' },
    ];

    return raw.filter(r => {
      const matchRegion = selectedRegion === 'all' || r.region.toLowerCase() === selectedRegion;
      const matchSearch = tableSearch === '' || 
        r.code.toLowerCase().includes(tableSearch.toLowerCase()) || 
        r.city.toLowerCase().includes(tableSearch.toLowerCase()) ||
        r.region.toLowerCase().includes(tableSearch.toLowerCase());
      return matchRegion && matchSearch;
    });
  }, [selectedRegion, tableSearch]);

  const handleCopilotSend = (queryText) => {
    const q = queryText || copilotQuery;
    if (!q.trim()) return;

    const userMsg = { role: 'user', text: q };
    let replyText = "Analyzing multi-source telemetry...";

    if (q.toLowerCase().includes('south') || q.toLowerCase().includes('variance')) {
      replyText = "South Region delivered +28.4% above quarterly plan (₹3.82 Cr vs ₹2.97 Cr target). Autonomous variance attribution shows high-ticket enterprise reorders across Bangalore West (HUB-812) and Chennai OMR (HUB-318) accounted for 65% of the surplus.";
    } else if (q.toLowerCase().includes('forecast') || q.toLowerCase().includes('cash')) {
      replyText = "Based on continuous Monte Carlo simulation (R² = 0.94), projected Q4 cash runway stands at 14.8 months with 90% statistical confidence assuming current 15% reinvestment velocity.";
    } else if (q.toLowerCase().includes('anomaly') || q.toLowerCase().includes('alert')) {
      replyText = "1 operational variance detected: Pune Baner (HUB-604) margin contracted -12.7% due to temporary local supplier freight surcharge. Automated P1 notification dispatched to West Regional Director.";
    } else {
      replyText = `Evaluated across ${currentMetrics.hubs}: Query executed in 14ms across 1.2M rows. Current Gross Margin is ${currentMetrics.margin} with zero data drops.`;
    }

    setChatLog(prev => [...prev, userMsg, { role: 'assistant', text: replyText }]);
    setCopilotQuery('');
  };

  return (
    <section id="product" className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-red-600 dark:text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <Cpu size={13} className="text-red-600 dark:text-red-400" />
            <span>Interactive Platform Demonstration</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            See the Actual Product in Action.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Switch datasets, adjust filters, and test the real analytics cockpit directly in your browser.
          </p>
        </div>

        {/* ─── COCKPIT WINDOW CONTAINER ──────────────── */}
        <div className="rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden text-slate-200">
          
          {/* Top Control Bar: Dataset Switcher & Global Filters */}
          <div className="p-4 sm:p-5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            
            {/* Dataset Dropdown / Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">Dataset:</span>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {datasets.map(ds => (
                  <button
                    key={ds.id}
                    type="button"
                    onClick={() => setSelectedDataset(ds.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedDataset === ds.id
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{ds.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Interactive Filters */}
            <div className="flex items-center gap-2.5 text-xs font-mono">
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
                <Filter size={12} className="text-red-400" />
                <span>Region:</span>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-white">All Hubs (Consolidated)</option>
                  <option value="south" className="bg-slate-900 text-white">South Region (HQ)</option>
                  <option value="north" className="bg-slate-900 text-white">North Region</option>
                  <option value="west" className="bg-slate-900 text-white">West Region</option>
                  <option value="east" className="bg-slate-900 text-white">East Region</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 hidden sm:flex">
                <Calendar size={12} className="text-blue-400" />
                <select
                  value={selectedTimeRange}
                  onChange={(e) => setSelectedTimeRange(e.target.value)}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer"
                >
                  <option value="q3" className="bg-slate-900 text-white">Q3 FY26</option>
                  <option value="mtd" className="bg-slate-900 text-white">Month to Date</option>
                  <option value="ytd" className="bg-slate-900 text-white">Year to Date (H1)</option>
                </select>
              </div>
            </div>

          </div>

          {/* Module Navigation Tabs */}
          <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('cockpit')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'cockpit'
                  ? 'bg-slate-800 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 size={14} className="text-red-500" />
              <span>1. Executive Cockpit</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'table'
                  ? 'bg-slate-800 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon size={14} className="text-blue-400" />
              <span>2. Live Data Table ({tableRows.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('copilot')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'copilot'
                  ? 'bg-slate-800 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={14} className="text-purple-400" />
              <span>3. AI Copilot Simulator</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('forecast')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'forecast'
                  ? 'bg-slate-800 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp size={14} className="text-emerald-400" />
              <span>4. Forecasting &amp; What-If</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'report'
                  ? 'bg-slate-800 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText size={14} className="text-amber-400" />
              <span>5. Scheduled PDF Report</span>
            </button>
          </div>

          {/* ─── INSIDE MODULE VIEWS ──────────────── */}
          <div className="p-5 sm:p-7 min-h-[440px]">
            
            {/* VIEW 1: EXECUTIVE COCKPIT */}
            {activeTab === 'cockpit' && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* 4 KPI Cards with High Contrast & Clear Hierarchy */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">Net Revenue Invoiced</div>
                    <div className="text-2xl font-black text-white font-mono mt-1">₹{currentMetrics.revenue.toLocaleString('en-IN')}</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                      <TrendingUp size={13} />
                      <span>{currentMetrics.surplusPct} vs Target</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">Operating Margin (EBITDA)</div>
                    <div className="text-2xl font-black text-white font-mono mt-1">{currentMetrics.margin}</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1">+3.4% Baseline Surplus</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">Active Nodes Monitored</div>
                    <div className="text-2xl font-black text-white font-mono mt-1">{currentMetrics.hubs}</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1">100% Operational Health</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">Query P99 Latency</div>
                    <div className="text-2xl font-black text-white font-mono mt-1">{currentMetrics.latency}</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1">Direct Zero-ETL Sync</div>
                  </div>
                </div>

                {/* Trajectory Bar Chart & Regional Performance with Full Axes & Legends */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          <BarChart3 size={15} className="text-red-500" />
                          <span>Monthly Revenue Velocity vs Plan (H1 FY26)</span>
                        </span>
                        <div className="text-xs text-slate-300 font-mono mt-0.5">
                          Dataset: {datasets.find(d => d.id === selectedDataset)?.name} • Currency in INR Lakhs
                        </div>
                      </div>
                      <span className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60 text-xs">
                        +₹{(currentMetrics.surplus / 100000).toFixed(1)}L Net Surplus
                      </span>
                    </div>

                    {/* Chart Container with Y-Axis Scale Values & Gridlines */}
                    <div className="relative w-full h-48 bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex flex-col justify-end overflow-hidden">
                      {/* Horizontal Gridlines & Y-Axis Scale */}
                      <div className="absolute inset-x-3 inset-y-3 flex flex-col justify-between pointer-events-none">
                        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹120L</span>
                          <div className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹90L</span>
                          <div className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹60L</span>
                          <div className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹30L</span>
                          <div className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹0L</span>
                          <div className="flex-1" />
                        </div>
                      </div>

                      {/* Actual Bars */}
                      <div className="relative w-full h-full flex items-end justify-between pl-11 pr-2 sm:pr-4 z-10">
                        {[
                          { m: 'Jan', val: 42, t: 38 },
                          { m: 'Feb', val: 58, t: 50 },
                          { m: 'Mar', val: 72, t: 65 },
                          { m: 'Apr', val: 89, t: 78 },
                          { m: 'May', val: 94, t: 85 },
                          { m: 'Jun', val: 118, t: 100 },
                        ].map(pt => (
                          <div key={pt.m} className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer">
                            <div className="w-full flex items-end justify-center gap-1.5 h-32">
                              <div 
                                className="w-3.5 bg-slate-700/80 rounded-t border-t border-slate-500" 
                                style={{ height: `${(pt.t / 125) * 100}%` }} 
                                title={`Target Plan: ₹${pt.t} Lakhs`} 
                              />
                              <div 
                                className="w-4.5 bg-red-600 rounded-t group-hover:bg-rose-400 group-hover:scale-110 transition-all shadow-md shadow-red-600/30" 
                                style={{ height: `${(pt.val / 125) * 100}%` }} 
                                title={`Actual Invoiced: ₹${pt.val} Lakhs (+${((pt.val - pt.t)/pt.t * 100).toFixed(1)}%)`} 
                              />
                            </div>
                            <span className="text-[10px] text-slate-300 font-mono font-bold mt-2 group-hover:text-red-400">
                              {pt.m}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chart Legend with Swatches */}
                    <div className="flex flex-wrap items-center justify-between pt-3 mt-3 border-t border-slate-800 text-xs">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <span className="w-3 h-3 rounded bg-slate-700 border border-slate-500 inline-block" />
                          <span>Target Budget Plan</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                          <span className="w-3 h-3 rounded bg-red-600 inline-block" />
                          <span>Actual Invoiced Revenue</span>
                        </span>
                      </div>
                      <span className="text-white font-bold bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
                        112% Target Attainment
                      </span>
                    </div>
                  </div>

                  {/* Regional Distribution with Explicit Rupee Totals */}
                  <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-white mb-3 pb-2 border-b border-slate-800 flex justify-between items-center">
                        <span className="text-sm">Regional Franchise Distribution</span>
                        <span className="text-emerald-400 font-mono font-bold text-xs">100% Target Met</span>
                      </div>
                      <div className="space-y-3.5 pt-1">
                        <div>
                          <div className="flex justify-between text-xs text-slate-200 mb-1 font-medium">
                            <span>South Region (22 Hubs)</span>
                            <span className="font-mono font-bold text-white">₹3.82 Cr (45.3%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-200 mb-1 font-medium">
                            <span>North Region (14 Hubs)</span>
                            <span className="font-mono font-bold text-white">₹2.41 Cr (28.5%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: '84%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-200 mb-1 font-medium">
                            <span>West Region (8 Hubs)</span>
                            <span className="font-mono font-bold text-white">₹1.59 Cr (18.9%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: '72%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-200 mb-1 font-medium">
                            <span>East Region (4 Hubs)</span>
                            <span className="font-mono font-bold text-white">₹0.61 Cr (7.3%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: '48%' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                      <span>Row-Level Security (RLS) active across all 48 branches.</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* VIEW 2: DATA EXPLORER & TABLE */}
            {activeTab === 'table' && (
              <div className="space-y-4 animate-fadeIn font-mono text-xs">
                
                {/* Search Bar & Table Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <Search size={14} className="text-slate-400" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search store code, city, region..."
                      className="bg-transparent text-white placeholder-slate-500 outline-none w-full text-xs font-sans"
                    />
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Showing {tableRows.length} nodes matching filters
                  </div>
                </div>

                {/* Table Records */}
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3">Store Code</th>
                        <th className="p-3">Hub City</th>
                        <th className="p-3">Territory</th>
                        <th className="p-3">Q3 Invoiced</th>
                        <th className="p-3">Target</th>
                        <th className="p-3">Variance</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-950/70 font-sans">
                      {tableRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3 font-mono font-bold text-white">{row.code}</td>
                          <td className="p-3 text-slate-200">{row.city}</td>
                          <td className="p-3 text-slate-400">{row.region}</td>
                          <td className="p-3 font-mono text-white font-bold">{row.rev}</td>
                          <td className="p-3 font-mono text-slate-400">{row.target}</td>
                          <td className="p-3 font-mono">
                            <span className={row.variance.startsWith('+') ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {row.variance}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              row.status === 'Exceeding' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                              row.status === 'Alert' ? 'bg-red-950 text-red-400 border border-red-800' :
                              'bg-blue-950 text-blue-400 border border-blue-800'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* VIEW 3: AI COPILOT SIMULATOR */}
            {activeTab === 'copilot' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="h-64 overflow-y-auto p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 font-sans text-xs">
                  {chatLog.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-lg p-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-red-600 text-white rounded-br-xs'
                          : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-bl-xs'
                      }`}>
                        <div className="text-[10px] font-mono opacity-70 mb-1">
                          {msg.role === 'user' ? 'You' : 'Ricoz AI Copilot'}
                        </div>
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Prompts */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[11px] font-mono text-slate-400">Quick queries:</span>
                  <button
                    type="button"
                    onClick={() => handleCopilotSend("Explain Q3 South variance and top driver")}
                    className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition cursor-pointer"
                  >
                    "Explain Q3 South variance"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopilotSend("Forecast Q4 cash runway")}
                    className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition cursor-pointer"
                  >
                    "Forecast Q4 cash runway"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopilotSend("Check active anomaly alerts")}
                    className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition cursor-pointer"
                  >
                    "Check active anomaly alerts"
                  </button>
                </div>

                {/* Input Bar */}
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleCopilotSend(); }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={copilotQuery}
                    onChange={(e) => setCopilotQuery(e.target.value)}
                    placeholder="Ask Ricoz AI any question about your revenue, hubs, or margin..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Analyze</span>
                    <Send size={13} />
                  </button>
                </form>
              </div>
            )}

            {/* VIEW 4: FORECASTING & WHAT-IF ENGINE */}
            {activeTab === 'forecast' && (
              <div className="space-y-6 animate-fadeIn font-mono text-xs">
                
                {/* Interactive Slider Box */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 font-sans">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-white text-sm">Monte Carlo What-If Parameter Simulator</div>
                      <div className="text-xs text-slate-400 font-mono">Statistical Confidence: R² = 0.94 • 10,000 scenarios/sec</div>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono font-bold text-xs">
                      Simulated Growth Rate: {growthSlider}%
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400 font-mono">
                      <span>Conservative (0%)</span>
                      <span>Target (+15%)</span>
                      <span>Aggressive (+35%)</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="35"
                      value={growthSlider}
                      onChange={(e) => setGrowthSlider(Number(e.target.value))}
                      className="w-full accent-red-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Simulated Outcome Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Simulated FY27 Revenue</div>
                    <div className="text-xl font-bold text-white mt-1">
                      ₹{Math.round(84280000 * (1 + growthSlider / 100) * 1.25).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-1">+{growthSlider}% Model Attainment</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Projected Cash Runway</div>
                    <div className="text-xl font-bold text-white mt-1">
                      {(12 + growthSlider * 0.2).toFixed(1)} Months
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-1">Zero Dilution Buffer</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-[11px] text-slate-400">Franchise Expansion Capacity</div>
                    <div className="text-xl font-bold text-white mt-1">
                      {Math.round(48 + growthSlider * 0.8)} Hubs
                    </div>
                    <div className="text-[10px] text-blue-400 mt-1">Self-Funding Velocity</div>
                  </div>
                </div>

              </div>
            )}

            {/* VIEW 5: SCHEDULED PDF REPORT */}
            {activeTab === 'report' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">Weekly Leadership Performance Digest</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Automated cron delivery to Board Members &amp; Franchise Directors</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-mono font-bold">
                    DISPATCH: 07:00 AM EVERY MONDAY
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 text-xs">
                  <div className="flex justify-between text-slate-300 font-mono">
                    <span>DOCUMENT_TITLE:</span>
                    <span className="text-white font-bold">Ricoz_Executive_Briefing_Q3_Consolidated.pdf</span>
                  </div>
                  <div className="flex justify-between text-slate-300 font-mono">
                    <span>SECTIONS_INCLUDED:</span>
                    <span className="text-slate-400">EBITDA Pacing, Regional Variance, Anomaly Audit, Cash Velocity</span>
                  </div>
                  <div className="flex justify-between text-slate-300 font-mono">
                    <span>RECIPIENTS:</span>
                    <span className="text-emerald-400">14 Verified Leadership Stakeholders</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition"
                  >
                    <span>Configure Scheduled Dispatch</span>
                    <ArrowRight size={14} />
                  </Link>
                  <button
                    type="button"
                    onClick={onOpenDemo}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
                  >
                    <Download size={14} />
                    <span>Download Sample Briefing</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Bar: Quick CTA */}
          <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-mono">
              Ready to deploy this cockpit to your business databases?
            </span>
            <Link
              to="/register"
              className="font-bold text-red-400 hover:text-red-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Start 14-Day Free Trial (Zero Setup Fees)</span>
              <ArrowRight size={13} />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}
