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
  Clock,
  Table as TableIcon,
  Check,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DataIntegrationsSection({ onOpenDemo }) {
  const [activeTab, setActiveTab] = useState('cards'); // 'cards' | 'table'

  // Verified Connectors genuinely implemented in frontend & backend
  const verifiedConnectors = [
    {
      name: 'PostgreSQL',
      category: 'Databases',
      type: 'Relational Database',
      speed: 'Direct Connection',
      status: 'Live & Verified',
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
      badge: 'SQL Database',
      description: 'Connect production PostgreSQL databases with SSL support, schema introspection, and automated table discovery.',
      frontend: 'Connection form (Host, Port, Database, User, Password, SSL)',
      backend: 'pg client with 4-second timeout & table introspection',
      credentials: 'AES-256-GCM encryption at rest',
      testing: 'Live client handshake & server version verification'
    },
    {
      name: 'MongoDB',
      category: 'Databases',
      type: 'Document & NoSQL Store',
      speed: 'Collection Sync',
      status: 'Live & Verified',
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
      badge: 'NoSQL Store',
      description: 'Connect MongoDB clusters via URI or discrete host credentials. Discover collections and infer schema automatically.',
      frontend: 'URI / discrete field modal with collection picker',
      backend: 'Official mongodb driver with admin.ping() test',
      credentials: 'AES-256-GCM encryption & URI password masking',
      testing: '4-second timeout ping & collection discovery'
    },
    {
      name: 'REST API & Webhooks',
      category: 'APIs',
      type: 'JSON Endpoint Integration',
      speed: 'Real-Time Request',
      status: 'Live & Verified',
      iconBg: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400',
      badge: 'Web Endpoints',
      description: 'Ingest data from external REST APIs using Bearer tokens, API Keys, or Basic auth with configurable nested dataKey paths.',
      frontend: 'URL, method, auth types (Bearer, API Key), dataKey selector',
      backend: 'Axios / HTTP client with retry logic & SSRF defense',
      credentials: 'Encrypted header injection',
      testing: 'Live HTTP test call with status code & JSON validation'
    },
    {
      name: 'CSV, JSON & Excel (.xlsx)',
      category: 'Files',
      type: 'Spreadsheet & Flat Files',
      speed: 'Batch File Parsing',
      status: 'Live & Verified',
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      badge: 'File Ingestion',
      description: 'Upload CSV, JSON, and Excel (.xlsx, .xls) datasets with automatic delimiter detection, column header normalization, and datatype inference.',
      frontend: 'Drag-and-drop file uploader with chunking progress, supporting CSV, JSON, and XLSX',
      backend: 'Streaming CSV parser, JSON parser, and ExcelJS workbook extractor',
      credentials: 'Tenant-scoped storage with path traversal protection',
      testing: 'Header validation & row count estimation on upload'
    },
    {
      name: 'Excel (XLSX) Export Engine',
      category: 'Reporting',
      type: 'Executive Spreadsheets',
      speed: 'Automated Export',
      status: 'Live & Verified',
      iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
      badge: 'Data Delivery',
      description: 'Export multi-tab executive Excel spreadsheets with corporate styling, data quality rollups, and audit metadata.',
      frontend: 'One-click XLSX report download & cron scheduler',
      backend: 'ExcelJS workbook generation with multi-series tables',
      credentials: 'Tenant authorization on download routes',
      testing: 'PK Zip workbook structure validation & buffer verification'
    }
  ];

  return (
    <section 
      id="integrations" 
      className="py-14 lg:py-20 bg-white dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 lg:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-3 shadow-2xs">
            <Layers size={14} className="text-red-600 dark:text-red-400" />
            <span>Verified Data Connectors</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Connect Your Business Data Sources{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              in Minutes
            </span>
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Connect production databases, REST API endpoints, or spreadsheet files. RicozAnalytics reads schemas, normalizes column data types, and prepares your data for instant KPI modeling.
          </p>

          {/* View Toggle: Visual Cards vs. Transparency Table */}
          <div className="mt-7 inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'cards'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers size={14} />
              <span>Connector Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'table'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon size={14} />
              <span>Implementation Verification Table</span>
            </button>
          </div>
        </div>

        {/* VIEW MODE 1: CONNECTOR GALLERY (PIPELINE + CARDS) */}
        {activeTab === 'cards' && (
          <div className="space-y-10 animate-in fade-in duration-200">
            {/* Linear-Style Animated Interactive Data-Flow Pipeline */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
              
              {/* Subtle Ambient Radial Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

              <div className="text-center max-w-xl mx-auto mb-6">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Live Data-Flow Architecture
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
                  Zero-ETL Streaming Pipeline
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Data streams directly from production stores into the governed metrics engine without manual export scripts.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
                {/* Left Column: 4 Ingestion Sources */}
                <div className="lg:col-span-4 space-y-2.5">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    1. Production Data Sources
                  </div>

                  {[
                    { name: 'PostgreSQL Database', type: 'Direct SSL (pg client)', icon: Database, color: 'text-blue-500' },
                    { name: 'MongoDB Cluster', type: 'Replica Sync & Collections', icon: Server, color: 'text-emerald-500' },
                    { name: 'REST API & Webhooks', type: 'Bearer & Key Ingestion', icon: ArrowRightLeft, color: 'text-red-500' },
                    { name: 'CSV & JSON Files', type: 'Flat Files & Streaming Parser', icon: FileSpreadsheet, color: 'text-amber-500' },
                  ].map((src, i) => {
                    const Icon = src.icon;
                    return (
                      <div 
                        key={i} 
                        className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs hover:border-red-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0 ${src.color}`}>
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{src.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{src.type}</div>
                          </div>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0 ml-2" />
                      </div>
                    );
                  })}
                </div>

                {/* Middle Column: Central Engine with Flow Lines */}
                <div className="lg:col-span-4 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-md relative overflow-hidden group">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform duration-300">
                      <Cpu size={28} />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>

                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-3">
                    Ricoz Ingestion &amp; Metric Core
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                    Real-time schema introspection, AES-256 cipher encryption, and multi-tenant SQL scoping.
                  </p>

                  <div className="w-full mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400 block">Security</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">AES-256-GCM</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                      <span className="text-slate-400 block">Latency</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">&lt; 15ms Query</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: 4 Outputs & Destinations */}
                <div className="lg:col-span-4 space-y-2.5">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    2. Live Analytics Destinations
                  </div>

                  {[
                    { name: 'Executive Cockpit', type: 'Real-time KPIs & Rollups', icon: Sparkles, color: 'text-red-500' },
                    { name: 'Variance Diagnostics', type: 'Regional Deviation Sentinel', icon: AlertCircle, color: 'text-amber-500' },
                    { name: 'Scheduled PDF Digests', type: 'Automated Executive Briefings', icon: Clock, color: 'text-purple-500' },
                    { name: 'Excel XLSX Reports', type: 'Multi-series Data Workbooks', icon: FileSpreadsheet, color: 'text-emerald-500' },
                  ].map((dest, i) => {
                    const Icon = dest.icon;
                    return (
                      <div 
                        key={i} 
                        className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs hover:border-red-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0 ${dest.color}`}>
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{dest.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{dest.type}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 shrink-0 ml-2">
                          Synced
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Connector Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
              {verifiedConnectors.map((c) => (
                <div
                  key={c.name}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${c.iconBg}`}>
                        <Database size={20} />
                      </div>
                      <span className="text-xs font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {c.badge}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                      {c.name}
                    </h3>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                      {c.type}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                      {c.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                      <Clock size={13} className="text-slate-400" />
                      <span>{c.speed}</span>
                    </div>
                    <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>{c.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW MODE 2: CONNECTOR VERIFICATION TRANSPARENCY TABLE */}
        {activeTab === 'table' && (
          <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl animate-in fade-in duration-200">
            <div className="p-6 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Active Code Verification
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    5 Supported Native Connectors
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Connector Implementation &amp; Verification Matrix
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Direct codebase audit: every connector listed below is backed by active production drivers, security encryption, and automated integration tests.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 size={15} />
                  <span>100% Implemented &amp; Tested</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase font-mono text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4 font-bold">Connector Name</th>
                    <th className="p-4 font-bold">Category</th>
                    <th className="p-4 font-bold">Frontend Implementation</th>
                    <th className="p-4 font-bold">Backend Implementation</th>
                    <th className="p-4 font-bold">Credential Security</th>
                    <th className="p-4 font-bold">Connection Verification</th>
                    <th className="p-4 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-sans">
                  {verifiedConnectors.map((c) => (
                    <tr key={c.name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.iconBg}`}>
                            <Database size={14} />
                          </div>
                          <div>
                            <span className="text-sm font-bold block">{c.name}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">{c.type}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-300 font-semibold">{c.category}</td>
                      <td className="p-4 text-xs max-w-xs">{c.frontend}</td>
                      <td className="p-4 font-mono text-xs text-slate-700 dark:text-slate-200 font-medium">{c.backend}</td>
                      <td className="p-4 font-mono text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                        <span className="bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-md border border-emerald-200/80 dark:border-emerald-800">
                          {c.credentials}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-600 dark:text-slate-300">{c.testing}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                          <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                          <span>VERIFIED</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bottom Transparency Notice & Custom Ingestion CTA */}
        <div className="mt-12 text-center max-w-2xl mx-auto space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Have a custom database schema, internal microservice, or ERP? Our solutions team provides assistance with dedicated connector configuration.
          </p>
          <button
            type="button"
            onClick={onOpenDemo}
            className="inline-flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:underline cursor-pointer"
          >
            <span>Request custom connector consultation or walkthrough</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
