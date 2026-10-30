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
import { useInView } from './useScrollAnimation';

export default function CapabilitiesMatrix() {
  const [sectionRef, inView] = useInView({ threshold: 0.1 });

  const analysisDomains = [
    { title: 'Revenue & Cashflow', desc: 'Real-time MRR, ARR, invoice velocity & EBITDA margins', icon: DollarSign, delay: 'rz-delay-75' },
    { title: 'Sales & Deal Pipeline', desc: 'Conversion funnels, rep quota pacing & stage velocity', icon: TrendingUp, delay: 'rz-delay-100' },
    { title: 'Product & SKU Velocity', desc: 'Fast vs dead inventory, gross profit contribution & stock-outs', icon: Package, delay: 'rz-delay-150' },
    { title: 'Regional Hub Performance', desc: 'Branch-by-branch revenue variance & operational SLA tracking', icon: MapPin, delay: 'rz-delay-200' },
    { title: 'Marketing Campaign ROI', desc: 'CAC, blended ROAS, lead attribution & omnichannel spend', icon: Target, delay: 'rz-delay-250' },
    { title: 'Supply Chain & Logistics', desc: 'Fulfillment times, supplier lead variances & order fulfillment', icon: Truck, delay: 'rz-delay-300' },
    { title: 'Operational Uptime', desc: 'Service-level commitments, incident MTTR & queue turnaround', icon: Clock, delay: 'rz-delay-350' },
    { title: 'Customer Lifetime Value', desc: 'Cohort retention curves, churn early-warning & Net Promoter Index', icon: Users, delay: 'rz-delay-400' },
  ];

  const actions = [
    { label: 'Ingest & Model', desc: 'Harmonize disparate tables into clean analytics schemas', icon: Search, delay: 'rz-delay-75' },
    { label: 'Visualize', desc: 'Render responsive, interactive charts with custom themes', icon: BarChart, delay: 'rz-delay-100' },
    { label: 'Compare & Benchmark', desc: 'Perform multi-period variance & target benchmarking', icon: GitCompare, delay: 'rz-delay-150' },
    { label: 'Monitor Live', desc: 'Real-time telemetry feeds with sub-second polling', icon: Activity, delay: 'rz-delay-200' },
    { label: 'Scheduled Reports', desc: 'Distribute automated pixel-perfect executive PDF/Excel decks', icon: ClipboardList, delay: 'rz-delay-250' },
    { label: 'Automate Workflows', desc: 'Trigger webhook workflows upon metric thresholds', icon: Zap, delay: 'rz-delay-300' },
    { label: 'Proactive Alerting', desc: 'Instant Slack, Email, and Webhook notifications', icon: BellRing, delay: 'rz-delay-350' },
    { label: 'Predictive AI', desc: 'Machine learning forecasts and root-cause diagnostics', icon: BrainCircuit, delay: 'rz-delay-400' },
  ];

  return (
    <section 
      ref={sectionRef}
      id="ai-automation" 
      className="py-20 lg:py-28 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 transition-colors duration-200 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Sub-section 1: What Can You Analyze */}
        <div>
          <div className={`max-w-3xl mx-auto text-center space-y-4 mb-14 rz-reveal ${inView ? 'is-revealed' : ''}`}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-100/80 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wider">
              Comprehensive Domain Coverage
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              What Can You Analyze with RicozAnalytics?
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Cross-functional intelligence designed for leadership, finance, operations, and field managers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {analysisDomains.map((item) => (
              <div
                key={item.title}
                className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-xl hover:border-red-400 dark:hover:border-red-800 hover:-translate-y-1 transition-all duration-300 group rz-reveal ${item.delay} ${
                  inView ? 'is-revealed' : ''
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-3.5 group-hover:bg-red-600 group-hover:text-white transition-colors duration-300 shadow-xs">
                  <item.icon size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{item.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-section 2: What Can You Do With Your Data */}
        <div className="pt-12 border-t border-slate-200 dark:border-slate-800">
          <div className={`max-w-3xl mx-auto text-center space-y-4 mb-14 rz-reveal ${inView ? 'is-revealed' : ''}`}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200/80 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wider">
              End-to-End Capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              What Can You Do With Your Business Data?
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Powerful tools to turn raw numbers into automated workflows and executive decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {actions.map((act) => (
              <div
                key={act.label}
                className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-xl hover:border-red-400 dark:hover:border-red-800 hover:-translate-y-1 transition-all duration-300 group rz-reveal ${act.delay} ${
                  inView ? 'is-revealed' : ''
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-3.5 group-hover:bg-red-600 group-hover:text-white transition-colors duration-300 shadow-xs">
                  <act.icon size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{act.label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{act.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
