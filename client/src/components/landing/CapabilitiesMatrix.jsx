import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  MapPin, 
  Target, 
  Truck, 
  Clock, 
  Users,
  Search,
  BarChart,
  GitCompare,
  Activity,
  ClipboardList,
  Zap,
  BellRing,
  BrainCircuit
} from 'lucide-react';

export default function CapabilitiesMatrix() {
  const analysisDomains = [
    { title: 'Revenue & Cashflow', desc: 'Real-time MRR, ARR, invoice velocity & EBITDA margins', icon: DollarSign },
    { title: 'Sales & Deal Pipeline', desc: 'Conversion funnels, rep quota pacing & stage velocity', icon: TrendingUp },
    { title: 'Product & SKU Velocity', desc: 'Fast vs dead inventory, gross profit contribution & stock-outs', icon: Package },
    { title: 'Regional Hub Performance', desc: 'Branch-by-branch revenue variance & operational SLA tracking', icon: MapPin },
    { title: 'Marketing Campaign ROI', desc: 'CAC, blended ROAS, lead attribution & omnichannel spend', icon: Target },
    { title: 'Supply Chain & Logistics', desc: 'Fulfillment times, supplier lead variances & order fulfillment', icon: Truck },
    { title: 'Operational Uptime', desc: 'Service-level commitments, incident MTTR & queue turnaround', icon: Clock },
    { title: 'Customer Lifetime Value', desc: 'Cohort retention curves, churn early-warning & Net Promoter Index', icon: Users },
  ];

  const actions = [
    { label: 'Ingest & Model', desc: 'Harmonize disparate tables into clean analytics schemas', icon: Search },
    { label: 'Visualize', desc: 'Render responsive, interactive charts with custom themes', icon: BarChart },
    { label: 'Compare & Benchmark', desc: 'Perform multi-period variance & target benchmarking', icon: GitCompare },
    { label: 'Monitor Live', desc: 'Real-time telemetry feeds with sub-second polling', icon: Activity },
    { label: 'Scheduled Reports', desc: 'Distribute automated pixel-perfect executive PDF/Excel decks', icon: ClipboardList },
    { label: 'Automate Workflows', desc: 'Trigger webhook workflows upon metric thresholds', icon: Zap },
    { label: 'Proactive Alerting', desc: 'Instant Slack, Email, and Webhook notifications', icon: BellRing },
    { label: 'Predictive AI', desc: 'Machine learning forecasts and root-cause diagnostics', icon: BrainCircuit },
  ];

  return (
    <section id="ai-automation" className="py-20 lg:py-28 bg-slate-50/50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Sub-section 1: What Can You Analyze */}
        <div>
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-100/80 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider">
              Comprehensive Domain Coverage
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              What Can You Analyze with RicozAnalytics?
            </h2>
            <p className="text-base text-slate-600">
              Cross-functional intelligence designed for leadership, finance, operations, and field managers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {analysisDomains.map((item) => (
              <div
                key={item.title}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-red-300 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-3.5 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <item.icon size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-section 2: What Can You Do With Your Data */}
        <div className="pt-12 border-t border-slate-200">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-bold uppercase tracking-wider">
              End-to-End Capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              What Can You Do With Your Business Data?
            </h2>
            <p className="text-base text-slate-600">
              Powerful tools to turn raw numbers into automated workflows and executive decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {actions.map((act) => (
              <div
                key={act.label}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-400 transition text-center flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3">
                  <act.icon size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{act.label}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{act.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
