import React, { useState } from 'react';
import { 
  Database, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  FileSpreadsheet, 
  Server, 
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Interactive3DCard from './Interactive3DCard';

export default function DataIntegrationsSection({ onOpenDemo }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All Connectors (16+)' },
    { id: 'databases', label: 'Cloud Warehouses & SQL' },
    { id: 'saas', label: 'Business Apps & SaaS' },
    { id: 'streams', label: 'Files & Real-Time Streams' },
  ];

  const connectors = [
    {
      name: 'PostgreSQL',
      category: 'databases',
      type: 'Direct Connection / CDC',
      speed: 'Sub-second sync',
      status: 'Live & Verified',
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
      badge: 'Zero-ETL',
      description: 'Stream relational transactions and replica tables with instant primary key discovery.'
    },
    {
      name: 'Snowflake',
      category: 'databases',
      type: 'Data Warehouse',
      speed: 'Direct Query Pushdown',
      status: 'Live & Verified',
      iconBg: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
      badge: 'Warehouse',
      description: 'Run federated queries directly on enterprise Snowflake stages without data movement.'
    },
    {
      name: 'Google BigQuery',
      category: 'databases',
      type: 'Serverless Warehouse',
      speed: 'Partition Optimized',
      status: 'Live & Verified',
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      badge: 'Cloud Scale',
      description: 'Analyze petabyte-scale retail orders and customer clickstreams with sub-second response.'
    },
    {
      name: 'MySQL Enterprise',
      category: 'databases',
      type: 'Relational Database',
      speed: 'Binary Log Streaming',
      status: 'Live & Verified',
      iconBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
      badge: 'OLTP Sync',
      description: 'Continuous replication from production MySQL clusters with zero write lock impact.'
    },
    {
      name: 'Supabase',
      category: 'databases',
      type: 'Postgres & Edge API',
      speed: 'Real-Time WebSockets',
      status: 'Live & Verified',
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
      badge: 'Serverless',
      description: 'Synchronize Supabase auth, storage tables, and real-time event triggers instantly.'
    },
    {
      name: 'ClickHouse',
      category: 'databases',
      type: 'Columnar Analytics',
      speed: '100M rows / sec',
      status: 'Live & Verified',
      iconBg: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400',
      badge: 'High IOPS',
      description: 'Ultra-fast analytical aggregation for high-volume telemetry and IoT device logs.'
    },
    {
      name: 'Salesforce CRM',
      category: 'saas',
      type: 'Enterprise CRM API',
      speed: 'OAuth 2.0 Ingestion',
      status: 'Live & Verified',
      iconBg: 'bg-blue-50 text-blue-500 dark:bg-blue-950/60 dark:text-blue-400',
      badge: 'Revenue Pipeline',
      description: 'Sync franchise leads, opportunity stages, and account ARR into executive revenue cockpits.'
    },
    {
      name: 'Stripe & Razorpay',
      category: 'saas',
      type: 'Payment Gateways',
      speed: 'Webhook Triggered',
      status: 'Live & Verified',
      iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
      badge: 'Billing Engine',
      description: 'Automated ingestion of settlements, subscription churn, and gross revenue transactions.'
    },
    {
      name: 'Shopify Plus',
      category: 'saas',
      type: 'E-Commerce Storefront',
      speed: 'GraphQL Ingestion',
      status: 'Live & Verified',
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
      badge: 'Retail GMV',
      description: 'Live order tracking, inventory SKU velocity, and regional fulfillment telemetry.'
    },
    {
      name: 'Google Sheets',
      category: 'streams',
      type: 'Collaborative Sheets',
      speed: 'Auto-Refresh on Edit',
      status: 'Live & Verified',
      iconBg: 'bg-green-50 text-green-600 dark:bg-green-950/60 dark:text-green-400',
      badge: 'Zero-Code',
      description: 'Link operational target spreadsheets directly into KPI formula calculations.'
    },
    {
      name: 'CSV & XLSX Uploads',
      category: 'streams',
      type: 'Bulk File Engine',
      speed: 'Up to 500MB / file',
      status: 'Live & Verified',
      iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
      badge: 'Universal',
      description: 'Drag-and-drop legacy Excel financial ledgers with instant schema parsing.'
    },
    {
      name: 'REST API & Webhooks',
      category: 'streams',
      type: 'Custom JSON Payloads',
      speed: 'Streaming Endpoint',
      status: 'Live & Verified',
      iconBg: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400',
      badge: 'Developer SDK',
      description: 'Push custom JSON data packets from internal microservices with HMAC security.'
    }
  ];

  const filteredConnectors = activeCategory === 'all'
    ? connectors
    : connectors.filter(c => c.category === activeCategory);

  return (
    <section 
      id="integrations" 
      className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800"
      style={{ perspective: '1200px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <Layers size={14} className="text-red-600 dark:text-red-400" />
            <span>Multi-Source Data Ingestion</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Connect Any Data Source in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Under 3 Minutes
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Eliminate complex ETL pipelines. RicozAnalytics auto-discovers schemas, normalizes data types, and streams data directly into your sovereign intelligence lake.
          </p>

          {/* Category Filter Pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Architectural Zero-ETL Pipeline Diagram with 3D Depth */}
        <div className="mb-16 p-6 sm:p-8 rounded-3xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-md overflow-hidden relative">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative">
            {/* Step 1: Sources */}
            <div className="w-full lg:w-1/4 flex flex-col items-center lg:items-start text-center lg:text-left">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">Step 01 • Source Ingestion</span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Disparate Enterprise Systems</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                SQL tables, cloud data warehouses, CRM feeds, and Excel workbooks securely connected.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/80">
                  <CheckCircle2 size={11} /> Read-only Credentials
                </span>
              </div>
            </div>

            {/* Connecting Stream 1 */}
            <div className="hidden lg:flex items-center text-red-400 dark:text-red-500">
              <div className="w-12 border-t-2 border-dashed border-red-300 dark:border-red-800" />
              <ArrowRight size={18} className="-ml-1 animate-pulse" />
            </div>

            {/* Step 2: Ricoz Zero-ETL Engine */}
            <div className="w-full lg:w-1/3 p-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-red-200 dark:border-red-900/60 shadow-xl shadow-red-600/10 relative overflow-hidden group hover:scale-102 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/30">
                  <Cpu size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Ricoz Zero-ETL Ingestion</h4>
                  <div className="text-[10px] text-slate-400">Continuous Stream &amp; Schema Parser</div>
                </div>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-700">
                <li className="flex items-center justify-between">
                  <span>Type inference &amp; FK linking</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Auto 100%</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Mean Ingestion Latency</span>
                  <span className="font-mono text-slate-800 dark:text-white font-bold">142 ms</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Data Corruption Rate</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">0.000%</span>
                </li>
              </ul>
            </div>

            {/* Connecting Stream 2 */}
            <div className="hidden lg:flex items-center text-red-400 dark:text-red-500">
              <div className="w-12 border-t-2 border-dashed border-red-300 dark:border-red-800" />
              <ArrowRight size={18} className="-ml-1 animate-pulse" />
            </div>

            {/* Step 3: Sovereign Lake & Intelligence */}
            <div className="w-full lg:w-1/4 flex flex-col items-center lg:items-end text-center lg:text-right">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Step 03 • Actionable Output</span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Unified Executive Intelligence</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Live executive cockpits, scheduled PDF briefs, proactive alerts, and autonomous AI answers.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  <ShieldCheck size={11} className="text-emerald-500" /> AES-256 Sovereign Encryption
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Connectors Card Grid with 3D Tilt */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredConnectors.map((c) => (
            <Interactive3DCard
              key={c.name}
              maxTilt={14}
              scale={1.04}
              glare={true}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-800 shadow-sm transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3" style={{ transform: 'translateZ(15px)' }}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${c.iconBg}`}>
                    <Database size={20} />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {c.badge}
                  </span>
                </div>

                <h3 
                  className="text-base font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors"
                  style={{ transform: 'translateZ(20px)' }}
                >
                  {c.name}
                </h3>
                <div className="text-[11px] font-medium text-slate-400 mb-2">
                  {c.type}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4" style={{ transform: 'translateZ(10px)' }}>
                  {c.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]" style={{ transform: 'translateZ(15px)' }}>
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock size={12} className="text-slate-400" />
                  <span>{c.speed}</span>
                </div>
                <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{c.status}</span>
                </div>
              </div>
            </Interactive3DCard>
          ))}
        </div>

        {/* Integration Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Don't see your specific ERP or proprietary database listed?
          </p>
          <button
            type="button"
            onClick={onOpenDemo}
            className="inline-flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:underline cursor-pointer"
          >
            <span>Request custom ERP connector or dedicated data pipeline</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
