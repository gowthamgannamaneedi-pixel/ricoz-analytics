import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Loader2,
  ExternalLink,
  HelpCircle,
  Lock,
  Calendar,
  Layers,
  Users,
  BarChart3,
  ChevronRight,
  Tag,
  History,
  ArrowDownRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBillingPlans, getBillingSubscription, createBillingCheckoutSession, cancelBillingSubscription, scheduleBillingDowngrade, getBillingHistory } from '../services/api';

/**
 * Proposed RicozAnalytics Launch Pricing Plans
 */
const DEFAULT_LAUNCH_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    audience: 'Individuals and small teams',
    regularPriceMonthly: 999,
    priceMonthly: 699,
    discountPercentMonthly: 30,
    regularPriceYearly: 11988,
    priceYearly: 6999,
    priceAnnual: 6999,
    discountPercentYearly: 42,
    currency: 'inr',
    currencySymbol: '₹',
    priceSuffix: '',
    popular: false,
    hasContactSales: false,
    maxDatasets: 10,
    maxUsers: 5,
    description: 'Essential analytics, datasets, and executive reporting for individuals and agile small teams.',
    features: ['10 Connected Datasets', '5 Team Members', 'Automated Daily Reports', 'Standard Email Support']
  },
  {
    id: 'growth',
    name: 'Growth',
    audience: 'Growing businesses and analytics teams',
    regularPriceMonthly: 2999,
    priceMonthly: 1999,
    discountPercentMonthly: 33,
    regularPriceYearly: 35988,
    priceYearly: 19999,
    priceAnnual: 19999,
    discountPercentYearly: 44,
    currency: 'inr',
    currencySymbol: '₹',
    priceSuffix: '',
    popular: true,
    hasContactSales: false,
    maxDatasets: 50,
    maxUsers: 25,
    description: 'High-performance relational modeling, automated anomaly alerts, and executive AI copilot.',
    features: ['50 Connected Datasets', '25 Team Members', 'Executive AI Insights', 'Real-time Anomaly Alerts', 'Priority SLA Support']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'Larger organizations requiring advanced governance and support',
    regularPriceMonthly: 9999,
    priceMonthly: 6999,
    discountPercentMonthly: 30,
    regularPriceYearly: 119988,
    priceYearly: 69999,
    priceAnnual: 69999,
    discountPercentYearly: 42,
    currency: 'inr',
    currencySymbol: '₹',
    priceSuffix: ' onwards',
    popular: false,
    hasContactSales: true,
    maxDatasets: -1,
    maxUsers: -1,
    description: 'Unlimited compute, customized AI query planner, dedicated infrastructure, and 24/7 support.',
    features: ['Unlimited Datasets & Warehouses', 'Unlimited Team Members', 'Custom AI Query Planner', 'Dedicated Infrastructure', '24/7 Dedicated Support']
  }
];

/**
 * Enterprise SaaS Billing & Launch Pricing Management Page — RicozAnalytics
 * Provides trial countdown status, expiration access gateway, tiered launch pricing, and payment checkout.
 */
