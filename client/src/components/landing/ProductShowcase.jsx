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
  AlertTriangle,
  Calculator
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEFAULT_ILLUSTRATIVE_METRICS } from '../../utils/formulaCalculator';

/**
 * ProductShowcase — Interactive Enterprise Product Simulator
 * Shows the actual RicozAnalytics platform capabilities:
 * - Dataset selection (Franchise Retail, E-Commerce, Supply Chain)
 * - Dynamic filters (Date range, Region)
 * - 5 functional view modes:
 *   1. Executive Cockpit (Accurate KPIs, Charts, Regional Progress)
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
      text: 'Hello! I am your Ricoz Analytics Assistant. I can help analyze your sample dataset across all 48 store hubs. Click a suggested query below or ask any question.'
    }
  ]);

  // Dataset configurations with explicit demo labeling
  const datasets = [
    { id: 'franchise', name: 'Retail Operations (Sample)', count: '48 Hubs • Q3 (Illustrative)' },
    { id: 'ecommerce', name: 'Omnichannel Orders (Sample)', count: '124,800 Orders (Illustrative)' },
    { id: 'supplychain', name: 'Logistics Network (Sample)', count: '18 Nodes (Illustrative)' },
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

    const baseRev = Math.round(84200000 * multiplier);
    const targetRev = Math.round(75000000 * multiplier);
    const surplus = baseRev - targetRev;

    // Direct gross profit calculations
    const cogsAmount = Math.round(26600000 * multiplier);
    const grossProfit = baseRev - cogsAmount;
    const grossMargin = baseRev > 0 ? ((grossProfit / baseRev) * 100).toFixed(1) + '%' : '0.0%';

    return {
      revenue: baseRev,
      cogs: cogsAmount,
      grossProfit: grossProfit,
      target: targetRev,
      surplus: surplus,
      surplusPct: '+24.8%',
      margin: grossMargin,
      hubs: selectedRegion === 'all' ? (selectedDataset === 'supplychain' ? '18 Nodes' : '48 Hubs') : (selectedRegion === 'south' ? '22 Hubs' : '10 Hubs'),
      syncStatus: 'Direct Database Sync'
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
    let replyText = "Analyzing dataset records...";

    if (q.toLowerCase().includes('south') || q.toLowerCase().includes('variance')) {
      replyText = "In this sample dataset, South Region recorded +28.4% above plan (₹3.82 Cr vs ₹2.97 Cr plan). Primary variance drivers include retail reorders at Bangalore West (HUB-812) and Chennai OMR (HUB-318).";
    } else if (q.toLowerCase().includes('forecast') || q.toLowerCase().includes('cash')) {
      replyText = "Based on trend projection with a 15% growth assumption, projected cash runway stands at approximately 14.8 months across active store hubs.";
    } else if (q.toLowerCase().includes('anomaly') || q.toLowerCase().includes('alert')) {
      replyText = "1 operational variance detected: Pune Baner (HUB-604) margin contracted -12.7% vs planned target. Automated notification flagged for operational review.";
    } else {
      replyText = `Evaluated across ${currentMetrics.hubs}: Current Gross Margin is ${currentMetrics.margin} with direct dataset synchronization active.`;
    }

    setChatLog(prev => [...prev, userMsg, { role: 'assistant', text: replyText }]);
    setCopilotQuery('');
  };

  return (
    <section id="product" className="py-20 lg:py-28 bg-slate-50/60 dark:bg-[#0B0F19] text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-3 shadow-2xs">
            <Cpu size={13} className="text-red-600 dark:text-red-400" />
            <span>Interactive Product Demonstration</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            See the Platform in Action.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Switch sample datasets, test dimensional filters, and explore the interactive analytics interface directly in your browser.
          </p>
        </div>

        {/* ─── COCKPIT WINDOW CONTAINER ──────────────── */}
        <div className="rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
          
          {/* Top Control Bar: Dataset Switcher & Global Filters */}
          <div className="p-4 sm:p-5 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            
            {/* Dataset Dropdown / Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">
                Sample Dataset:
              </span>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                {datasets.map(ds => (
                  <button
                    key={ds.id}
                    type="button"
                    onClick={() => setSelectedDataset(ds.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedDataset === ds.id
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{ds.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Interactive Filters */}
            <div className="flex items-center gap-2.5 text-xs font-mono">
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                <Filter size={12} className="text-red-600 dark:text-red-400" />
                <span>Region:</span>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-transparent text-slate-900 dark:text-white font-bold outline-none cursor-pointer"
                >
                  <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">All Hubs (Consolidated)</option>
                  <option value="south" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">South Region (HQ)</option>
                  <option value="north" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">North Region</option>
                  <option value="west" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">West Region</option>
                  <option value="east" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">East Region</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hidden sm:flex shadow-2xs">
                <Calendar size={12} className="text-blue-600 dark:text-blue-400" />
                <select
                  value={selectedTimeRange}
                  onChange={(e) => setSelectedTimeRange(e.target.value)}
                  className="bg-transparent text-slate-900 dark:text-white font-bold outline-none cursor-pointer"
                >
                  <option value="q3" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Q3 FY26</option>
                  <option value="mtd" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Month to Date</option>
                  <option value="ytd" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Year to Date (H1)</option>
                </select>
              </div>
            </div>

          </div>

          {/* Module Navigation Tabs */}
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('cockpit')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'cockpit'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 size={14} className="text-red-600 dark:text-red-500" />
              <span>1. Executive Cockpit</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon size={14} className="text-blue-600 dark:text-blue-400" />
              <span>2. Data Explorer &amp; Table ({tableRows.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('copilot')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'copilot'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
              <span>3. AI Query Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('forecast')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'forecast'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>4. Scenario What-If Modeling</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                activeTab === 'report'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText size={14} className="text-amber-600 dark:text-amber-400" />
              <span>5. Scheduled PDF Reports</span>
            </button>
          </div>

          {/* ─── INSIDE MODULE VIEWS ──────────────── */}
          <div className="p-5 sm:p-7 min-h-[440px]">
            
            {/* VIEW 1: EXECUTIVE COCKPIT */}
            {activeTab === 'cockpit' && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* 4 KPI Cards with High Contrast & Correct Formula Labels */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net Revenue Invoiced</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">₹{currentMetrics.revenue.toLocaleString('en-IN')}</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                      <TrendingUp size={13} />
                      <span>{currentMetrics.surplusPct} vs Target Plan</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Gross Margin (Illustrative)</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">{currentMetrics.margin}</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      Gross Profit: ₹{(currentMetrics.grossProfit / 10000000).toFixed(2)} Cr
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Nodes Monitored</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">{currentMetrics.hubs}</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">Sample Network Scope</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Data Connection Status</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1">{currentMetrics.syncStatus}</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">Active Schema Validation</div>
                  </div>
                </div>

                {/* Trajectory Bar Chart & Regional Performance */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <BarChart3 size={15} className="text-red-600 dark:text-red-500" />
                          <span>Monthly Invoiced Revenue vs Target Plan (H1 FY26)</span>
                        </span>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          Dataset: {datasets.find(d => d.id === selectedDataset)?.name} • Currency: INR Lakhs
                        </div>
                      </div>
                      <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800/60 text-xs">
                        +₹{(currentMetrics.surplus / 100000).toFixed(1)}L Net Surplus
                      </span>
                    </div>

                    {/* Chart Container */}
                    <div className="relative w-full h-48 bg-white dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex flex-col justify-end overflow-hidden shadow-inner">
                      {/* Gridlines */}
                      <div className="absolute inset-x-3 inset-y-3 flex flex-col justify-between pointer-events-none">
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹120L</span>
                          <div className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹90L</span>
                          <div className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹60L</span>
                          <div className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
                          <span className="text-[9px] font-mono text-slate-400 w-9 text-right font-semibold">₹30L</span>
                          <div className="flex-1" />
                        </div>
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-0.5">
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
                                className="w-3.5 bg-slate-300 dark:bg-slate-700 rounded-t border-t border-slate-400 dark:border-slate-500" 
                                style={{ height: `${(pt.t / 125) * 100}%` }} 
                                title={`Target Plan: ₹${pt.t} Lakhs`} 
                              />
                              <div 
                                className="w-4.5 bg-red-600 rounded-t group-hover:bg-rose-500 group-hover:scale-110 transition-all shadow-sm" 
                                style={{ height: `${(pt.val / 125) * 100}%` }} 
                                title={`Actual Invoiced: ₹${pt.val} Lakhs`} 
                              />
                            </div>
                            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono font-bold mt-2 group-hover:text-red-600 dark:group-hover:text-red-400">
                              {pt.m}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chart Legend with Swatches */}
                    <div className="flex flex-wrap items-center justify-between pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                          <span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-700 border border-slate-400 dark:border-slate-500 inline-block" />
                          <span>Target Budget Plan</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
                          <span className="w-3 h-3 rounded bg-red-600 inline-block" />
                          <span>Actual Invoiced Revenue</span>
                        </span>
                      </div>
                      <span className="text-slate-900 dark:text-white font-bold bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                        112% Target Attainment
                      </span>
                    </div>
                  </div>

                  {/* Regional Distribution */}
                  <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white mb-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-sm">Regional Distribution (Sample)</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs">Target Met</span>
                      </div>
                      <div className="space-y-3.5 pt-1">
                        <div>
                          <div className="flex justify-between text-xs text-slate-700 dark:text-slate-200 mb-1 font-medium">
                            <span>South Region (22 Hubs)</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">₹3.82 Cr (45.3%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-700 dark:text-slate-200 mb-1 font-medium">
                            <span>North Region (14 Hubs)</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">₹2.41 Cr (28.5%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: '84%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-700 dark:text-slate-200 mb-1 font-medium">
                            <span>West Region (8 Hubs)</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">₹1.59 Cr (18.9%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: '72%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-700 dark:text-slate-200 mb-1 font-medium">
                            <span>East Region (4 Hubs)</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">₹0.61 Cr (7.3%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-red-600 rounded-full" style={{ width: '48%' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                      <span>Role-based access permissions applied to data views.</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* VIEW 2: DATA EXPLORER & TABLE */}
            {activeTab === 'table' && (
              <div className="space-y-4 animate-fadeIn font-mono text-xs">
                
                {/* Search Bar & Table Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <div className="flex items-center gap-2 flex-1 max-w-md bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <Search size={14} className="text-slate-400" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search store code, city, region..."
                      className="bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none w-full text-xs font-sans"
                    />
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Showing {tableRows.length} nodes in sample dataset
                  </div>
                </div>

                {/* Table Records */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
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
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-sans">
                      {tableRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{row.code}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-200">{row.city}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{row.region}</td>
                          <td className="p-3 font-mono text-slate-900 dark:text-white font-bold">{row.rev}</td>
                          <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{row.target}</td>
                          <td className="p-3 font-mono">
                            <span className={row.variance.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                              {row.variance}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              row.status === 'Exceeding' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                              row.status === 'Alert' ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' :
                              'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
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
                <div className="h-64 overflow-y-auto p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 font-sans text-xs">
                  {chatLog.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-lg p-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-red-600 text-white rounded-br-xs shadow-xs'
                          : 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-xs shadow-2xs'
                      }`}>
                        <div className="text-[10px] font-mono opacity-70 mb-1">
                          {msg.role === 'user' ? 'You' : 'Ricoz Analytics Assistant'}
                        </div>
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Prompts */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Sample questions:</span>
                  <button
                    type="button"
                    onClick={() => handleCopilotSend("Explain Q3 South variance and top driver")}
                    className="px-3 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs transition cursor-pointer shadow-2xs"
                  >
                    "Explain Q3 South variance"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopilotSend("Forecast Q4 cash runway")}
                    className="px-3 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs transition cursor-pointer shadow-2xs"
                  >
                    "Forecast Q4 cash runway"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopilotSend("Check active anomaly alerts")}
                    className="px-3 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs transition cursor-pointer shadow-2xs"
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
                    placeholder="Ask a question about your revenue, hubs, or margin..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-red-500 shadow-2xs"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
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
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 font-sans shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">Interactive What-If Growth Simulator</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">Simulate the effect of sales growth and supply cost changes</div>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs">
                      Simulated Growth Rate: {growthSlider}%
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
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
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Simulated FY27 Revenue</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      ₹{Math.round(84200000 * (1 + growthSlider / 100) * 1.25).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">+{growthSlider}% Modeled Growth</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Projected Cash Runway</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {(12 + growthSlider * 0.2).toFixed(1)} Months
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Estimated Operational Runway</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Store Network Capacity</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {Math.round(48 + growthSlider * 0.8)} Hubs
                    </div>
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Simulated Expansion Scope</div>
                  </div>
                </div>

              </div>
            )}

            {/* VIEW 5: SCHEDULED PDF REPORT */}
            {activeTab === 'report' && (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 animate-fadeIn shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Weekly Leadership Performance Briefing</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automated delivery of key metrics to managers and leadership</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-mono font-bold">
                    SCHEDULED CRON DISPATCH
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-3 text-xs shadow-inner">
                  <div className="flex justify-between text-slate-700 dark:text-slate-300 font-mono">
                    <span>REPORT_NAME:</span>
                    <span className="text-slate-900 dark:text-white font-bold">Ricoz_Executive_Briefing_Sample.pdf</span>
                  </div>
                  <div className="flex justify-between text-slate-700 dark:text-slate-300 font-mono">
                    <span>SECTIONS_INCLUDED:</span>
                    <span className="text-slate-500 dark:text-slate-400">Revenue, Gross Margin, Regional Breakdown, Threshold Alerts</span>
                  </div>
                  <div className="flex justify-between text-slate-700 dark:text-slate-300 font-mono">
                    <span>DELIVERY_CHANNELS:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Automated Email &amp; In-App Downloads</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition shadow-xs"
                  >
                    <span>Configure Scheduled Reports</span>
                    <ArrowRight size={14} />
                  </Link>
                  <button
                    type="button"
                    onClick={onOpenDemo}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition shadow-2xs cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Request Product Walkthrough</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Bar: Quick CTA */}
          <div className="px-6 py-4 bg-slate-100/70 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-mono">
              Ready to connect your own business data and build customized dashboards?
            </span>
            <Link
              to="/register"
              className="font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight size={13} />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}
