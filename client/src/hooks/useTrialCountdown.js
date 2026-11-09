import { useState, useEffect, useMemo } from 'react';

/**
 * Enterprise Dynamic Free Trial & Subscription Countdown Hook — RicozAnalytics
 * Authoritatively calculates remaining trial time from server timestamps
 * and updates live as time passes while the application remains open.
 * 
 * Strict Single Source of Truth Guarantee:
 * - If account is expired or cannot mutate, displayPlanStatus can NEVER contain 'Active'.
 * - If paid period has ended or payment_status != 'paid', account is marked as expired.
 * 
 * @param {object|null} subscription AuthContext or billing telemetry subscription object
 * @returns {{
 *   isPaid: boolean,
 *   isTrial: boolean,
 *   isTrialExpired: boolean,
 *   isExpiringSoon: boolean,
 *   daysRemaining: number,
 *   hoursRemaining: number,
 *   startDateFormatted: string | null,
 *   endDateFormatted: string | null,
 *   trialStatusText: string,
 *   sidebarBadgeText: string,
 *   displayPlanStatus: string,
 *   progressPercent: number,
 *   hasValidDates: boolean,
 *   planName: string,
 *   status: string
 * }}
 */
export function useTrialCountdown(subscription) {
  const rawStatus = (subscription?.status || subscription?.subscriptionStatus || subscription?.subscription_status || '').toLowerCase();
  const paymentStatus = (subscription?.payment_status || subscription?.paymentStatus || '').toLowerCase();

  // Authoritative server flags
  const serverCanMutate = subscription?.canMutate !== undefined ? Boolean(subscription.canMutate) : null;
  const serverIsPaidActive = subscription?.isPaidActive !== undefined ? Boolean(subscription.isPaidActive) : null;
  const serverIsExpired = subscription?.isExpired !== undefined ? Boolean(subscription.isExpired) : null;

  // Determine if this is truly an active paid account
  const isPaidActive = serverIsPaidActive !== null
    ? serverIsPaidActive
    : (rawStatus === 'active' && paymentStatus === 'paid');

  // Extract authoritative timestamps
  const rawStartDate = isPaidActive
    ? (subscription?.currentPeriodStart || subscription?.current_period_start || subscription?.subscriptionStartDate || subscription?.trialStartedAt || subscription?.trial_started_at)
    : (subscription?.trialStartedAt || subscription?.trial_started_at || subscription?.subscriptionStartDate || subscription?.currentPeriodStart);

  const rawEndDate = isPaidActive
    ? (subscription?.relevantEndDate || subscription?.currentPeriodEnd || subscription?.current_period_end || subscription?.nextBillingDate || subscription?.next_billing_date || null)
    : (subscription?.relevantEndDate || subscription?.trialEndsAt || subscription?.trial_ends_at || subscription?.currentPeriodEnd || subscription?.current_period_end);

  // Tick state to force re-render every 10 seconds for real-time accuracy
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000); // 10s interval

    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const rawPlan = subscription?.planDetails?.name || subscription?.planName || subscription?.plan || 'Enterprise';
    const planName = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1).toLowerCase();

    if (!subscription) {
      return {
        isPaid: false,
        isTrial: false,
        isTrialExpired: false,
        isExpiringSoon: false,
        daysRemaining: 0,
        hoursRemaining: 0,
        startDateFormatted: null,
        endDateFormatted: null,
        trialStatusText: 'Loading status...',
        sidebarBadgeText: '...',
        displayPlanStatus: `${planName} — Loading`,
        progressPercent: 0,
        hasValidDates: false,
        planName,
        status: 'loading'
      };
    }

    // 1. Explicitly Expired / Suspended / Restrictive States Check
    const isExplicitExpired = (
      serverIsExpired === true ||
      serverCanMutate === false ||
      rawStatus === 'trial_expired' ||
      rawStatus === 'expired' ||
      subscription?.hasWorkspaceAccess === false
    );

    // Paid Plan Processing
    if (isPaidActive && !isExplicitExpired) {
      const endD = rawEndDate ? new Date(rawEndDate) : null;
      const startD = rawStartDate ? new Date(rawStartDate) : null;
      const hasEndTimestamp = endD && !isNaN(endD.getTime());
      const isPastDue = hasEndTimestamp && now > endD.getTime();

      // If the active plan's billing period has passed, enforce expiration
      if (isPastDue) {
        return {
          isPaid: false,
          isTrial: false,
          isTrialExpired: true,
          isExpiringSoon: false,
          daysRemaining: 0,
          hoursRemaining: 0,
          startDateFormatted: startD && !isNaN(startD.getTime()) ? startD.toLocaleDateString() : 'Active',
          endDateFormatted: endD.toLocaleDateString(),
          trialStatusText: 'Subscription Expired',
          sidebarBadgeText: 'Expired',
          displayPlanStatus: `${planName} — Expired`,
          progressPercent: 100,
          hasValidDates: true,
          planName,
          status: 'expired'
        };
      }

      const ms = hasEndTimestamp ? endD.getTime() - now : 30 * 86400000;
      const daysRemaining = Math.max(0, Math.ceil(ms / 86400000));
      const hoursRemaining = Math.max(0, Math.ceil(ms / 3600000));
      const isExpiringSoon = daysRemaining <= 10 && daysRemaining > 0;

      return {
        isPaid: true,
        isTrial: false,
        isTrialExpired: false,
        isExpiringSoon,
        daysRemaining,
        hoursRemaining,
        startDateFormatted: startD && !isNaN(startD.getTime()) ? startD.toLocaleDateString() : 'Active',
        endDateFormatted: hasEndTimestamp ? endD.toLocaleDateString() : null,
        trialStatusText: isExpiringSoon ? `Renewal Approaching (${daysRemaining}d left)` : 'Paid Plan Active',
        sidebarBadgeText: isExpiringSoon ? `${daysRemaining}d left` : 'Active',
        displayPlanStatus: `${planName} — Active`,
        progressPercent: 100,
        hasValidDates: hasEndTimestamp,
        planName,
        status: 'active'
      };
    }

    // Trial & Expired Calculation
    const endTimestamp = rawEndDate ? new Date(rawEndDate).getTime() : null;
    const startTimestamp = rawStartDate ? new Date(rawStartDate).getTime() : null;

    const hasValidEnd = endTimestamp != null && !isNaN(endTimestamp);
    const msRemaining = hasValidEnd ? endTimestamp - now : 0;
    const isElapsed = hasValidEnd ? msRemaining <= 0 : false;
    const isTrialExpired = isElapsed || isExplicitExpired || !isPaidActive;

    const daysRemaining = hasValidEnd && !isTrialExpired ? Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24))) : 0;
    const hoursRemaining = hasValidEnd && !isTrialExpired ? Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60))) : 0;

    let trialStatusText = 'Trial Active';
    let sidebarBadgeText = `${daysRemaining}d left`;
    let displayPlanStatus = `${planName} — Trial Expired`;

    if (rawStatus === 'pending' || rawStatus === 'payment_pending') {
      displayPlanStatus = `${planName} — Payment Pending`;
      sidebarBadgeText = 'Payment Pending';
      trialStatusText = 'Payment Pending';
    } else if (rawStatus === 'past_due') {
      displayPlanStatus = `${planName} — Past Due`;
      sidebarBadgeText = 'Past Due';
      trialStatusText = 'Payment Past Due';
    } else if (rawStatus === 'on_hold') {
      displayPlanStatus = `${planName} — On Hold`;
      sidebarBadgeText = 'On Hold';
      trialStatusText = 'Account On Hold';
    } else if (rawStatus === 'suspended') {
      displayPlanStatus = `${planName} — Suspended`;
      sidebarBadgeText = 'Suspended';
      trialStatusText = 'Account Suspended';
    } else if (rawStatus === 'payment_failed') {
      displayPlanStatus = `${planName} — Payment Failed`;
      sidebarBadgeText = 'Payment Failed';
      trialStatusText = 'Payment Failed';
    } else if (rawStatus === 'expired') {
      displayPlanStatus = `${planName} — Expired`;
      sidebarBadgeText = 'Expired';
      trialStatusText = 'Subscription Expired';
    } else if (isTrialExpired) {
      trialStatusText = 'Trial Expired';
      sidebarBadgeText = 'Trial Expired';
      displayPlanStatus = `${planName} — Trial Expired`;
    } else if (daysRemaining === 0 || hoursRemaining <= 24) {
      trialStatusText = 'Trial ends today';
      sidebarBadgeText = 'Ends today';
      displayPlanStatus = `${planName} — Trial (Ends today)`;
    } else if (daysRemaining === 1) {
      trialStatusText = 'Trial Active — 1 day remaining';
      sidebarBadgeText = '1d left';
      displayPlanStatus = `${planName} — Trial (1 day left)`;
    } else {
      trialStatusText = `Trial Active — ${daysRemaining} days remaining`;
      sidebarBadgeText = `${daysRemaining}d left`;
      displayPlanStatus = `${planName} — Trial (${daysRemaining} days left)`;
    }

    // Safety override: if it's expired in any form, displayPlanStatus can NEVER contain 'Active'
    if (isTrialExpired && displayPlanStatus.toLowerCase().includes('active')) {
      displayPlanStatus = `${planName} — Trial Expired`;
    }

    const startDateFormatted = startTimestamp && !isNaN(startTimestamp)
      ? new Date(startTimestamp).toLocaleDateString()
      : null;

    const endDateFormatted = endTimestamp && !isNaN(endTimestamp)
      ? new Date(endTimestamp).toLocaleDateString()
      : null;

    const progressPercent = Math.max(5, Math.min(100, ((14 - daysRemaining) / 14) * 100));
    const isExpiringSoon = daysRemaining <= 10 && daysRemaining > 0 && !isTrialExpired;

    return {
      isPaid: false,
      isTrial: !isTrialExpired,
      isTrialExpired,
      isExpiringSoon,
      daysRemaining,
      hoursRemaining,
      startDateFormatted,
      endDateFormatted,
      trialStatusText,
      sidebarBadgeText,
      displayPlanStatus,
      progressPercent,
      hasValidDates: hasValidEnd,
      planName,
      status: isTrialExpired ? (rawStatus === 'expired' ? 'expired' : 'trial_expired') : (rawStatus || 'trial')
    };
  }, [subscription, rawStartDate, rawEndDate, rawStatus, isPaidActive, now]);
}
