import React from 'react';
import { 
  Database, 
  BarChart3, 
  Sliders, 
  Clock, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  FileText, 
  AlertCircle,
  Cpu,
  Layers,
  Lock,
  Download,
  Share2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Interactive3DCard from './Interactive3DCard';

export default function KeyFeaturesSection() {
  const features = [
    {
      id: 'lake',
      badge: 'Data Management & Ingestion',
      title: 'Unified Zero-ETL Data Lake',
      description: 'Connect PostgreSQL, MySQL, Snowflake, Supabase, and Google Sheets in minutes. Automatic schema discovery and type normalization.',
      graphic: (
        <div className="w-full h-44 rounded-xl bg-slate-950 p-3.5 font-mono text-[11px] text-slate-300 border border-slate-800 flex flex-col justify-between overflow-hidden shadow-inner group-hover:border-red-500/40 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-red-400 font-bold">
              <Database size={13} />
              <span>INGESTION_GATEWAY: ACTIVE</span>
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80 animate-pulse">
              1.2M rows/hr
            </span>
          </div>

          <div className="space-y-1.5 py-1">
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800/80 group-hover:bg-slate-900/90 transition-colors">
              <span className="text-slate-200">orders_fact_table</span>
              <span className="text-emerald-400 font-bold">Synced (14ms)</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800/80 group-hover:bg-slate-900/90 transition-colors">
              <span className="text-slate-200">franchise_branches_dim</span>
              <span className="text-emerald-400 font-bold">48 Nodes Live</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
            <span>Primary/Foreign Key Auto-Mapped</span>
            <span className="text-emerald-400">Zero Drops</span>
          </div>
        </div>
      ),
      bullets: [
        'Automated relational schema inference and type casting',
        'Real-time streaming and scheduled micro-batching',
        'Cross-table foreign key discovery with zero ETL code'
      ],
      linkText: 'Explore Data Architecture',
      linkUrl: '#integrations'
    },
    {
      id: 'formula',
      badge: 'Metrics & Performance Engine',
      title: 'Dynamic KPI & Formula Studio',
      description: 'Define formulaic enterprise KPIs, assign performance targets, and compute EBITDA, CAGR, and store variance without code.',
      graphic: (
        <div className="w-full h-44 rounded-xl bg-slate-950 p-3.5 font-mono text-[11px] text-slate-300 border border-slate-800 flex flex-col justify-between overflow-hidden shadow-inner group-hover:border-red-500/40 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Sliders size={13} />
              <span>FORMULA_STUDIO: COMPILED</span>
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
              112% Achieved
            </span>
          </div>

          {/* Formula Chips */}
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">[EBITDA]</span>
            <span className="text-slate-400">=</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">[Gross Revenue]</span>
            <span className="text-slate-400">-</span>
            <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">[Operating Costs]</span>
          </div>

          {/* Computed Output */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-200 font-bold">
              <span>Actual: ₹8,42,80,000</span>
              <span className="text-emerald-400">+₹92.8L Surplus</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-400" style={{ width: '85%' }} />
            </div>
          </div>
        </div>
      ),
      bullets: [
        'Custom metric formulas (e.g. Targets vs Actuals, ROI, Variance)',
        'Automated status grading (Healthy, Warning, Critical)',
        'Hierarchical grouping by Franchise, Region, or Department'
      ],
      linkText: 'Explore Formula Studio',
      linkUrl: '#analytics'
    },
    {
      id: 'visuals',
      badge: 'Visualization & Cockpits',
      title: 'Interactive Visual Dashboards',
      description: 'Build customizable analytical dashboards with drag-and-drop charts, multi-dimensional filter bars, and saved views.',
      graphic: (
        <div className="w-full h-44 rounded-xl bg-slate-950 p-3.5 font-mono text-[11px] text-slate-300 border border-slate-800 flex flex-col justify-between overflow-hidden shadow-inner group-hover:border-red-500/40 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-blue-400 font-bold">
              <BarChart3 size={13} />
              <span>COCKPIT_GRID_VIEW</span>
            </span>
            <span className="text-[10px] text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/80">
              Interactive Drilldown
            </span>
          </div>

          {/* Mini Bar & Area Mockup with hover lift */}
          <div className="h-20 flex items-end justify-between gap-1.5 px-2">
            <div className="w-1/6 bg-red-600 rounded-t h-1/2 group-hover:h-3/5 transition-all duration-300" />
            <div className="w-1/6 bg-red-500 rounded-t h-3/4 group-hover:h-4/5 transition-all duration-300" />
            <div className="w-1/6 bg-rose-500 rounded-t h-2/3 group-hover:h-3/4 transition-all duration-300" />
            <div className="w-1/6 bg-rose-400 rounded-t h-5/6 group-hover:h-full transition-all duration-300" />
            <div className="w-1/6 bg-red-600 rounded-t h-4/5 group-hover:h-5/6 transition-all duration-300" />
            <div className="w-1/6 bg-emerald-500 rounded-t h-full shadow-lg shadow-emerald-500/30" />
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
            <span>20+ Chart Variations</span>
            <span className="text-white font-bold">Cross-Metric Filtering</span>
          </div>
        </div>
      ),
      bullets: [
        'Area, Multi-Bar, Composed, Donut, Heatmaps & Sparklines',
        'Interactive drilldowns and instant cross-filtering',
        'Role-customized views for executives vs store managers'
      ],
      linkText: 'Explore Dashboards',
      linkUrl: '#analytics'
    },
    {
      id: 'reports',
      badge: 'Reports & Scheduled Dispatch',
      title: 'Automated Scheduled PDF Briefings',
      description: 'Configure cron schedules to automatically compile pixel-perfect executive PDF summaries and Excel workbooks delivered right to your inbox.',
      graphic: (
        <div className="w-full h-44 rounded-xl bg-slate-950 p-3.5 font-mono text-[11px] text-slate-300 border border-slate-800 flex flex-col justify-between overflow-hidden shadow-inner group-hover:border-red-500/40 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-purple-400 font-bold">
              <FileText size={13} />
              <span>EXECUTIVE_BRIEFING_ENGINE</span>
            </span>
            <span className="text-[10px] text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/80">
              Cron Active
            </span>
          </div>

          {/* Miniature Document Preview */}
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between group-hover:border-purple-500/40 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-8 h-9 rounded bg-red-600 text-white flex flex-col items-center justify-center font-bold text-[10px] shadow-sm">
                PDF
              </div>
              <div>
                <div className="text-white font-bold text-xs">Q3-Executive-Digest.pdf</div>
                <div className="text-[10px] text-slate-400">Schedule: Every Mon 08:00 AM IST</div>
              </div>
            </div>
            <Download size={14} className="text-slate-400 group-hover:text-white transition-colors" />
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
            <span>Automated Email Dispatch</span>
            <span className="text-emerald-400 font-bold">14 Stakeholders</span>
          </div>
        </div>
      ),
      bullets: [
        'Scheduled daily, weekly, and monthly automated email delivery',
        'Pixel-perfect PDF reports with corporate branding & headers',
        'Raw dataset exports in CSV, XLSX, and JSON formats'
      ],
      linkText: 'Explore Automated Reports',
      linkUrl: '#product'
    },
    {
      id: 'alerts',
      badge: 'Incidents & SLA Sentinel',
      title: 'Proactive Alerting & Thresholds',
      description: 'Eliminate operational blind spots with instant automated alerts triggered when key business metrics drop below tolerance thresholds.',
      graphic: (
        <div className="w-full h-44 rounded-xl bg-slate-950 p-3.5 font-mono text-[11px] text-slate-300 border border-slate-800 flex flex-col justify-between overflow-hidden shadow-inner group-hover:border-red-500/40 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-rose-400 font-bold">
              <AlertCircle size={13} />
              <span>INCIDENT_SENTINEL</span>
            </span>
            <span className="text-[10px] text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/80 animate-pulse">
              P1 Alert Active
            </span>
          </div>

          {/* Incident Trigger Card */}
          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs">
            <div className="flex justify-between text-[11px] text-rose-300 font-bold mb-1">
              <span>Gross Margin Warning</span>
              <span>-18.2% Tolerance Breach</span>
            </div>
            <div className="text-[10px] text-slate-300">
              Branch #19 triggered margin floor breach. Immediate diagnostic drawer opened.
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
            <span>Slack + Email + Webhook</span>
            <span className="text-emerald-400">Dispatched in 0.2s</span>
          </div>
        </div>
      ),
      bullets: [
        'Multi-condition threshold rules (e.g. Metric &lt; Threshold)',
        'Multi-channel dispatch (Slack, Email, In-App, Webhooks)',
        'Incident tracking with root-cause diagnostic drawer'
      ],
      linkText: 'Explore Alert Systems',
      linkUrl: '#product'
    },
    {
      id: 'security',
      badge: 'Enterprise Governance & RBAC',
      title: 'Granular Role-Based Governance',
      description: 'Protect sensitive revenue numbers with granular role permissions, row-level branch security, and immutable audit logging.',
      graphic: (
        <div className="w-full h-44 rounded-xl bg-slate-950 p-3.5 font-mono text-[11px] text-slate-300 border border-slate-800 flex flex-col justify-between overflow-hidden shadow-inner group-hover:border-red-500/40 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ShieldCheck size={13} />
              <span>SOVEREIGN_ACCESS_MATRIX</span>
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
              Enterprise RBAC
            </span>
          </div>

          {/* Role Badges Grid */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="p-1.5 rounded bg-purple-950/60 border border-purple-800/80 text-purple-300 flex justify-between">
              <span>Executive Admin</span>
              <span>Full Access</span>
            </div>
            <div className="p-1.5 rounded bg-blue-950/60 border border-blue-800/80 text-blue-300 flex justify-between">
              <span>Data Analyst</span>
              <span>SQL &amp; Models</span>
            </div>
            <div className="p-1.5 rounded bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 flex justify-between">
              <span>Franchise Lead</span>
              <span>Hub RLS</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex justify-between">
              <span>Viewer Role</span>
              <span>Read-Only</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
            <span>AES-256 Sovereign Encryption</span>
            <span className="text-white font-bold">Zero Cross-Tenant Leak</span>
          </div>
        </div>
      ),
      bullets: [
        'Pre-configured roles (Admin, Analyst, Manager, Franchise Lead, Viewer)',
        'Row-level security: branch managers only see their store records',
        'Audit logging tracks every dataset query and export event'
      ],
      linkText: 'Explore Security Architecture',
      linkUrl: '#security'
    }
  ];

  return (
    <section 
      id="features" 
      className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800 relative"
      style={{ perspective: '1200px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <Zap size={14} className="text-red-600 dark:text-red-400" />
            <span>Why RicozAnalytics</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Enterprise Architecture Built for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Modern Decision Velocity
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            From raw transaction ingestion to automated leadership briefings, RicozAnalytics handles every tier of your modern business intelligence lifecycle.
          </p>
        </div>

        {/* 6 Interactive 3D Feature Cards with Physics Mouse Tilt & Depth */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feat) => (
            <Interactive3DCard
              key={feat.id}
              maxTilt={12}
              scale={1.03}
              glare={true}
              className="rounded-3xl p-7 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-700 shadow-sm transition-colors group flex flex-col justify-between"
            >
              <div>
                {/* Badge (Pop-out Layer +15px) */}
                <div 
                  className="inline-block text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-md border border-red-200/80 dark:border-red-900/50 mb-3.5"
                  style={{ transform: 'translateZ(15px)' }}
                >
                  {feat.badge}
                </div>

                <h3 
                  className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors"
                  style={{ transform: 'translateZ(20px)' }}
                >
                  {feat.title}
                </h3>

                <p 
                  className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5"
                  style={{ transform: 'translateZ(10px)' }}
                >
                  {feat.description}
                </p>

                {/* Custom Graphic Widget (Pop-out Layer +25px) */}
                <div className="mb-6" style={{ transform: 'translateZ(25px)' }}>
                  {feat.graphic}
                </div>

                {/* Bullets */}
                <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 mb-6" style={{ transform: 'translateZ(15px)' }}>
                  {feat.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Link (Pop-out Layer +20px) */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800" style={{ transform: 'translateZ(20px)' }}>
                <a
                  href={feat.linkUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 hover:underline"
                >
                  <span>{feat.linkText}</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1.5 transition-transform" />
                </a>
              </div>
            </Interactive3DCard>
          ))}
        </div>
      </div>
    </section>
  );
}
