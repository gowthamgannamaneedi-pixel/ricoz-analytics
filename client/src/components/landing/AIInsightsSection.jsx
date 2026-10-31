import React, { useState } from 'react';
import { 
  Sparkles, 
  Bot, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  ShieldCheck,
  ChevronRight,
  BellRing
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AIInsightsSection({ onOpenDemo }) {
  const [activeQueryIndex, setActiveQueryIndex] = useState(0);

  const queryDemos = [
    {
      prompt: 'Why did South region revenue increase +28.4% this quarter?',
      category: 'Variance Breakdown',
      correlation: 'Sample Retail Dataset (Q3)',
      executiveSummary: 'In this sample dataset, the South Region revenue surplus was driven by retail reorders at Bangalore and Chennai hubs, accompanied by an increase in average ticket size following the Q2 product expansion.',
      drivers: [
        { name: 'Bangalore & Chennai Hub expansion', impact: '+16.2%', positive: true },
        { name: 'Average order basket size increase', impact: '+7.4%', positive: true },
        { name: 'Repeat store orders', impact: '+4.8%', positive: true },
      ],
      recommendedAction: 'Review inventory buffer recommendations for South regional fulfillment nodes to maintain order fulfillment rates.',
      metrics: {
        latency: 'Dataset Query',
        scannedRows: '48 Hubs Evaluated',
        model: 'Ricoz Analytics Assistant'
      }
    },
    {
      prompt: 'Estimate gross margin impact if supply costs rise by 4.5%',
      category: 'Scenario Simulation',
      correlation: 'What-If Simulation (Sample Data)',
      executiveSummary: 'A 4.5% increase in supply chain input costs is estimated to compress gross margin from 68.4% to approximately 65.5% (approx ₹24.5 Lakhs gross profit variance) across active retail branches in this dataset.',
      drivers: [
        { name: 'Gross supply chain input cost shift', impact: '-₹24.5L', positive: false },
        { name: 'Franchise volume buffer', impact: '+₹8.2L', positive: true },
        { name: 'Projected gross margin buffer', impact: '65.5% margin', positive: true },
      ],
      recommendedAction: 'Evaluate alternative supplier tiers in Procurement module to offset anticipated material cost changes.',
      metrics: {
        latency: 'What-If Model',
        scannedRows: 'Cost Parameter Evaluation',
        model: 'Scenario Planning Engine'
      }
    },
    {
      prompt: 'Check for margin variance and alerts across branches',
      category: 'Threshold Monitoring',
      correlation: 'Operational Alert Rule',
      executiveSummary: 'Automated threshold monitoring identified 1 operational variance: Hub #19 (Hyderabad West) exhibited a -14.2% margin contraction vs target, traced to a temporary local vendor price adjustment.',
      drivers: [
        { name: 'Hub #19 Local freight and vendor variance', impact: '-14.2%', positive: false },
        { name: 'Remaining 47 hubs within normal margin bounds', impact: 'Nominal', positive: true },
        { name: 'Vendor credit reconciliation pending', impact: '+₹4.2L', positive: true },
      ],
      recommendedAction: 'Notification dispatched to Regional Operations Manager with direct link to source transaction table.',
      metrics: {
        latency: 'Configurable Rule',
        scannedRows: 'Branch Monitoring',
        model: 'Threshold Alert Evaluator'
      }
    }
  ];

  const currentQuery = queryDemos[activeQueryIndex];

  return (
    <section 
      id="ai-insights" 
      className="py-12 lg:py-16 bg-white dark:bg-[#0B0F19] transition-colors duration-200 border-t border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with tight, balanced spacing */}
        <div className="text-center max-w-3xl mx-auto mb-8 lg:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-3 shadow-2xs">
            <Sparkles size={14} className="text-red-600 dark:text-red-400" />
            <span>AI Analytics Assistant</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Ask Questions in Natural English.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Get Clear Business Summaries.
            </span>
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Query your business datasets without writing SQL. The assistant summarizes key metrics, explains variance drivers, and projects what-if operational scenarios.
          </p>
        </div>

        {/* Cohesive Two-Column Product Demonstration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-stretch">
          
          {/* Left Column: Interactive Copilot Studio (7 cols) */}
          <div className="lg:col-span-7 bg-slate-50/80 dark:bg-slate-900/80 rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              {/* Studio Header Bar */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/20">
                    <Bot size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">
                      Ricoz Analytics Assistant
                    </h3>
                    <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                      Natural Language Dataset Querying
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Interactive Demo
                  </span>
                </div>
              </div>

              {/* Suggested Business Questions */}
              <div className="mb-5 space-y-2.5">
                <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Select a business question:
                </div>
                <div className="flex flex-col gap-2">
                  {queryDemos.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveQueryIndex(idx)}
                      className={`w-full text-left p-3.5 rounded-xl text-sm sm:text-[15px] font-medium transition-all duration-150 flex items-center justify-between cursor-pointer ${
                        activeQueryIndex === idx
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/25 font-semibold'
                          : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-slate-600 shadow-2xs'
                      }`}
                    >
                      <span className="truncate pr-2">"{q.prompt}"</span>
                      <span className={`text-xs font-mono uppercase px-2.5 py-0.5 rounded font-bold shrink-0 ${
                        activeQueryIndex === idx
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {q.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Synthesized Answer Card */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs text-slate-800 dark:text-slate-200">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold mb-3.5">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm sm:text-base font-bold">
                    <Sparkles size={17} />
                    <span>Synthesized Business Summary</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800">
                    {currentQuery.correlation}
                  </span>
                </div>

                <p className="text-[15px] sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed font-normal mb-4">
                  {currentQuery.executiveSummary}
                </p>

                {/* Contributing Factor Rows */}
                <div className="mb-4 space-y-2">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Contributing Factors:
                  </div>
                  {currentQuery.drivers.map((d, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-sm sm:text-[15px]"
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{d.name}</span>
                      <span className={`font-mono font-bold text-sm sm:text-base ${
                        d.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {d.impact}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Recommended Operational Action */}
                <div className="p-4 rounded-xl bg-red-50/70 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/50">
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1.5">
                    <Zap size={15} />
                    <span>Operational Recommendation:</span>
                  </div>
                  <p className="text-sm sm:text-[15px] text-slate-800 dark:text-slate-100 leading-relaxed font-medium">
                    {currentQuery.recommendedAction}
                  </p>
                </div>

                {/* Evaluation Metadata Footnote */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400">
                  <span>{currentQuery.metrics.latency}</span>
                  <span>{currentQuery.metrics.scannedRows}</span>
                  <span>{currentQuery.metrics.model}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Anomaly Sentinel & Data Privacy (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            
            {/* Card 1: Automated Anomaly Sentinel */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-sm flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/20">
                      <AlertTriangle size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">
                        Automated Anomaly Sentinel
                      </h3>
                      <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Configurable KPI Threshold Alerts
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-mono font-bold">
                    Rule Active
                  </span>
                </div>

                <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Set custom deviation rules on gross margin and revenue. When a branch or product category contracts beyond your planned corridor, alerts dispatch automatically.
                </p>

                {/* Live Incident Demonstration */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-mono space-y-2 mb-4 text-slate-800 dark:text-slate-200">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold">INCIDENT: #ANM-8041</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">THRESHOLD WARNING</span>
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 font-sans text-sm">
                    Margin variance detected in West Region Hub 19 (-14.2% below planned target corridor).
                  </div>
                  <div className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800 font-medium">
                    <CheckCircle2 size={15} />
                    <span>Notification dispatched to Regional Operations Director</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 font-medium">
                <span>Alert Type: Threshold Rules</span>
                <span className="text-red-600 dark:text-red-400 font-bold">Email &amp; In-App Notifications</span>
              </div>
            </div>

            {/* Card 2: Privacy & Governance Safeguard */}
            <div className="p-6 sm:p-7 rounded-3xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">
                    Enterprise Data Privacy &amp; Tenancy
                  </h3>
                  <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Zero Public Model Training
                  </div>
                </div>
              </div>

              <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Your enterprise metrics remain strictly within your organization boundary. Queries execute in your isolated workspace, and data is never used to train public foundation models.
              </p>

              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <Link
                  to="/register"
                  className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Test AI Assistant in 14-day free trial</span>
                  <ChevronRight size={15} />
                </Link>
                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  Book Walkthrough
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