export default function BillingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, subscription, refreshSubscription, isTrialExpired } = useAuth();

  const [billingInterval, setBillingInterval] = useState('monthly'); // 'monthly' | 'yearly'
  const [plans, setPlans] = useState(DEFAULT_LAUNCH_PLANS);
  const [currentSub, setCurrentSub] = useState(subscription || null);
  const [invoices, setInvoices] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);
  const [error, setError] = useState(location.state?.trialExpired ? 'Your 14-day free trial has completed. Please choose a plan to continue accessing your workspace.' : '');
  const [successMessage, setSuccessMessage] = useState(location.state?.paymentSuccess ? 'Payment confirmed! Your enterprise workspace is now active.' : '');

  const PLAN_ORDER = ['starter', 'growth', 'enterprise'];
  const comparePlanIds = (a, b) => PLAN_ORDER.indexOf(String(a || 'starter').toLowerCase()) - PLAN_ORDER.indexOf(String(b || 'starter').toLowerCase());

  // Handle URL query parameters from checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      setSuccessMessage('Payment confirmed! Your workspace subscription is now active.');
      if (typeof refreshSubscription === 'function') {
        refreshSubscription();
      }
    } else if (params.get('payment') === 'cancelled') {
      setError('Payment checkout was cancelled. No charges were incurred.');
    }
  }, [location.search]);

  // Load plans & subscription telemetry
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [plansRes, subRes] = await Promise.all([
          getBillingPlans().catch(() => null),
          getBillingSubscription().catch(() => null)
        ]);

        if (isMounted) {
          if (plansRes && Array.isArray(plansRes.plans) && plansRes.plans.length > 0) {
            // Merge backend plans with launch defaults to ensure complete metadata
            const merged = DEFAULT_LAUNCH_PLANS.map(def => {
              const fromServer = plansRes.plans.find(p => p.id === def.id);
              return fromServer ? { ...def, ...fromServer } : def;
            });
            setPlans(merged);
          }
          if (subRes && subRes.subscription) {
            setCurrentSub(subRes.subscription);
          }
          if (subRes && Array.isArray(subRes.invoices)) {
            setInvoices(subRes.invoices);
          }
          if (subRes && Array.isArray(subRes.history)) {
            setHistory(subRes.history);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load billing telemetry. Please refresh.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, []);

  // Handle plan checkout creation
  const handleUpgrade = async (planId) => {
    setUpgradingPlanId(planId);
    setError('');
    setSuccessMessage('');

    try {
      const data = await createBillingCheckoutSession({
        planId,
        interval: billingInterval,
        billingCycle: billingInterval
      });

      if (data && data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl;
      } else {
        // Fallback local update
        if (typeof refreshSubscription === 'function') {
          await refreshSubscription();
        }
        setSuccessMessage('Checkout initiated successfully.');
      }
    } catch (err) {
      setError(err.message || 'Unable to initiate payment checkout. Please try again.');
    } finally {
      setUpgradingPlanId(null);
    }
  };

  // Handle plan downgrade scheduling
  const handleDowngrade = async (planId) => {
    if (!window.confirm(`Are you sure you want to schedule a downgrade to the ${planId.toUpperCase()} plan? Your current plan entitlements will remain active until the end of your billing period.`)) {
      return;
    }
    setUpgradingPlanId(planId);
    setError('');
    setSuccessMessage('');

    try {
      const data = await scheduleBillingDowngrade({ planId });
      setSuccessMessage(data.message || 'Downgrade scheduled successfully.');
      if (typeof refreshSubscription === 'function') {
        await refreshSubscription();
      }
      const subRes = await getBillingSubscription().catch(() => null);
      if (subRes?.subscription) setCurrentSub(subRes.subscription);
      if (subRes?.history) setHistory(subRes.history);
    } catch (err) {
      setError(err.message || 'Failed to schedule plan downgrade.');
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const daysRemaining = currentSub?.daysRemaining != null ? currentSub.daysRemaining : 14;
  const isExpired = currentSub?.status === 'trial_expired' || (daysRemaining <= 0 && currentSub?.status !== 'active') || isTrialExpired;
  const isActivePaid = currentSub?.status === 'active';

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Top Banner if Trial Expired */}
      {isExpired && (
        <div className="rounded-2xl bg-rose-900 text-white p-4 sm:p-5 shadow-sm border border-rose-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-800/80 border border-rose-700 shrink-0">
              <AlertTriangle className="h-5 w-5 text-rose-300" />
            </div>
            <div>
              <p className="font-bold text-sm">Your 14-day free trial has ended</p>
              <p className="text-xs text-rose-200 mt-0.5">
                Your datasets, dashboards, and automated reports are safely preserved. Select a launch plan below to continue.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-xs font-mono bg-rose-950/70 px-3 py-1.5 rounded-lg border border-rose-800 text-rose-200 font-semibold">
              Workspace Preserved
            </span>
          </div>
        </div>
      )}

      {/* 10-Day Expiry / Renewal Warning Banner */}
      {!isExpired && daysRemaining <= 10 && daysRemaining > 0 && (
        <div className="rounded-2xl bg-amber-500 text-slate-950 p-4 sm:p-5 shadow-sm border border-amber-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-600 text-amber-50 shrink-0 shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm">
                {isActivePaid ? 'Subscription Renewal Approaching' : 'Free Trial Ending Soon'} — {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </p>
              <p className="text-xs text-amber-950/90 mt-0.5">
                Your {currentSub?.planDetails?.name || currentSub?.plan || 'Starter'} plan {isActivePaid ? 'renews or expires' : 'trial ends'} on{' '}
                <span className="font-bold underline">
                  {currentSub?.relevantEndDate || currentSub?.currentPeriodEnd || currentSub?.trialEndsAt
                    ? new Date(currentSub.relevantEndDate || currentSub.currentPeriodEnd || currentSub.trialEndsAt).toLocaleDateString()
                    : 'soon'}
                </span>. Your workspace datasets and models remain 100% preserved.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('plans-selection-grid');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs font-bold bg-slate-950 text-white px-4 py-2 rounded-xl shadow-xs hover:bg-slate-800 transition cursor-pointer"
            >
              {isActivePaid ? 'Manage & Renew Plan' : 'Select Launch Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="space-y-3 flex-1 min-w-0">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="hover:text-slate-600 transition-colors focus:outline-hidden cursor-pointer"
            >
              Workspace
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="hover:text-slate-600 transition-colors focus:outline-hidden cursor-pointer"
            >
              Settings
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="text-slate-900 font-bold">Plans & Billing</span>
          </nav>

          {/* Section Tag */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
              <CreditCard className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              Subscription & Licensing
            </span>
          </div>

          {/* Title & Description */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
              Plans & Billing
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl font-normal leading-relaxed">
              Scale your business intelligence workspace with enterprise security, relational modeling, and AI copilot compute.
            </p>
          </div>
        </div>

        {/* Current Subscription Status Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs w-full lg:w-[380px] shrink-0 space-y-3 sm:space-y-3.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-slate-500 font-medium">Workspace Status</span>
            {currentSub?.scheduledDowngradePlan ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap shadow-2xs">
                <ArrowDownRight className="w-3.5 h-3.5 text-sky-600" />
                Downgrade Scheduled
              </span>
            ) : currentSub?.cancelAtPeriodEnd ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Cancellation Pending
              </span>
            ) : isActivePaid ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/90 whitespace-nowrap shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active Paid
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/90 whitespace-nowrap shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-rose-600" />
                Free Trial Expired
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/90 whitespace-nowrap shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-rose-600" />
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </span>
            )}
          </div>

          <div className="text-base sm:text-lg font-bold text-slate-900 capitalize leading-snug">
            {currentSub?.planDetails?.name || currentSub?.plan || 'Enterprise'} Plan {isActivePaid ? `(${currentSub?.billingInterval || 'Monthly'})` : '(Trial Period)'}
          </div>

          {/* Server-Side Reliable Dates */}
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400 block font-medium">Started</span>
              <span className="text-slate-700 font-semibold">
                {currentSub?.subscriptionStartDate || currentSub?.trialStartedAt
                  ? new Date(currentSub.subscriptionStartDate || currentSub.trialStartedAt).toLocaleDateString()
                  : 'Active'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">
                {isActivePaid ? (currentSub?.cancelAtPeriodEnd ? 'Ends On' : 'Renews On') : 'Trial Ends'}
              </span>
              <span className={`font-semibold ${daysRemaining <= 10 ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                {currentSub?.relevantEndDate || currentSub?.currentPeriodEnd || currentSub?.trialEndsAt
                  ? new Date(currentSub.relevantEndDate || currentSub.currentPeriodEnd || currentSub.trialEndsAt).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Scheduled Downgrade Notice */}
          {currentSub?.scheduledDowngradePlan && (
            <div className="text-xs bg-sky-50 border border-sky-200 p-2.5 rounded-xl text-sky-800">
              <span className="font-bold">Scheduled Downgrade:</span> Switching to <strong>{currentSub.scheduledDowngradePlan.toUpperCase()}</strong> on{' '}
              {currentSub.scheduledDowngradeEffectiveDate ? new Date(currentSub.scheduledDowngradeEffectiveDate).toLocaleDateString() : 'period end'}. Higher-tier features remain fully active until then.
            </div>
          )}

          {/* Live Usage Telemetry Meters */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Datasets</span>
              </span>
              <span className="font-semibold text-slate-800">
                {currentSub?.usage?.datasets?.count || 0} / {currentSub?.usage?.datasets?.limit === -1 ? 'Unlimited' : (currentSub?.usage?.datasets?.limit || 10)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Team Members</span>
              </span>
              <span className="font-semibold text-slate-800">
                {currentSub?.usage?.users?.count || 0} / {currentSub?.usage?.users?.limit === -1 ? 'Unlimited' : (currentSub?.usage?.users?.limit || 5)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 pt-1">
            Organization: <span className="font-semibold text-slate-600">{user?.organization_name || 'Ricoz Primary Organization'}</span>
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
        </div>
      )}

      {/* Limited-Time Launch Offer Banner */}
      <div className="flex flex-col items-center justify-center pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-linear-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Limited-Time Launch Offer: Save up to 44% with special early-adopter pricing</span>
          <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          <span className="hidden sm:inline-block text-[11px] text-rose-600 font-bold uppercase tracking-wider">Launch Pricing</span>
        </div>
      </div>

      {/* Billing Interval Toggle (Monthly / Annual) */}
      <div className="flex flex-col items-center justify-center gap-2 pt-1 pb-2">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300/80 shadow-2xs">
          <button
            type="button"
            id="billing-monthly-toggle"
            onClick={() => setBillingInterval('monthly')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              billingInterval === 'monthly'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            id="billing-annual-toggle"
            onClick={() => setBillingInterval('yearly')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              billingInterval === 'yearly'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              Save up to 44%
            </span>
          </button>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          {billingInterval === 'yearly'
            ? '✨ Billed annually — includes discounted monthly equivalent & maximum launch savings'
            : '⚡ Billed monthly with flexible month-to-month cancellation'}
        </span>
      </div>

      {/* Pricing Cards Grid — Consistent Heights & Aligned Elements */}
      <div id="plans-selection-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 pt-2 items-stretch">
        {plans.map((p) => {
          const isPopular = Boolean(p.popular);
          const isCurrentPlan = currentSub?.plan === p.id && isActivePaid;
          const currencySym = p.currencySymbol || '₹';

          // Prices
          const isYearly = billingInterval === 'yearly';
          const launchPrice = isYearly ? (p.priceAnnual || p.priceYearly) : p.priceMonthly;
          const regularPrice = isYearly ? (p.regularPriceYearly || (p.regularPriceMonthly * 12)) : p.regularPriceMonthly;
          const discountPct = isYearly ? (p.discountPercentYearly || 42) : p.discountPercentMonthly;
          const priceSuffix = p.priceSuffix || '';

          // Monthly equivalent & annual savings
          const monthlyEquivalent = isYearly ? Math.round(launchPrice / 12) : launchPrice;
          const annualSavings = isYearly ? Math.max(0, regularPrice - launchPrice) : 0;

          const currentPlanId = currentSub?.plan || 'starter';
          const planComparison = comparePlanIds(p.id, currentPlanId);
          const isDowngradeScheduledForThis = currentSub?.scheduledDowngradePlan === p.id;
          const isDowngradeCandidate = isActivePaid && planComparison < 0;

          return (
            <div
              key={p.id}
              className={`relative flex flex-col justify-between rounded-2xl border bg-white p-6 sm:p-7 shadow-xs transition hover:shadow-md h-full ${
                isPopular
                  ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-md shadow-rose-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Most Popular Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-600 px-3.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-white shadow-xs z-10">
                  Most Popular
                </div>
              )}

              <div className="flex-1 flex flex-col">
                {/* Card Header & Icon */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold text-slate-950 font-sans tracking-tight">
                      {p.name}
                    </h3>
                    <div className="mt-2 min-h-[38px] sm:min-h-[42px] flex items-start">
                      <span className="inline-flex items-start gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50/90 px-2.5 py-1 rounded-md border border-rose-100 leading-snug">
                        <Users className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span className="break-words leading-tight">{p.audience}</span>
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    {p.id === 'growth' ? (
                      <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                        <Zap className="h-5 w-5" />
                      </div>
                    ) : p.id === 'enterprise' ? (
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100">
                        <Layers className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-2.5 min-h-[42px] leading-relaxed break-words">
                  {p.description}
                </p>

                {/* Pricing Block with Regular Price Crossed Out & Discount Badge */}
                <div className="mt-4 pt-4 border-t border-slate-100 min-h-[104px] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-400 line-through font-semibold">
                      {currencySym}{regularPrice.toLocaleString('en-IN')}{isYearly ? '/year' : '/month'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                      {discountPct}% OFF
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Launch Offer
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight font-sans">
                      {currencySym}{launchPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">
                      {isYearly ? '/year' : '/month'}
                      {priceSuffix}
                    </span>
                  </div>

                  {isYearly ? (
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">
                        ≈ {currencySym}{monthlyEquivalent.toLocaleString('en-IN')}/mo equivalent
                      </span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                        Save {currencySym}{annualSavings.toLocaleString('en-IN')}/yr
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Billed monthly • Cancel anytime
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div className="mt-5 space-y-2.5 flex-1 flex flex-col">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    What is included
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-700 flex-1">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Call to Action Button & Contact Sales Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                {isCurrentPlan ? (
                  <button
                    type="button"
                    disabled
                    className="w-full h-10 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Current Active Plan</span>
                  </button>
                ) : isDowngradeScheduledForThis ? (
                  <button
                    type="button"
                    disabled
                    className="w-full h-10 py-2.5 px-4 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4 text-sky-600" />
                    <span>Downgrade Scheduled</span>
                  </button>
                ) : isDowngradeCandidate ? (
                  <button
                    type="button"
                    disabled={upgradingPlanId === p.id}
                    onClick={() => handleDowngrade(p.id)}
                    className="w-full h-10 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    {upgradingPlanId === p.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                        <span>Scheduling Downgrade...</span>
                      </>
                    ) : (
                      <>
                        <span>Schedule Downgrade to {p.name}</span>
                        <ArrowDownRight className="w-4 h-4 text-slate-500" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={upgradingPlanId === p.id}
                    onClick={() => handleUpgrade(p.id)}
                    className={`w-full h-10 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
                      isPopular
                        ? 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2'
                        : 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-2 focus:ring-slate-700 focus:ring-offset-2'
                    }`}
                  >
                    {upgradingPlanId === p.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connecting to Gateway...</span>
                      </>
                    ) : isExpired ? (
                      <>
                        <span>Choose {p.name} & Unlock Access</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Upgrade to {p.name}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}

                {/* Secondary Action / Reassurance Slot (Identical h-9 height across all cards) */}
                <div className="h-9 flex items-center justify-center">
                  {p.hasContactSales ? (
                    <a
                      href="mailto:sales@ricoz.in?subject=Enterprise%20Plan%20Custom%20Pricing%20Inquiry%20-%20RicozAnalytics"
                      className="w-full h-full py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>Contact Enterprise Sales</span>
                    </a>
                  ) : p.id === 'growth' ? (
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                      Priority SLA & AI Copilot included
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      14-day money-back guarantee
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

        {/* GST Information Note */}
        <div className="text-center py-2">
          <p className="text-xs text-slate-500 font-medium">
            * All displayed prices are in INR (₹) and exclusive of 18% GST where applicable. Official tax invoices with GSTIN provided upon checkout.
          </p>
        </div>

        {/* Enterprise Security & Guarantee Badges */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">256-Bit SSL Encryption</p>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  All transactions are cryptographically verified via Stripe PCI-DSS Level 1 compliant gateway.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">Zero Data Loss Guarantee</p>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  Your datasets, models, and dashboards remain safely preserved upon trial end.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">Enterprise Support & Invoicing</p>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  Need custom PO billing or wire transfer?{' '}
                  <a href="mailto:sales@ricoz.in" className="text-rose-600 underline font-semibold">
                    Contact Enterprise Sales
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices History Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Billing History & Invoices</h2>
              <p className="text-xs text-slate-500 mt-0.5">Download official tax invoices for accounting records</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">Invoice ID</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {currentSub?.invoices && currentSub.invoices.length > 0 ? (
                  currentSub.invoices.map((inv) => {
                    const isINR = (inv.currency || 'inr').toLowerCase() === 'inr';
                    const sym = isINR ? '₹' : '$';
                    const formattedAmt = typeof inv.amount === 'number'
                      ? inv.amount.toLocaleString('en-IN')
                      : ((inv.amount_paid || 0) / 100).toLocaleString('en-IN');

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-6 font-mono font-medium text-slate-900">{inv.id}</td>
                        <td className="py-3 px-6">{new Date(inv.created_at || Date.now()).toLocaleDateString()}</td>
                        <td className="py-3 px-6 font-semibold">{sym}{formattedAmt}</td>
                        <td className="py-3 px-6">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            {inv.status || 'Paid'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => alert(`Downloading invoice ${inv.id}`)}
                            className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                          >
                            PDF &darr;
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No invoices yet. Your 14-day free trial does not generate billing charges.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subscription & Entitlement Audit History */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Subscription & Entitlement Audit History</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable event record of upgrades, scheduled downgrades, renewals, and cancellations
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              {history.length} {history.length === 1 ? 'Event' : 'Events'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">Event</th>
                  <th className="py-3 px-6">Plan Transition</th>
                  <th className="py-3 px-6">Billing Cycle</th>
                  <th className="py-3 px-6">Effective Date</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {history && history.length > 0 ? (
                  history.map((ev) => {
                    const badgeClass =
                      ev.event_type === 'upgrade'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : ev.event_type === 'downgrade_scheduled'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : ev.event_type === 'downgrade_applied'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : ev.event_type === 'cancelled'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200';

                    const eventLabel =
                      ev.event_type === 'downgrade_scheduled'
                        ? 'Downgrade Scheduled'
                        : ev.event_type === 'downgrade_applied'
                        ? 'Downgrade Applied'
                        : ev.event_type ? ev.event_type.charAt(0).toUpperCase() + ev.event_type.slice(1) : 'Event';

                    return (
                      <tr key={ev.id || `${ev.event_type}-${ev.created_at}`} className="hover:bg-slate-50/50">
                        <td className="py-3 px-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badgeClass}`}>
                            {eventLabel}
                          </span>
                        </td>
                        <td className="py-3 px-6 font-medium">
                          {ev.from_plan ? (
                            <span className="inline-flex items-center gap-1.5 capitalize">
                              <span className="text-slate-500">{ev.from_plan}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-900 font-bold">{ev.to_plan || 'None'}</span>
                            </span>
                          ) : (
                            <span className="capitalize text-slate-900 font-bold">{ev.to_plan || 'Initial Setup'}</span>
                          )}
                        </td>
                        <td className="py-3 px-6 capitalize text-slate-600">
                          {ev.billing_interval || 'Monthly'}
                        </td>
                        <td className="py-3 px-6 text-slate-600">
                          {ev.effective_date ? new Date(ev.effective_date).toLocaleDateString() : 'Immediate'}
                        </td>
                        <td className="py-3 px-6">
                          <span className="text-[11px] font-semibold text-slate-700 capitalize">
                            {ev.status || 'Processed'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-[11px] text-slate-500">
                          {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      No subscription change events recorded yet. Plan transitions, upgrades, and scheduled downgrades will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
