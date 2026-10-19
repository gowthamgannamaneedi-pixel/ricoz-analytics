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
  ArrowDownRight,
  Receipt,
  RotateCcw,
  RefreshCw,
  XCircle,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getBillingPlans,
  getBillingSubscription,
  createBillingCheckoutSession,
  cancelBillingSubscription,
  scheduleBillingDowngrade,
  cancelBillingDowngrade,
  getBillingHistory,
  getRazorpayConfig,
  createRazorpayOrder,
  verifyRazorpayPayment
} from '../services/api';
import { loadRazorpayCheckout } from '../utils/razorpayLoader';

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
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);
  const [downgradingPlanId, setDowngradingPlanId] = useState(null);
  const [cancellingDowngrade, setCancellingDowngrade] = useState(false);
  const [downgradeConfirmTarget, setDowngradeConfirmTarget] = useState(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verificationStep, setVerificationStep] = useState('');
  const [error, setError] = useState(location.state?.trialExpired ? 'Your 14-day free trial has completed. Please choose a plan to continue accessing your workspace.' : '');
  const [successMessage, setSuccessMessage] = useState(location.state?.paymentSuccess ? 'Payment confirmed! Your enterprise workspace is now active.' : '');

  const PLAN_ORDER = ['starter', 'growth', 'enterprise'];
  const comparePlanIds = (a, b) => PLAN_ORDER.indexOf(String(a || 'starter').toLowerCase()) - PLAN_ORDER.indexOf(String(b || 'starter').toLowerCase());
  const isActionPending = Boolean(upgradingPlanId || downgradingPlanId || cancellingDowngrade || verifyingPayment);

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

  // Synchronize local billing state whenever AuthContext subscription updates
  useEffect(() => {
    if (subscription) {
      setCurrentSub(subscription);
    }
  }, [subscription]);

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
          if (subRes && Array.isArray(subRes.orders)) {
            setOrders(subRes.orders);
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

  // Handle Razorpay checkout & cryptographic verification
  const handleUpgrade = async (planId) => {
    setError('');
    setSuccessMessage('');

    // Guard: Prevent paying for current active plan when no renewal or change is needed
    const currentPlanId = currentSub?.plan || 'starter';
    const isAlreadyActiveOnThis =
      isActivePaid &&
      currentPlanId === planId &&
      (currentSub?.billingInterval || 'monthly') === billingInterval &&
      !isExpired &&
      (currentSub?.daysRemaining == null || currentSub.daysRemaining > 10);

    if (isAlreadyActiveOnThis) {
      setError(`Your workspace already has an active ${planId.toUpperCase()} subscription (${billingInterval}). No change or payment is needed.`);
      return;
    }

    // Guard: Prevent creating a payment order for a plan downgrade
    const planComparison = comparePlanIds(planId, currentPlanId);
    if (isActivePaid && planComparison < 0) {
      setError(`Downgrades cannot be processed as payments. Downgrades take effect at the end of your billing cycle without payment.`);
      return;
    }

    setUpgradingPlanId(planId);

    try {
      // 1. Authoritative server-side Razorpay order generation
      const orderData = await createRazorpayOrder({
        planId,
        interval: billingInterval,
        billingCycle: billingInterval
      });

      if (!orderData || !orderData.orderId) {
        throw new Error('Unable to create payment order with backend server.');
      }

      // Check if sandbox test simulation mode is active (when dummy keys in development)
      const isSimulatedTest = orderData.orderId.startsWith('order_test_') && (!orderData.keyId || orderData.keyId.includes('placeholder'));

      if (isSimulatedTest) {
        const proceedSimulated = window.confirm(
          `[Sandbox Test Simulation]\n\nRazorpay keys are in local sandbox simulation mode.\n\nPlan: ${orderData.planName || planId.toUpperCase()} (${billingInterval})\nAmount: ₹${(orderData.amount / 100).toLocaleString('en-IN')}\nOrder ID: ${orderData.orderId}\n\nProceed with simulated payment verification and plan activation?`
        );

        if (!proceedSimulated) {
          setUpgradingPlanId(null);
          return;
        }

        setVerifyingPayment(true);
        setVerificationStep('Cryptographically verifying simulated payment signature...');

        const verifyRes = await verifyRazorpayPayment({
          orderId: orderData.orderId,
          paymentId: `pay_test_${Date.now()}`,
          signature: 'test_bypass_sig',
          planId,
          billingInterval
        });

        setSuccessMessage(verifyRes.message || 'Payment confirmed! Your subscription is now active.');
        setError('');
        if (verifyRes?.subscription) {
          setCurrentSub(verifyRes.subscription);
        }
        if (typeof refreshSubscription === 'function') {
          await refreshSubscription();
        }
        const subRes = await getBillingSubscription().catch(() => null);
        if (subRes?.subscription) setCurrentSub(subRes.subscription);
        if (subRes?.invoices) setInvoices(subRes.invoices);
        if (subRes?.orders) setOrders(subRes.orders);
        if (subRes?.history) setHistory(subRes.history);
        return;
      }

      // 2. Dynamically load Razorpay Checkout SDK
      const RazorpaySDK = await loadRazorpayCheckout();
      if (!RazorpaySDK) {
        throw new Error('Razorpay Checkout SDK is not available. Please check your internet connection or adblocker.');
      }

      // 3. Configure Razorpay Checkout options
      const checkoutKeyId = orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!checkoutKeyId) {
        throw new Error('Razorpay Public Key ID is not configured. Please set VITE_RAZORPAY_KEY_ID in your environment variables.');
      }

      const options = {
        key: checkoutKeyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'RicozAnalytics',
        description: `${orderData.planName || planId.toUpperCase()} Plan (${billingInterval === 'yearly' ? 'Annual' : 'Monthly'})`,
        image: '/favicon.ico',
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || user?.full_name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        notes: {
          organization_id: user?.organization_id,
          plan_id: planId,
          billing_interval: billingInterval
        },
        theme: {
          color: '#E11D48'
        },
        modal: {
          ondismiss: () => {
            setUpgradingPlanId(null);
            setVerifyingPayment(false);
          }
        },
        handler: async (response) => {
          try {
            setVerifyingPayment(true);
            setVerificationStep('Cryptographically verifying payment signature with Razorpay...');

            // Submit cryptographic signature for authoritative verification
            const verifyRes = await verifyRazorpayPayment({
              orderId: response.razorpay_order_id || orderData.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              planId,
              billingInterval
            });

            setVerificationStep('Activating plan entitlements and syncing workspace...');
            setSuccessMessage(verifyRes.message || `Payment verified successfully! Welcome to the ${orderData.planName || planId.toUpperCase()} tier.`);
            setError('');

            // Immediately apply verified authoritative subscription from server
            if (verifyRes?.subscription) {
              setCurrentSub(verifyRes.subscription);
            }

            if (typeof refreshSubscription === 'function') {
              await refreshSubscription();
            }

            const subRes = await getBillingSubscription().catch(() => null);
            if (subRes?.subscription) setCurrentSub(subRes.subscription);
            if (subRes?.invoices) setInvoices(subRes.invoices);
            if (subRes?.orders) setOrders(subRes.orders);
            if (subRes?.history) setHistory(subRes.history);
          } catch (verifyErr) {
            setError(verifyErr.message || 'Payment verification failed. If your payment was deducted, our webhook will auto-credit your workspace shortly.');
          } finally {
            setVerifyingPayment(false);
            setUpgradingPlanId(null);
            setVerificationStep('');
          }
        }
      };

      const rzpInstance = new RazorpaySDK(options);
      rzpInstance.on('payment.failed', (resp) => {
        setError(`Payment failed: ${resp.error?.description || resp.error?.reason || 'Transaction could not be completed.'}`);
        setUpgradingPlanId(null);
        setVerifyingPayment(false);
      });

      rzpInstance.open();
    } catch (err) {
      setError(err.message || 'Unable to initiate Razorpay checkout. Please try again.');
    } finally {
      setUpgradingPlanId(null);
    }
  };

  // Initiate plan downgrade flow (non-blocking accessible modal)
  const handleDowngrade = (plan) => {
    if (isActionPending) return;
    setError('');
    setDowngradeConfirmTarget(plan);
  };

  // Execute confirmed downgrade
  const executeDowngrade = async (planId) => {
    if (isActionPending) return;
    setDowngradingPlanId(planId);
    setError('');
    setSuccessMessage('');

    try {
      const data = await scheduleBillingDowngrade({ planId });
      setDowngradeConfirmTarget(null);
      setSuccessMessage(data?.message || `Downgrade to ${planId.toUpperCase()} scheduled successfully.`);

      // Immediate authoritative update from backend response
      if (data?.subscription) {
        setCurrentSub(data.subscription);
      }

      // Background telemetry and history refresh
      if (typeof refreshSubscription === 'function') {
        refreshSubscription().catch(() => null);
      }
      getBillingSubscription().then((subRes) => {
        if (subRes?.subscription) setCurrentSub(subRes.subscription);
        if (subRes?.history) setHistory(subRes.history);
      }).catch(() => null);
    } catch (err) {
      setError(err.message || 'Failed to schedule plan downgrade. Please try again.');
    } finally {
      setDowngradingPlanId(null);
    }
  };

  // Handle cancelling a pending scheduled downgrade
  const handleCancelDowngrade = async () => {
    if (isActionPending) return;
    setCancellingDowngrade(true);
    setError('');
    setSuccessMessage('');

    try {
      const data = await cancelBillingDowngrade();
      setSuccessMessage(data?.message || 'Scheduled downgrade cancelled successfully. Your current plan remains active.');

      // Immediate authoritative update from backend response
      if (data?.subscription) {
        setCurrentSub(data.subscription);
      }

      // Background telemetry and history refresh
      if (typeof refreshSubscription === 'function') {
        refreshSubscription().catch(() => null);
      }
      getBillingSubscription().then((subRes) => {
        if (subRes?.subscription) setCurrentSub(subRes.subscription);
        if (subRes?.history) setHistory(subRes.history);
      }).catch(() => null);
    } catch (err) {
      setError(err.message || 'Failed to cancel scheduled downgrade. Please try again.');
    } finally {
      setCancellingDowngrade(false);
    }
  };

  const daysRemaining = currentSub?.daysRemaining != null ? currentSub.daysRemaining : 14;
  const isExpired = currentSub?.status === 'trial_expired' || (daysRemaining <= 0 && currentSub?.status !== 'active') || isTrialExpired;
  const isActivePaid = currentSub?.status === 'active';

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Top Banner if Trial Expired */}
      {isExpired && (
        <div className="rounded-2xl bg-rose-900 dark:bg-[#2A1422] text-white p-4 sm:p-5 shadow-sm border border-rose-800 dark:border-rose-900/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-800/80 dark:bg-[#1E293B] border border-rose-700 dark:border-rose-900/60 shrink-0">
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
            <span className="text-xs font-mono bg-rose-950/70 dark:bg-[#1E293B] px-3 py-1.5 rounded-lg border border-rose-800 dark:border-rose-900/60 text-rose-200 font-semibold">
              Workspace Preserved
            </span>
          </div>
        </div>
      )}

      {/* 10-Day Expiry / Renewal Warning Banner */}
      {!isExpired && daysRemaining <= 10 && daysRemaining > 0 && (
        <div className="rounded-2xl bg-amber-500 text-slate-950 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800/80 p-4 sm:p-5 shadow-sm border border-amber-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-600 text-amber-50 dark:bg-amber-900/60 dark:text-amber-200 shrink-0 shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm">
                {isActivePaid ? 'Subscription Renewal Approaching' : 'Free Trial Ending Soon'} — {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </p>
              <p className="text-xs text-amber-950/90 dark:text-amber-200/90 mt-0.5">
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
              className="text-xs font-bold bg-slate-950 text-white dark:bg-[#E11D48] dark:hover:bg-[#BE123C] px-4 py-2 rounded-xl shadow-xs hover:bg-slate-800 transition cursor-pointer"
            >
              {isActivePaid ? 'Manage & Renew Plan' : 'Select Launch Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 border-b border-slate-200 dark:border-[#334155] pb-6">
        <div className="space-y-3 flex-1 min-w-0">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-hidden cursor-pointer"
            >
              Workspace
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-hidden cursor-pointer"
            >
              Settings
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
            <span className="text-slate-900 dark:text-[#F8FAFC] font-bold">Plans & Billing</span>
          </nav>

          {/* Section Tag */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/60 shrink-0">
              <CreditCard className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] font-mono">
              Subscription & Licensing
            </span>
          </div>

          {/* Title & Description */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-[#F8FAFC] font-sans">
              Plans & Billing
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#94A3B8] mt-1 max-w-xl font-normal leading-relaxed">
              Scale your business intelligence workspace with enterprise security, relational modeling, and AI copilot compute.
            </p>
          </div>
        </div>

        {/* Current Subscription Status Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] p-5 sm:p-6 shadow-2xs w-full lg:w-[380px] shrink-0 space-y-3 sm:space-y-3.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-slate-500 dark:text-[#94A3B8] font-medium">Workspace Status</span>
            {currentSub?.scheduledDowngradePlan ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 whitespace-nowrap shadow-2xs">
                <ArrowDownRight className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Downgrade Scheduled
              </span>
            ) : currentSub?.cancelAtPeriodEnd ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 whitespace-nowrap shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Cancellation Pending
              </span>
            ) : isActivePaid ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800/60 whitespace-nowrap shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Active Paid
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border border-rose-200/90 dark:border-rose-900/60 whitespace-nowrap shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-[#FB7185]" />
                Free Trial Expired
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border border-rose-200/90 dark:border-rose-900/60 whitespace-nowrap shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-[#FB7185]" />
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </span>
            )}
          </div>

          <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F8FAFC] capitalize leading-snug">
            {currentSub?.planDetails?.name || currentSub?.plan || 'Enterprise'} Plan {isActivePaid ? `(${currentSub?.billingInterval || 'Monthly'})` : '(Trial Period)'}
          </div>

          {/* Server-Side Reliable Dates */}
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-[#0F172A] p-2.5 rounded-xl border border-slate-100 dark:border-[#334155]">
            <div>
              <span className="text-slate-400 dark:text-[#94A3B8] block font-medium">Started</span>
              <span className="text-slate-700 dark:text-[#CBD5E1] font-semibold">
                {currentSub?.subscriptionStartDate || currentSub?.trialStartedAt
                  ? new Date(currentSub.subscriptionStartDate || currentSub.trialStartedAt).toLocaleDateString()
                  : 'Active'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-[#94A3B8] block font-medium">
                {isActivePaid ? (currentSub?.cancelAtPeriodEnd ? 'Ends On' : 'Renews On') : 'Trial Ends'}
              </span>
              <span className={`font-semibold ${daysRemaining <= 10 ? 'text-rose-600 dark:text-[#FB7185] font-bold' : 'text-slate-700 dark:text-[#CBD5E1]'}`}>
                {currentSub?.relevantEndDate || currentSub?.currentPeriodEnd || currentSub?.trialEndsAt
                  ? new Date(currentSub.relevantEndDate || currentSub.currentPeriodEnd || currentSub.trialEndsAt).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Scheduled Downgrade Notice */}
          {currentSub?.scheduledDowngradePlan && (
            <div className="text-xs bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 p-3 rounded-xl text-sky-800 dark:text-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Scheduled Downgrade:</span> Switching to{' '}
                  <strong className="font-extrabold uppercase">{currentSub.scheduledDowngradePlan}</strong> on{' '}
                  <span className="underline decoration-sky-400 underline-offset-2">
                    {currentSub.scheduledDowngradeEffectiveDate
                      ? new Date(currentSub.scheduledDowngradeEffectiveDate).toLocaleDateString()
                      : 'billing period end'}
                  </span>. Your current plan entitlements remain 100% active until then.
                </div>
              </div>
              <button
                type="button"
                disabled={isActionPending}
                onClick={handleCancelDowngrade}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-[#1E293B] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                title="Cancel pending downgrade and keep current active plan"
              >
                {cancellingDowngrade ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Cancel Downgrade</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Live Usage Telemetry Meters */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-[#334155]">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-[#94A3B8]">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400 dark:text-[#64748B]" />
                <span>Datasets</span>
              </span>
              <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
                {currentSub?.usage?.datasets?.count || 0} / {currentSub?.usage?.datasets?.limit === -1 ? 'Unlimited' : (currentSub?.usage?.datasets?.limit || 10)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-[#94A3B8]">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400 dark:text-[#64748B]" />
                <span>Team Members</span>
              </span>
              <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
                {currentSub?.usage?.users?.count || 0} / {currentSub?.usage?.users?.limit === -1 ? 'Unlimited' : (currentSub?.usage?.users?.limit || 5)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-[#94A3B8] pt-1">
            Organization: <span className="font-semibold text-slate-600 dark:text-[#CBD5E1]">{user?.organization_name || 'Ricoz Primary Organization'}</span>
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-[#2A1422] p-4 text-xs text-rose-800 dark:text-[#FDA4AF] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-[#FB7185] shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
        </div>
      )}

      {/* Limited-Time Launch Offer Banner */}
      <div className="flex flex-col items-center justify-center pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-linear-to-r from-rose-50 via-amber-50 to-rose-50 dark:from-[#2A1422] dark:via-[#1E293B] dark:to-[#2A1422] border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-[#FDA4AF] text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-[#FB7185] shrink-0" />
          <span>Limited-Time Launch Offer: Save up to 44% with special early-adopter pricing</span>
          <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-rose-400 dark:bg-rose-500"></span>
          <span className="hidden sm:inline-block text-[11px] text-rose-600 dark:text-[#FB7185] font-bold uppercase tracking-wider">Launch Pricing</span>
        </div>
      </div>

      {/* Billing Interval Toggle (Monthly / Annual) */}
      <div className="flex flex-col items-center justify-center gap-2 pt-1 pb-2">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/80 dark:bg-[#0F172A] border border-slate-300/80 dark:border-[#334155] shadow-2xs">
          <button
            type="button"
            id="billing-monthly-toggle"
            onClick={() => setBillingInterval('monthly')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              billingInterval === 'monthly'
                ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] shadow-2xs'
                : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
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
                ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] shadow-2xs'
                : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/40">
              Save up to 44%
            </span>
          </button>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-medium">
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
              className={`relative flex flex-col justify-between rounded-2xl border bg-white dark:bg-[#111827] p-6 sm:p-7 shadow-xs transition hover:shadow-md h-full ${
                isPopular
                  ? 'border-rose-500 dark:border-[#E11D48] ring-2 ring-rose-500/20 dark:ring-[#E11D48]/30 shadow-md shadow-rose-100 dark:shadow-none'
                  : 'border-slate-200 dark:border-[#334155] hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              {/* Most Popular Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-600 dark:bg-[#E11D48] px-3.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-white shadow-xs z-10">
                  Most Popular
                </div>
              )}

              <div className="flex-1 flex flex-col">
                {/* Card Header & Icon */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold text-slate-950 dark:text-[#F8FAFC] font-sans tracking-tight">
                      {p.name}
                    </h3>
                    <div className="mt-2 min-h-[38px] sm:min-h-[42px] flex items-start">
                      <span className="inline-flex items-start gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-[#FDA4AF] bg-rose-50/90 dark:bg-[#2A1422] px-2.5 py-1 rounded-md border border-rose-100 dark:border-rose-900/60 leading-snug">
                        <Users className="h-3.5 w-3.5 text-rose-500 dark:text-[#FB7185] shrink-0 mt-0.5" />
                        <span className="break-words leading-tight">{p.audience}</span>
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    {p.id === 'growth' ? (
                      <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-[#2A1422] flex items-center justify-center text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/60">
                        <Zap className="h-5 w-5" />
                      </div>
                    ) : p.id === 'enterprise' ? (
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-[#1E293B] flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-[#334155]">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-[#1E293B] flex items-center justify-center text-slate-600 dark:text-[#94A3B8] border border-slate-100 dark:border-[#334155]">
                        <Layers className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-2.5 min-h-[42px] leading-relaxed break-words">
                  {p.description}
                </p>

                {/* Pricing Block with Regular Price Crossed Out & Discount Badge */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#334155] min-h-[104px] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-400 dark:text-[#64748B] line-through font-semibold">
                      {currencySym}{regularPrice.toLocaleString('en-IN')}{isYearly ? '/year' : '/month'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-rose-100 dark:bg-[#2A1422] text-rose-800 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60">
                      {discountPct}% OFF
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/40">
                      Launch Offer
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-950 dark:text-[#F8FAFC] tracking-tight font-sans">
                      {currencySym}{launchPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-[#94A3B8] font-medium">
                      {isYearly ? '/year' : '/month'}
                      {priceSuffix}
                    </span>
                  </div>

                  {isYearly ? (
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-[#94A3B8] font-medium">
                        ≈ {currencySym}{monthlyEquivalent.toLocaleString('en-IN')}/mo equivalent
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50 text-[10px]">
                        Save {currencySym}{annualSavings.toLocaleString('en-IN')}/yr
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-[#94A3B8]">
                      Billed monthly • Cancel anytime
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div className="mt-5 space-y-2.5 flex-1 flex flex-col">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#64748B]">
                    What is included
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-700 dark:text-[#CBD5E1] flex-1">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-rose-600 dark:text-[#FB7185] shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Call to Action Button & Contact Sales Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-[#334155] flex flex-col gap-2.5">
                {isCurrentPlan ? (
                  isExpired ? (
                    <button
                      type="button"
                      disabled={upgradingPlanId === p.id}
                      onClick={() => handleUpgrade(p.id)}
                      className="w-full h-10 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 dark:bg-[#E11D48] text-white hover:bg-rose-700 dark:hover:bg-[#BE123C] transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      {upgradingPlanId === p.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Connecting to Gateway...</span>
                        </>
                      ) : (
                        <>
                          <span>Renew {p.name} Plan</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    <div
                      className="w-full h-10 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#1E293B] text-slate-500 dark:text-[#94A3B8] border border-slate-200 dark:border-[#334155] flex items-center justify-center gap-2 select-none"
                      title="Your workspace is currently active on this plan"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Current Active Plan</span>
                    </div>
                  )
                ) : isDowngradeScheduledForThis ? (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="w-full h-10 py-2 px-3 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 flex items-center justify-center gap-1.5 text-center">
                      <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="truncate">
                        Scheduled Change • Effective {currentSub?.scheduledDowngradeEffectiveDate ? new Date(currentSub.scheduledDowngradeEffectiveDate).toLocaleDateString() : 'Next Cycle'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isActionPending}
                      onClick={handleCancelDowngrade}
                      className="w-full h-9 py-1.5 px-3 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/50 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                    >
                      {cancellingDowngrade ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Cancelling Scheduled Change...</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span>Cancel Scheduled Downgrade</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : isDowngradeCandidate ? (
                  <div
                    className="w-full h-10 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#1E293B]/60 text-slate-500 dark:text-[#94A3B8] border border-slate-200 dark:border-[#334155] flex items-center justify-center gap-2 select-none"
                    title="All features of this tier are already included in your current subscription"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-400 dark:text-[#64748B]" />
                    <span>Included in your current plan</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={upgradingPlanId === p.id}
                    onClick={() => handleUpgrade(p.id)}
                    className={`w-full h-10 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
                      isPopular
                        ? 'bg-rose-600 dark:bg-[#E11D48] text-white hover:bg-rose-700 dark:hover:bg-[#BE123C] focus:ring-2 focus:ring-rose-500 focus:ring-offset-2'
                        : 'bg-slate-900 dark:bg-[#E11D48] text-white hover:bg-slate-800 dark:hover:bg-[#BE123C] focus:ring-2 focus:ring-slate-700 focus:ring-offset-2'
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
                  {isDowngradeCandidate && !currentSub?.scheduledDowngradePlan ? (
                    <button
                      type="button"
                      disabled={isActionPending}
                      onClick={() => handleDowngrade(p)}
                      className="text-[11.5px] text-slate-500 hover:text-slate-700 dark:text-[#94A3B8] dark:hover:text-[#CBD5E1] underline underline-offset-2 transition cursor-pointer"
                    >
                      Schedule change to {p.name} at period end
                    </button>
                  ) : p.hasContactSales ? (
                    <a
                      href="mailto:sales@ricoz.in?subject=Enterprise%20Plan%20Custom%20Pricing%20Inquiry%20-%20RicozAnalytics"
                      className="w-full h-full py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-[#F8FAFC] border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E293B] transition text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Contact Enterprise Sales</span>
                    </a>
                  ) : p.id === 'growth' ? (
                    <span className="text-[11px] font-medium text-slate-400 dark:text-[#94A3B8] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-500 dark:text-[#FB7185]" />
                      Priority SLA & AI Copilot included
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400 dark:text-[#94A3B8] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
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
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">
            * All displayed prices are in INR (₹) and exclusive of 18% GST where applicable. Official tax invoices with GSTIN provided upon checkout.
          </p>
        </div>

        {/* Enterprise Security & Guarantee Badges */}
        <div className="rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] p-6 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-[#1E293B] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-[#334155] shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900 dark:text-[#F8FAFC]">256-Bit SSL Encryption</p>
                <p className="text-slate-500 dark:text-[#94A3B8] mt-0.5 text-[11px]">
                  All transactions are cryptographically secured via Razorpay PCI-DSS Level 1 certified gateway with HMAC-SHA256 signature verification.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-[#1E293B] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-[#334155] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900 dark:text-[#F8FAFC]">Zero Data Loss Guarantee</p>
                <p className="text-slate-500 dark:text-[#94A3B8] mt-0.5 text-[11px]">
                  Your datasets, models, and dashboards remain safely preserved upon trial end or plan downgrade.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-[#1E293B] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-[#334155] shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900 dark:text-[#F8FAFC]">Enterprise Invoicing & GST</p>
                <p className="text-slate-500 dark:text-[#94A3B8] mt-0.5 text-[11px]">
                  Need custom PO billing or wire transfer?{' '}
                  <a href="mailto:sales@ricoz.in" className="text-rose-600 dark:text-[#FB7185] underline font-semibold">
                    Contact Enterprise Sales
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Razorpay Orders & Transaction Ledger */}
        {orders && orders.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] overflow-hidden shadow-2xs">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-700 dark:text-[#CBD5E1]" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">Razorpay Payment Gateway Orders</h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">Authoritative order records and cryptographic transaction IDs</p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] bg-slate-100 dark:bg-[#1E293B] px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#334155]">
                {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#334155] bg-slate-50/70 dark:bg-[#1E293B] text-slate-500 dark:text-[#CBD5E1] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-6">Order ID</th>
                    <th className="py-3 px-6">Payment ID</th>
                    <th className="py-3 px-6">Plan / Interval</th>
                    <th className="py-3 px-6">Amount</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#334155] text-slate-700 dark:text-[#CBD5E1]">
                  {orders.map((ord) => {
                    const isPaid = ord.status === 'paid';
                    const isFailed = ord.status === 'failed';
                    const amt = (Number(ord.amount_paise || 0) / 100).toLocaleString('en-IN');

                    return (
                      <tr key={ord.id || ord.order_id} className="hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/50">
                        <td className="py-3 px-6 font-mono font-medium text-slate-900 dark:text-[#F8FAFC]">
                          {ord.order_id}
                        </td>
                        <td className="py-3 px-6 font-mono text-[11px] text-slate-600 dark:text-[#94A3B8]">
                          {ord.payment_id || '—'}
                        </td>
                        <td className="py-3 px-6 capitalize">
                          <span className="font-semibold text-slate-900 dark:text-[#F8FAFC]">{ord.plan_id}</span> ({ord.billing_interval || 'monthly'})
                        </td>
                        <td className="py-3 px-6 font-semibold">₹{amt}</td>
                        <td className="py-3 px-6">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                              : isFailed
                              ? 'bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border-rose-200 dark:border-rose-900/60'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                          }`}>
                            {ord.status || 'Created'}
                          </span>
                        </td>
                        <td className="py-3 px-6 font-mono text-[11px] text-slate-500 dark:text-[#94A3B8]">
                          {ord.created_at ? new Date(ord.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-6 text-right">
                          {isFailed ? (
                            <button
                              type="button"
                              onClick={() => handleUpgrade(ord.plan_id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-[#FB7185] hover:underline cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retry Payment</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-400 dark:text-[#64748B]">
                              {ord.receipt || 'Verified'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invoices History Table */}
        <div className="rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">Billing History & Invoices</h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">Download official tax invoices and receipts for accounting records</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#334155] bg-slate-50/70 dark:bg-[#1E293B] text-slate-500 dark:text-[#CBD5E1] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">Invoice ID</th>
                  <th className="py-3 px-6">Payment Reference</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#334155] text-slate-700 dark:text-[#CBD5E1]">
                {invoices && invoices.length > 0 ? (
                  invoices.map((inv) => {
                    const isINR = (inv.currency || 'inr').toLowerCase() === 'inr';
                    const sym = isINR ? '₹' : '$';
                    const formattedAmt = typeof inv.amount === 'number'
                      ? inv.amount.toLocaleString('en-IN')
                      : ((inv.amount_paid || 0) / 100).toLocaleString('en-IN');
                    const paymentRef = inv.razorpay_payment_id || inv.razorpay_order_id || inv.stripe_invoice_id || '—';

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/50">
                        <td className="py-3 px-6 font-mono font-medium text-slate-900 dark:text-[#F8FAFC]">{inv.id}</td>
                        <td className="py-3 px-6 font-mono text-[11px] text-slate-600 dark:text-[#94A3B8]">
                          {paymentRef}
                        </td>
                        <td className="py-3 px-6">{new Date(inv.created_at || Date.now()).toLocaleDateString()}</td>
                        <td className="py-3 px-6 font-semibold">{sym}{formattedAmt}</td>
                        <td className="py-3 px-6">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 uppercase">
                            {inv.status || 'Paid'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => alert(`Receipt Reference: ${inv.receipt_number || inv.razorpay_payment_id || inv.id}`)}
                            className="text-rose-600 dark:text-[#FB7185] hover:text-rose-700 dark:hover:text-rose-400 font-semibold cursor-pointer"
                          >
                            Receipt &darr;
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-[#64748B] text-xs">
                      No invoices yet. Your 14-day free trial does not generate billing charges.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subscription & Entitlement Audit History */}
        <div className="rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700 dark:text-[#CBD5E1]" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">Subscription & Entitlement Audit History</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Immutable event record of upgrades, scheduled downgrades, renewals, and cancellations
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] bg-slate-100 dark:bg-[#1E293B] px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#334155]">
              {history.length} {history.length === 1 ? 'Event' : 'Events'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#334155] bg-slate-50/70 dark:bg-[#1E293B] text-slate-500 dark:text-[#CBD5E1] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">Event</th>
                  <th className="py-3 px-6">Plan Transition</th>
                  <th className="py-3 px-6">Billing Cycle</th>
                  <th className="py-3 px-6">Effective Date</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#334155] text-slate-700 dark:text-[#CBD5E1]">
                {history && history.length > 0 ? (
                  history.map((ev) => {
                    const badgeClass =
                      ev.event_type === 'upgrade'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                        : ev.event_type === 'downgrade_scheduled'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                        : ev.event_type === 'downgrade_applied'
                        ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60'
                        : ev.event_type === 'cancelled'
                        ? 'bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border-rose-200 dark:border-rose-900/60'
                        : 'bg-slate-50 dark:bg-[#1E293B] text-slate-700 dark:text-[#CBD5E1] border-slate-200 dark:border-[#334155]';

                    const eventLabel =
                      ev.event_type === 'downgrade_scheduled'
                        ? 'Downgrade Scheduled'
                        : ev.event_type === 'downgrade_applied'
                        ? 'Downgrade Applied'
                        : ev.event_type ? ev.event_type.charAt(0).toUpperCase() + ev.event_type.slice(1) : 'Event';

                    return (
                      <tr key={ev.id || `${ev.event_type}-${ev.created_at}`} className="hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/50">
                        <td className="py-3 px-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badgeClass}`}>
                            {eventLabel}
                          </span>
                        </td>
                        <td className="py-3 px-6 font-medium">
                          {ev.from_plan ? (
                            <span className="inline-flex items-center gap-1.5 capitalize">
                              <span className="text-slate-500 dark:text-[#94A3B8]">{ev.from_plan}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              <span className="text-slate-900 dark:text-[#F8FAFC] font-bold">{ev.to_plan || 'None'}</span>
                            </span>
                          ) : (
                            <span className="capitalize text-slate-900 dark:text-[#F8FAFC] font-bold">{ev.to_plan || 'Initial Setup'}</span>
                          )}
                        </td>
                        <td className="py-3 px-6 capitalize text-slate-600 dark:text-[#CBD5E1]">
                          {ev.billing_interval || 'Monthly'}
                        </td>
                        <td className="py-3 px-6 text-slate-600 dark:text-[#CBD5E1]">
                          {ev.effective_date ? new Date(ev.effective_date).toLocaleDateString() : 'Immediate'}
                        </td>
                        <td className="py-3 px-6">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-[#CBD5E1] capitalize">
                            {ev.status || 'Processed'}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-[11px] text-slate-500 dark:text-[#94A3B8]">
                          {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-[#64748B] text-xs">
                      No subscription change events recorded yet. Plan transitions, upgrades, and scheduled downgrades will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cryptographic Payment Verification Modal */}
        {verifyingPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/60 mx-auto flex items-center justify-center">
                <ShieldCheck className="h-7 w-7 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#F8FAFC]">Cryptographic Verification</h3>
                <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1.5 leading-relaxed">
                  {verificationStep || 'Authoritatively validating payment signature and activating enterprise entitlements...'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-rose-600 dark:text-[#FB7185] bg-rose-50 dark:bg-[#2A1422] py-2 px-3 rounded-lg border border-rose-100 dark:border-rose-900/40">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Synchronizing with Razorpay network</span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-[#64748B]">
                Please do not refresh or close this browser tab while your workspace is being provisioned.
              </p>
            </div>
          </div>
        )}

        {/* Scheduled Downgrade Confirmation Modal */}
        {downgradeConfirmTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155] rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC]">
                      Schedule Downgrade to {downgradeConfirmTarget.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                      Takes effect on your next billing renewal date
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => setDowngradeConfirmTarget(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-[#CBD5E1] bg-slate-50 dark:bg-[#1E293B]/60 p-4 rounded-xl border border-slate-200 dark:border-[#334155]/80">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Active Benefits Preserved:</strong> You will remain on the <strong>{currentSub?.plan?.toUpperCase() || 'CURRENT'}</strong> plan with all premium entitlements until{' '}
                    <strong>
                      {currentSub?.currentPeriodEnd || currentSub?.relevantEndDate
                        ? new Date(currentSub.currentPeriodEnd || currentSub.relevantEndDate).toLocaleDateString()
                        : 'the end of your current billing period'}
                    </strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero Data Loss:</strong> All existing datasets, dashboards, team members, and audit history will remain intact and securely preserved.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Flexible Cancellation:</strong> You can cancel or reschedule this downgrade at any time before the billing cycle completes.
                  </span>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => setDowngradeConfirmTarget(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#334155] transition cursor-pointer disabled:opacity-50"
                >
                  Keep Current Plan
                </button>
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => executeDowngrade(downgradeConfirmTarget.id)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {downgradingPlanId === downgradeConfirmTarget.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scheduling Downgrade...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="w-4 h-4" />
                      <span>Confirm Scheduled Downgrade</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
