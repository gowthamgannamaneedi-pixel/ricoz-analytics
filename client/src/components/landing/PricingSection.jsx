import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Check, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Building2, 
  HelpCircle,
  Clock,
  Layers,
  Database
} from 'lucide-react';

export default function PricingSection({ onOpenDemo }) {
  const [billingCycle, setBillingCycle] = useState('annual'); // 'monthly' | 'annual'

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      badge: 'Teams & Single Hubs',
      description: 'Essential BI, real-time KPI tracking, and automated reporting for growing businesses.',
      monthlyPrice: '₹699',
      annualPrice: '₹583',
      annualBillingNote: 'Billed annually (₹6,999/yr)',
      monthlyBillingNote: 'Billed monthly (₹699/mo)',
      popular: false,
      ctaText: 'Start 14-Day Free Trial',
      ctaLink: '/register',
      ctaAction: null,
      features: [
        'Up to 5 live database connectors',
        '5 team member seats with role access',
        '100,000 synchronized records / month',
        'Core KPI Studio & formula metrics',
        'Interactive charts & dynamic filters',
        'Daily automated email briefings',
        'Standard export (PDF, CSV, XLSX)',
        'Community & standard email support'
      ]
    },
    {
      id: 'growth',
      name: 'Professional',
      badge: 'MOST POPULAR',
      description: 'Comprehensive business intelligence with AI Copilot, proactive alerts, and automated PDF delivery.',
      monthlyPrice: '₹1,999',
      annualPrice: '₹1,666',
      annualBillingNote: 'Billed annually (₹19,999/yr)',
      monthlyBillingNote: 'Billed monthly (₹1,999/mo)',
      popular: true,
      ctaText: 'Start 14-Day Free Trial',
      ctaLink: '/register',
      ctaAction: null,
      features: [
        'Live data connectors (PostgreSQL, MongoDB, REST, CSV/Excel)',
        '25 team member seats with granular RBAC',
        '1,000,000 synchronized records / month',
        'AI Analytics Copilot & natural language query assistant',
        'Proactive threshold anomaly alerts (Slack, Email)',
        'Structured executive PDF reports on automated schedule',
        'Cross-metric drilldowns & custom formula builder',
        'In-memory query caching & background data refresh',
        'Priority technical support & onboarding assistance'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      badge: 'Large Networks & Franchises',
      description: 'Dedicated cloud infrastructure, custom database integrations, and tailored SLA agreements.',
      monthlyPrice: '₹6,999',
      annualPrice: '₹5,833',
      annualBillingNote: 'Billed annually (₹69,999/yr onwards)',
      monthlyBillingNote: 'Billed monthly (₹6,999/mo onwards)',
      popular: false,
      ctaText: 'Talk to Solutions Architect',
      ctaLink: null,
      ctaAction: onOpenDemo,
      features: [
        'Dedicated isolated database & customized ingestion',
        'Unlimited team seats & franchise branch logins',
        'High-capacity monthly records & scheduled sync',
        'Custom REST & webhook data connectors',
        'Row-level data governance by region / store code',
        'Server-enforced role-based access control (RBAC)',
        'Dedicated virtual private cloud deployment option',
        'Dedicated Support Engineer & Enterprise Uptime SLA',
        'Custom feature development & formal SLA contract'
      ]
    }
  ];

  return (
    <section 
      id="pricing" 
      className="py-14 lg:py-20 bg-slate-50/70 dark:bg-[#0B0F19] border-t border-slate-200/80 dark:border-slate-800 transition-colors duration-200 relative"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 lg:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-3 shadow-2xs">
            <Sparkles size={14} className="text-red-600 dark:text-red-400" />
            <span>Transparent Enterprise Pricing</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Predictable Investment for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Measurable ROI
            </span>
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Every plan includes our 14-day full-featured trial. Zero setup fees. No credit card required to start.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="mt-7 inline-flex items-center p-1.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                billingCycle === 'annual' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              }`}>
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => {
            const isCustom = plan.monthlyPrice === 'Custom';
            const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
            const billingSubtext = billingCycle === 'annual' ? plan.annualBillingNote : plan.monthlyBillingNote;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl transition-all duration-200 ${
                  plan.popular
                    ? 'bg-white dark:bg-slate-900 border-2 border-red-600 dark:border-red-500 shadow-xl shadow-red-600/10'
                    : 'bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                }`}
              >
                {/* Popular Pill */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/40 flex items-center gap-1.5 z-30">
                    <Sparkles size={12} />
                    <span>{plan.badge}</span>
                  </div>
                )}

                <div className="p-7 sm:p-8 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Tier Title & Badge */}
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        {plan.name}
                      </h3>
                      {!plan.popular && (
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 min-h-[44px] leading-relaxed mb-6">
                      {plan.description}
                    </p>

                    {/* Price Tag */}
                    <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight ${isCustom ? 'font-sans' : 'font-mono'}`}>
                          {price}
                        </span>
                        {!isCustom && (
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                            / month
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                        {billingSubtext}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="mb-8">
                      {plan.ctaLink ? (
                        <Link
                          to={plan.ctaLink}
                          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                            plan.popular
                              ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 hover:shadow-red-600/50'
                              : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{plan.ctaText}</span>
                          <ArrowRight size={16} />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={plan.ctaAction}
                          className="w-full py-3.5 px-6 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-200 cursor-pointer"
                        >
                          <Building2 size={16} />
                          <span>{plan.ctaText}</span>
                        </button>
                      )}
                    </div>

                    {/* Feature List */}
                    <div className="space-y-3.5">
                      <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Included Capabilities:
                      </div>
                      <ul className="space-y-3 text-sm sm:text-[15px] text-slate-600 dark:text-slate-300">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <div className={`mt-0.5 rounded-full p-0.5 shrink-0 ${
                              plan.popular 
                                ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' 
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              <Check size={14} strokeWidth={3} />
                            </div>
                            <span className="leading-snug">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Trust Strip */}
        <div className="mt-14 pt-10 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 shadow-xs">
              <Clock size={20} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">14-Day Free Trial</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Full feature access, no credit card</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 shadow-xs">
              <Zap size={20} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Sub-3 Minute Setup</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Connect databases without engineering</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Enterprise RBAC &amp; Security</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AES-256 credential encryption &amp; TLS 1.3 transport</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 shadow-xs">
              <Database size={20} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Zero Vendor Lock-in</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Export datasets anytime in CSV, JSON &amp; SQL</div>
          </div>
        </div>
      </div>
    </section>
  );
}
