import React, { useState } from 'react';
import { 
  Database, 
  Layers, 
  BarChart3, 
  Sliders, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  AlertCircle,
  Sparkles,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PlatformShowcase({ onOpenDemo }) {
  const [selectedPillar, setSelectedPillar] = useState(0);

  const pillars = [
    {
      step: '01',
      title: 'Connect & Model Data in Minutes',
      tagline: 'Zero Complex ETL Overhead',
      desc: 'Seamlessly ingest SQL tables, cloud storage, spreadsheets, and Webhook feeds. Automatic type inference builds clean relational data models instantly.',
      icon: Database,
      details: [
        'Supports PostgreSQL, MySQL, Supabase, Snowflake, CSV & REST',
        'Automatic primary & foreign key relationship mapper',
        'Data profiling & automatic null-value cleansing alerts'
      ],
      previewContent: {
        title: 'Data Ingestion & Relationship Modeler',
        badge: 'ACTIVE SCHEMA',
        badgeColor: 'emerald',
        items: [
          { name: 'orders_fact_table', rows: '1,420,890 rows', status: 'Synced', rate: '120 req/s' },
          { name: 'customers_dimension', rows: '240,500 rows', status: 'Synced', rate: 'Live Stream' },
          { name: 'franchise_branches', rows: '48 hubs', status: 'Synced', rate: 'Healthy' },
          { name: 'inventory_ledger', rows: '650,200 rows', status: 'Syncing', rate: '98% complete' },
        ]
      }
    },
    {
      step: '02',
      title: 'Build Drag-and-Drop Interactive Dashboards',
      tagline: 'Pixel-Perfect Visual Cockpits',
      desc: 'Assemble intuitive executive cockpits with customizable metric widgets, multi-series time-charts, funnel analysis, and cross-metric filtering.',
      icon: BarChart3,
      details: [
        'Dynamic multi-column grid with responsive sizing',
        'Global date range and regional franchise filter bars',
        'Real-time automated polling and instant export capabilities'
      ],
      previewContent: {
        title: 'Executive Financial & KPI Dashboard',
        badge: 'INTERACTIVE VIEW',
        badgeColor: 'red',
        items: [
          { name: 'Gross Revenue Target Widget', rows: '₹8.42 Cr (+18%)', status: 'On Target', rate: 'Monthly' },
          { name: 'Regional Variance Matrix', rows: '4 Zones Reporting', status: 'Active', rate: 'Real-time' },
          { name: 'Top 10 Fast-Moving SKUs', rows: '94.2% In Stock', status: 'Healthy', rate: 'Live Feed' },
          { name: 'Customer Retention Rate', rows: '78.4% (QoQ +4%)', status: 'Strong', rate: 'Daily' },
        ]
      }
    },
    {
      step: '03',
      title: 'AI Anomaly Detection & Proactive Incident Alerts',
      tagline: 'Automated 24/7 Intelligence',
      desc: 'Never miss a revenue dip or operational bottleneck. The embedded AI engine continuously tracks threshold breaches and sends instant notifications.',
      icon: Sparkles,
      details: [
        'Custom multi-condition alert rules with variance thresholds',
        'Instant notifications via Slack, Email, and Webhooks',
        'Automated root-cause diagnostic drawer with recommended actions'
      ],
      previewContent: {
        title: 'Incident Monitor & AI Root-Cause Diagnostic',
        badge: 'AUTONOMOUS AGENT',
        badgeColor: 'blue',
        items: [
          { name: 'Incident #402: Branch #12 Revenue Dip', rows: 'Variance -18.2%', status: 'Investigating', rate: 'P1 Urgent' },
          { name: 'Anomaly #401: Order Spike South Hub', rows: '+44% vs baseline', status: 'Resolved', rate: 'Handled' },
          { name: 'Scheduled: Weekly Executive Briefing', rows: 'PDF & Excel export', status: 'Ready', rate: 'Mondays 9 AM' },
          { name: 'AI Forecast Model Training', rows: '98.8% R² score', status: 'Up to Date', rate: 'Continuous' },
        ]
      }
    }
  ];

  const current = pillars[selectedPillar];

  return (
    <section id="dashboards" className="py-20 lg:py-28 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider">
            One Unified Platform
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Complete Visibility Across Your Entire Operation
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Eliminate silos between engineering, data analysts, and executive leadership with an integrated workspace.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Interactive Selector Cards */}
          <div className="lg:col-span-5 space-y-4">
            {pillars.map((pillar, idx) => {
              const isSelected = selectedPillar === idx;
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.step}
                  onClick={() => setSelectedPillar(idx)}
                  className={`cursor-pointer rounded-2xl p-5 sm:p-6 transition-all duration-200 border text-left ${
                    isSelected
                      ? 'bg-red-50/70 border-red-500 shadow-md ring-1 ring-red-500/30'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        isSelected
                          ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {pillar.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-red-700' : 'text-slate-400'}`}>
                          {pillar.tagline}
                        </span>
                      </div>
                      <h3 className={`text-base font-bold mb-1.5 ${isSelected ? 'text-slate-950' : 'text-slate-800'}`}>
                        {pillar.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {pillar.desc}
                      </p>

                      {isSelected && (
                        <div className="mt-4 pt-3 border-t border-red-200/60 space-y-2 animate-fadeIn">
                          {pillar.details.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-800 font-medium">
                              <CheckCircle2 size={13} className="text-red-600 flex-shrink-0" />
                              <span>{d}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Dynamic Preview Mockup Container */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-6 shadow-xl text-white">
              {/* Top Window Bar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center">
                    <current.icon size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{current.previewContent.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Stage: {current.step} — Live Environment</div>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-950 border border-red-700/50 text-red-400">
                  {current.previewContent.badge}
                </span>
              </div>

              {/* Items List Inside Mockup */}
              <div className="space-y-3">
                {current.previewContent.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/70 flex items-center justify-between hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-200 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.rows}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-mono text-slate-300 font-medium">{item.rate}</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Footer inside Mockup */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-400">
                  Ready to test with your own company datasets?
                </span>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-sm"
                >
                  <span>Launch Module</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
