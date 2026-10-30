import React, { useState } from 'react';
import { Plus, Minus, Search, HelpCircle, Sparkles, ArrowRight } from 'lucide-react';

export default function LandingFAQ() {
  const [openIdx, setOpenIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      q: 'How quickly can our team connect existing databases and see live dashboards?',
      a: 'Most organizations are fully operational in under 3 minutes. With read-only credentials, you can instantly connect PostgreSQL, MySQL, Supabase, Snowflake, BigQuery, or upload Google Sheets and CSVs. RicozAnalytics automatically scans your schema, infers column datatypes, discovers foreign key relationships, and builds starter executive KPI widgets without writing ETL pipelines.'
    },
    {
      q: 'Does RicozAnalytics train public AI models on our proprietary business data?',
      a: 'Absolutely not. All enterprise analytics, forecasting queries, and anomaly scans execute strictly within your sovereign tenant boundary. We enforce a strict zero-data-retention policy for machine learning training, ensuring your trade secrets, store revenues, and vendor pricing are never exposed to public foundation models.'
    },
    {
      q: 'Can we automate and schedule executive PDF reports to be emailed weekly?',
      a: 'Yes. The Scheduled Briefing Engine lets you set cron schedules (e.g., Every Monday at 08:00 AM IST). RicozAnalytics compiles high-resolution, pixel-perfect executive PDF briefings with corporate headers and embeds multi-series performance charts, automatically delivering them via email or Slack to your board and regional managers.'
    },
    {
      q: 'How does multi-branch and franchise data segmentation work?',
      a: 'Using Granular Role-Based Access Control (RBAC) and Row-Level Security (RLS), branch managers only access data belonging to their specific franchise store ID. Corporate leadership and regional directors see consolidated performance rollups across all 48+ hubs with interactive regional drilldowns.'
    },
    {
      q: 'What happens after our 14-day free trial ends?',
      a: 'Your trial includes full access to all Professional features with zero credit card required upfront. When the trial finishes, you can choose the plan that best fits your scale (Starter, Professional, or Enterprise Sovereign), or your workspace will transition to read-only export mode so your historical metrics are never lost.'
    },
    {
      q: 'Can RicozAnalytics replace legacy BI tools like Tableau, PowerBI, or Metabase?',
      a: 'Yes. Unlike legacy BI tools that require dedicated data engineering teams, weeks of complex DAX modeling, and expensive per-viewer licenses, RicozAnalytics is purpose-built for fast-moving business leadership with zero-code formula builders, sub-second query caching, and proactive AI anomaly alerts.'
    },
    {
      q: 'Can we configure custom formula KPIs (e.g. EBITDA, Gross Margin %)?',
      a: 'Yes! The Dynamic KPI Studio allows you to compose formulaic metrics like [EBITDA] = [Gross Revenue] - [COGS] - [OpEx] using simple drag-and-drop metric tokens. You can set multi-tier status thresholds (Healthy, Warning, Critical) with automated alerts triggered whenever numbers deviate from your operational plan.'
    }
  ];

  const filteredFaqs = searchQuery
    ? faqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : faqs;

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? -1 : idx);
  };

  return (
    <section 
      id="faq" 
      className="py-20 lg:py-28 bg-white dark:bg-[#0B0F19] border-t border-slate-200/80 dark:border-slate-800 transition-colors duration-200"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <HelpCircle size={14} className="text-red-600 dark:text-red-400" />
            <span>Frequently Asked Questions</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Clear Answers for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Enterprise Decision Makers
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Have questions about architecture, security, or database compatibility? Find your answers here or speak directly with our engineering team.
          </p>

          {/* Search Box */}
          <div className="mt-8 relative max-w-md mx-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions (e.g. security, pricing, PostgreSQL)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3.5">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl transition-all duration-200 border ${
                  isOpen
                    ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-sm'
                    : 'bg-white dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full py-4.5 px-6 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white pr-4">
                    {faq.q}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                      isOpen 
                        ? 'bg-red-600 text-white rotate-180' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-red-100/60 dark:border-red-900/40 animate-fadeIn">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
