import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Check, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Building2, 
  Clock, 
  Database 
} from 'lucide-react';

/**
 * Authoritative Backend-Aligned Pricing Configuration
 * Synchronized with server/config/plans.js
 */
const BASE_PLANS = [
  {
    id: 'starter',
    backendPlanId: 'starter',
    name: 'Starter',
    audienceBadge: 'Teams & Hubs',
    description: 'Essential BI, real-time KPI tracking, and automated reporting for growing businesses.',
    monthlyPrice: 699,
    annualPrice: 6710,
    popular: false,
    priceSuffix: '',
    ctaText: 'Start 14-Day Free Trial',
    ctaLink: '/register',
    features: [
      'Up to 10 connected datasets',
      '5 team member seats with role access',
      'Core KPI Studio & formula metrics',
      'Interactive charts & dynamic filters',
      'Daily automated email briefings',
      'Standard export (PDF, CSV, XLSX)',
      'Community & standard email support'
    ]
  },
  {
    id: 'growth',
    backendPlanId: 'growth',
    name: 'Professional',
    audienceBadge: 'Scaling Teams',
    description: 'Comprehensive business intelligence with AI Copilot, proactive alerts, and automated PDF delivery.',
    monthlyPrice: 1999,
    annualPrice: 19190,
    popular: true,
    priceSuffix: '',
    ctaText: 'Start 14-Day Free Trial',
    ctaLink: '/register',
    features: [
      'Up to 50 connected datasets',
      '25 team member seats with granular RBAC',
      'Executive AI Insights & natural language assistant',
      'Real-time anomaly & threshold alerts',
      'Structured executive PDF reports on automated schedule',
      'Cross-metric drilldowns & custom formula builder',
      'In-memory query caching & background data refresh',
      'Priority SLA technical support'
    ]
  },
  {
    id: 'enterprise',
    backendPlanId: 'enterprise',
    name: 'Enterprise',
    audienceBadge: 'Multi-Franchise',
    description: 'Dedicated cloud infrastructure, custom database integrations, and tailored SLA agreements.',
    monthlyPrice: 6999,
    annualPrice: 67190,
    popular: false,
    priceSuffix: ' onwards',
    ctaText: 'Talk to Solutions Architect',
    ctaLink: null,
    features: [
      'Unlimited datasets & dedicated database isolation',
      'Unlimited team seats & franchise branch logins',
      'Custom REST, PostgreSQL, MongoDB data connectors',
      'Row-level data governance by region / store code',
      'Server-enforced role-based access control (RBAC)',
      'Dedicated virtual private cloud deployment option',
      'Dedicated Support Engineer & Enterprise Uptime SLA',
      'Tailored custom SLA & procurement contracts'
    ]
  }
];

