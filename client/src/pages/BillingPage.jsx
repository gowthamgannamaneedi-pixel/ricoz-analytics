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
  Database,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBillingPlans, getBillingSubscription, createBillingCheckoutSession, cancelBillingSubscription } from '../services/api';

/**
 * Enterprise SaaS Billing & 14-Day Free Trial Management Page — RicozAnalytics
 * Provides trial countdown status, expiration access gateway, tiered pricing, and Stripe checkout.
 */
export default function BillingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, subscription, refreshSubscription, isTrialExpired } = useAuth();

  const [billingInterval, setBillingInterval] = useState('monthly'); // 'monthly' | 'yearly'
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(subscription || null);
  const [loading, setLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);
  const [error, setError] = useState(location.state?.trialExpired ? 'Your 14-day free trial has completed. Please choose a plan to continue accessing your workspace.' : '');
  const [successMessage, setSuccessMessage] = useState(location.state?.paymentSuccess ? 'Payment confirmed! Your enterprise workspace is now active.' : '');

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
          if (plansRes && plansRes.plans) {
            setPlans(plansRes.plans);
          }
          if (subRes && subRes.subscription) {
            setCurrentSub(subRes.subscription);
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
        interval: billingInterval
      });

      if (data && data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl;
      } else {
        // Fallback local update
        await refreshSubscription();
        setSuccessMessage('Checkout initiated successfully.');
      }
    } catch (err) {
      setError(err.message || 'Unable to initiate payment checkout. Please try again.');
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const daysRemaining = currentSub?.daysRemaining != null ? currentSub.daysRemaining : 14;
  const isExpired = currentSub?.status === 'trial_expired' || (daysRemaining <= 0 && currentSub?.status !== 'active') || isTrialExpired;
  const isActivePaid = currentSub?.status === 'active';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Banner if Trial Expired */}
      {isExpired && (
        <div className="bg-rose-900 text-white px-4 py-3 sm:px-6 shadow-md border-b border-rose-800">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-800/80 border border-rose-700 shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-300" />
              </div>
              <div>
                <p className="font-bold text-sm">Your 14-day free trial has ended</p>
                <p className="text-xs text-rose-200 mt-0.5">
                  Your datasets, dashboards, and automated reports are safely preserved. Select a plan below to continue.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs font-mono bg-rose-950/70 px-2.5 py-1 rounded border border-rose-800 text-rose-200">
                Workspace Preserved
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <CreditCard className="h-5 w-5 text-rose-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Subscription & Licensing
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 font-serif">
              Plans & Billing
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
              Scale your business intelligence workspace with enterprise security, live alerts, and AI copilot compute.
            </p>
          </div>

          {/* Current Subscription Status Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs min-w-[280px]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs text-slate-500 font-medium">Workspace Status</span>
              {isActivePaid ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Active Paid
                </span>
              ) : isExpired ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  Free Trial Expired
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-slate-900 capitalize">
              {currentSub?.plan || 'Starter'} Plan {isActivePaid ? `(${currentSub?.billingInterval || 'Monthly'})` : '(14-Day Free Trial)'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Organization: <span className="font-semibold text-slate-700">{user?.organization_name || 'Enterprise'}</span>
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

        {/* Billing Interval Toggle (Monthly / Annual with 20% discount) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setBillingInterval('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                billingInterval === 'monthly'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval('yearly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                billingInterval === 'yearly'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {plans.map((p) => {
            const isPopular = p.popular;
            const price = billingInterval === 'yearly' ? p.priceAnnual : p.priceMonthly;
            const isCurrentPlan = currentSub?.plan === p.id && isActivePaid;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col justify-between rounded-2xl border bg-white p-6 sm:p-7 shadow-xs transition hover:shadow-md ${
                  isPopular
                    ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-rose-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-950 font-serif">{p.name}</h3>
                    {p.id === 'growth' ? (
                      <Zap className="h-5 w-5 text-rose-600" />
                    ) : p.id === 'enterprise' ? (
                      <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    ) : (
                      <Layers className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{p.description}</p>

                  {/* Price */}
                  <div className="mt-5 pb-5 border-b border-slate-100 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight font-serif">
                      ${price}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      /month {billingInterval === 'yearly' && '(billed annually)'}
                    </span>
                  </div>

                  {/* Features List */}
                  <div className="mt-6 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      What is included
                    </p>
                    <ul className="space-y-2.5 text-xs text-slate-700">
                      {p.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Call to action button */}
                <div className="mt-8 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isCurrentPlan || upgradingPlanId === p.id}
                    onClick={() => handleUpgrade(p.id)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
                      isCurrentPlan
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        : isPopular
                        ? 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2'
                        : 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-2 focus:ring-slate-700 focus:ring-offset-2'
                    }`}
                  >
                    {upgradingPlanId === p.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connecting to Gateway...</span>
                      </>
                    ) : isCurrentPlan ? (
                      <span>Current Active Plan</span>
                    ) : isExpired ? (
                      <>
                        <span>Choose Plan & Unlock Access</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Upgrade to {p.name}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Security & Guarantee Badges */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">256-Bit SSL Encryption</p>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  All transactions are cryptographically verified via Stripe PCI-DSS Level 1.
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
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">Enterprise Support & Invoicing</p>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  Need custom PO billing or wire transfer? <a href="mailto:support@ricoz.in" className="text-rose-600 underline font-semibold">Contact Enterprise Sales</a>
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
                  currentSub.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-6 font-mono font-medium text-slate-900">{inv.id}</td>
                      <td className="py-3 px-6">{new Date(inv.created_at || Date.now()).toLocaleDateString()}</td>
                      <td className="py-3 px-6 font-semibold">${((inv.amount_paid || 0) / 100).toFixed(2)}</td>
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
                  ))
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
      </div>
    </div>
  );
}
