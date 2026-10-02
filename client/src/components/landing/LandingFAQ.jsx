import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export default function LandingFAQ() {
  const [openIdx, setOpenIdx] = useState(0);

  const faqs = [
    {
      q: 'How quickly can we connect our existing data sources to RicozAnalytics?',
      a: 'Most organizations are fully operational in under 15 minutes. You can instantly connect PostgreSQL, MySQL, Supabase, Snowflake, or upload CSV/Excel files. The system automatically scans your schema, infers column datatypes, and generates starter KPIs without writing boilerplate code.'
    },
    {
      q: 'Can we configure custom KPI formulas and variance thresholds for our franchise branches?',
      a: 'Yes. The KPI Studio allows you to create weighted formulas, percentage targets, variance calculations (e.g. Actual vs Monthly Budget), and multi-tier alerting rules. You can track performance across specific branches, sales channels, or operational units.'
    },
    {
      q: 'How does RicozAnalytics handle role-based access control (RBAC) and privacy?',
      a: 'RicozAnalytics provides granular permissions across Admin, Analyst, and Viewer tiers. You can restrict sensitive financial data, customer details, or specific datasets so branch managers only see their respective hub while corporate leadership has consolidated visibility.'
    },
    {
      q: 'Can we schedule automated executive PDF and Excel reports?',
      a: 'Absolutely. You can set automated cron schedules (daily morning digests, weekly board summaries, or monthly financial rollups). RicozAnalytics compiles high-resolution executive PDFs and spreadsheets and delivers them via email or Slack automatically.'
    },
    {
      q: 'What AI and predictive analytics capabilities are built into the platform?',
      a: 'The platform includes real-time anomaly detection, seasonality-aware trend forecasting (e.g. projecting Q3/Q4 revenue trajectories), automated root-cause diagnosis for metrics that breach thresholds, and an AI conversational copilot to query your datasets in natural English.'
    },
    {
      q: 'Can RicozAnalytics scale with large enterprise datasets and millions of transactions?',
      a: 'Yes. RicozAnalytics utilizes optimized streaming pipelines, indexed aggregation caching, and sub-second query rendering designed to handle millions of records across multi-regional franchise operations with 99.9% uptime SLA.'
    }
  ];

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? -1 : idx);
  };

  return (
    <section id="faq" className="py-20 lg:py-28 bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider">
            Frequently Asked Questions
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            Everything You Need to Know
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            Have questions about architecture, security, or onboarding? Find your answers here.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl transition-all duration-200 border ${
                  isOpen
                    ? 'bg-red-50/30 border-red-200 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full py-5 px-6 flex items-center justify-between text-left focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-bold text-slate-900 pr-4">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      isOpen ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-red-100/60 animate-fadeIn">
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
