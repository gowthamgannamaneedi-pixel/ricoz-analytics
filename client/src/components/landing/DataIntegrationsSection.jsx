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
import Interactive3DCard from './Interactive3DCard';

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
      name: 'CSV & JSON Datasets',
      category: 'Files',
      type: 'Spreadsheet & Flat Files',
      speed: 'Batch File Parsing',
      status: 'Live & Verified',
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      badge: 'File Ingestion',
      description: 'Upload CSV and JSON datasets with automatic delimiter detection, column header normalization, and datatype inference.',
      frontend: 'Drag-and-drop file uploader with chunking progress',
      backend: 'Streaming CSV & JSON parser with schema normalization',
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
      className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200 dark:border-slate-800"
      style={{ perspective: '1200px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <Layers size={14} className="text-red-600 dark:text-red-400" />
            <span>Verified Data Connectors</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Connect Your Business Data Sources{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              in Minutes
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Connect production databases, REST API endpoints, or spreadsheet exports. RicozAnalytics reads schemas, normalizes column data types, and prepares your data for instant KPI modeling.
          </p>

          {/* View Toggle: Visual Cards vs. Transparency Table */}
          <div className="mt-8 inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'cards'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Connector Gallery
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

        {/* 3-Step Ingestion Architecture Workflow */}
        <div className="mb-14 p-6 sm:p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative">
            {/* Step 1 */}
            <div className="w-full lg:w-1/4 flex flex-col items-center lg:items-start text-center lg:text-left">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">Step 01 • Source Connection</span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Connect Your Data</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Connect PostgreSQL, MongoDB, REST endpoints, or drag-and-drop CSV/Excel spreadsheets.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={11} /> Read-only Credentials
                </span>
              </div>
            </div>

            {/* Arrow 1 */}
            <div className="hidden lg:flex items-center text-red-400 dark:text-red-500">
              <div className="w-12 border-t-2 border-dashed border-red-300 dark:border-red-800" />
              <ArrowRight size={18} className="-ml-1" />
            </div>

            {/* Step 2 */}
            <div className="w-full lg:w-1/3 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md relative overflow-hidden group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/30">
                  <Cpu size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Ricoz Ingestion Engine</h4>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Schema Introspection &amp; Normalization</div>
                </div>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-700 font-mono">
                <li className="flex items-center justify-between">
                  <span className="font-sans">Schema Discovery</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Automatic</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-sans">Credential Security</span>
                  <span className="text-slate-900 dark:text-white font-bold">AES-256-GCM</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-sans">Data Validation</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Strict Typing</span>
                </li>
              </ul>
            </div>

            {/* Arrow 2 */}
            <div className="hidden lg:flex items-center text-red-400 dark:text-red-500">
              <div className="w-12 border-t-2 border-dashed border-red-300 dark:border-red-800" />
              <ArrowRight size={18} className="-ml-1" />
            </div>

            {/* Step 3 */}
            <div className="w-full lg:w-1/4 flex flex-col items-center lg:items-end text-center lg:text-right">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Step 03 • Actionable Analytics</span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Unified Dashboard Views</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Build executive cockpits, schedule automated PDF digests, and monitor operational KPIs.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <ShieldCheck size={11} className="text-emerald-500" /> Organization Tenancy
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* VIEW MODE 1: CONNECTOR CARDS */}
        {activeTab === 'cards' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {verifiedConnectors.map((c) => (
              <Interactive3DCard
                key={c.name}
                maxTilt={12}
                scale={1.03}
                glare={true}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-800 shadow-sm transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3" style={{ transform: 'translateZ(15px)' }}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${c.iconBg}`}>
                      <Database size={20} />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {c.badge}
                    </span>
                  </div>

                  <h3 
                    className="text-base font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors"
                    style={{ transform: 'translateZ(20px)' }}
                  >
                    {c.name}
                  </h3>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    {c.type}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4" style={{ transform: 'translateZ(10px)' }}>
                    {c.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]" style={{ transform: 'translateZ(15px)' }}>
                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                    <Clock size={12} className="text-slate-400" />
                    <span>{c.speed}</span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>{c.status}</span>
                  </div>
                </div>
              </Interactive3DCard>
            ))}
          </div>
        )}

        {/* VIEW MODE 2: CONNECTOR VERIFICATION TRANSPARENCY TABLE */}
        {activeTab === 'table' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Connector Implementation &amp; Verification Matrix
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Full transparency: every connector listed is backed by active production code and tests.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                100% Implemented &amp; Tested
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-mono text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Connector Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Frontend Implementation</th>
                  <th className="p-3.5">Backend Implementation</th>
                  <th className="p-3.5">Credential Handling</th>
                  <th className="p-3.5">Connection Testing</th>
                  <th className="p-3.5">Production Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-sans">
                {verifiedConnectors.map((c) => (
                  <tr key={c.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{c.name}</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">{c.category}</td>
                    <td className="p-3.5 text-xs">{c.frontend}</td>
                    <td className="p-3.5 font-mono text-xs text-slate-600 dark:text-slate-300">{c.backend}</td>
                    <td className="p-3.5 font-mono text-xs text-emerald-700 dark:text-emerald-400 font-semibold">{c.credentials}</td>
                    <td className="p-3.5 text-xs">{c.testing}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        VERIFIED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