export default function PricingSection({ onOpenDemo }) {
  const [billingCycle, setBillingCycle] = useState('annual'); // 'monthly' | 'annual'

  // Dynamic mathematical savings & pricing computation for each plan
  const computedPlans = BASE_PLANS.map((plan) => {
    const hasAnnual = typeof plan.annualPrice === 'number' && plan.annualPrice > 0;
    const fullAnnualMonthlyEquivalent = plan.monthlyPrice * 12;
    const annualSavings = hasAnnual ? fullAnnualMonthlyEquivalent - plan.annualPrice : 0;
    
    // discount = ((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100
    const discountPercent = hasAnnual
      ? Math.round(((fullAnnualMonthlyEquivalent - plan.annualPrice) / fullAnnualMonthlyEquivalent) * 100)
      : 0;

    // Equivalent monthly amount when billed annually
    const equivalentMonthly = hasAnnual
      ? Math.round(plan.annualPrice / 12)
      : plan.monthlyPrice;

    return {
      ...plan,
      hasAnnual,
      annualSavings,
      discountPercent,
      equivalentMonthly,
      formattedMonthly: `₹${plan.monthlyPrice.toLocaleString('en-IN')}`,
      formattedAnnual: hasAnnual ? `₹${plan.annualPrice.toLocaleString('en-IN')}` : null,
      formattedEquivalentMonthly: `₹${equivalentMonthly.toLocaleString('en-IN')}`,
      formattedAnnualSavings: `₹${annualSavings.toLocaleString('en-IN')}`
    };
  });

  // Calculate dynamic maximum savings for the switcher toggle
  const maxDiscountPercent = Math.max(...computedPlans.map((p) => p.discountPercent));

  return (
    <section 
      id="pricing" 
      className="py-20 lg:py-28 bg-slate-50/70 dark:bg-[#0B0F19] border-t border-slate-200/80 dark:border-slate-800 transition-colors duration-200 relative overflow-hidden"
    >
      {/* Background Decorative Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-red-600/5 dark:bg-red-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <Sparkles size={14} className="text-red-600 dark:text-red-400" />
            <span>Transparent Enterprise Pricing</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Predictable Investment for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-rose-600 to-red-700">
              Measurable ROI
            </span>
          </h2>

          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Every plan includes our 14-day full-featured trial. Zero setup fees. No credit card required to start.
          </p>

          {/* Dynamic Billing Cycle Switcher */}
          <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wide ${
                billingCycle === 'annual' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              }`}>
                Save {maxDiscountPercent}%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid — Guaranteed Consistent Visual Baseline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-2">
          {computedPlans.map((plan) => {
            const isAnnual = billingCycle === 'annual';
            const price = isAnnual ? plan.formattedEquivalentMonthly : plan.formattedMonthly;
            
            // Subtext descriptions synchronized with the active billing cycle
            let billingSubtext = '';
            if (isAnnual) {
              if (plan.hasAnnual) {
                billingSubtext = `Billed annually at ${plan.formattedAnnual}/yr${plan.priceSuffix} (Save ${plan.formattedAnnualSavings}/yr)`;
              } else {
                billingSubtext = 'Custom annual billing — Contact sales';
              }
            } else {
              billingSubtext = `Billed monthly (${plan.formattedMonthly}/mo${plan.priceSuffix})`;
            }

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl transition-all duration-200 ${
                  plan.popular
                    ? 'bg-white dark:bg-slate-900 border-2 border-red-600 dark:border-red-500 shadow-xl shadow-red-600/10'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Most Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/40 flex items-center gap-1.5 z-20">
                    <Sparkles size={12} />
                    <span>Most Popular</span>
                  </div>
                )}

                <div className="p-7 sm:p-8 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header Row: Audience Badge & Dynamic Savings Pill */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200/80 dark:border-slate-700/80">
                        {plan.audienceBadge}
                      </span>
                      {isAnnual && plan.hasAnnual && plan.discountPercent > 0 && (
                        <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/80">
                          Save {plan.discountPercent}%
                        </span>
                      )}
                    </div>

                    {/* Plan Name */}
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                      {plan.name}
                    </h3>

                    {/* Plan Description — Standardized fixed height to guarantee price baseline alignment */}
                    <p className="text-sm text-slate-600 dark:text-slate-300 h-12 leading-relaxed mb-6 font-normal line-clamp-2">
                      {plan.description}
                    </p>

                    {/* Price Block — Standardized fixed height to guarantee CTA baseline alignment */}
                    <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-800 h-28 flex flex-col justify-between">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                          {price}
                        </span>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                          / month{plan.priceSuffix}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium break-words leading-snug h-8 flex items-center">
                        {billingSubtext}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="mb-8">
                      {plan.ctaLink ? (
                        <Link
                          to={`${plan.ctaLink}?plan=${plan.backendPlanId}&billing=${billingCycle}`}
                          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer ${
                            plan.popular
                              ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30'
                              : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{plan.ctaText}</span>
                          <ArrowRight size={16} />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={onOpenDemo}
                          className="w-full py-3.5 px-6 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-150 cursor-pointer"
                        >
                          <Building2 size={16} />
                          <span>{plan.ctaText}</span>
                        </button>
                      )}
                    </div>

                    {/* Included Capabilities List */}
                    <div className="space-y-3.5">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Included Capabilities:
                      </div>
                      <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <div className={`mt-0.5 rounded-full p-0.5 shrink-0 ${
                              plan.popular 
                                ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' 
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              <Check size={14} strokeWidth={3} />
                            </div>
                            <span className="leading-snug break-words">{feat}</span>
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
        <div className="mt-16 pt-10 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 shadow-2xs">
              <Clock size={20} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">14-Day Free Trial</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Full feature access, zero credit card</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 shadow-2xs">
              <Zap size={20} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Sub-3 Minute Setup</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Connect databases without engineering</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 shadow-2xs">
              <ShieldCheck size={20} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Enterprise RBAC &amp; Security</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AES-256 encryption &amp; tenant isolation</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 shadow-2xs">
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
