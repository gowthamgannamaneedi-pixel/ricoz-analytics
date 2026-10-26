import { useState, useEffect, useMemo } from 'react';

/**
 * Enterprise Dynamic Free Trial & Subscription Countdown Hook — RicozAnalytics
 * Authoritatively calculates remaining trial time from server timestamps
 * and updates live as time passes while the application remains open.
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
 *   progressPercent: number,
 *   hasValidDates: boolean,
 *   planName: string,
 *   status: string
 * }}
 */
export function useTrialCountdown(subscription) {
  // Extract authoritative timestamps from camelCase or snake_case
  const rawStartDate = subscription?.trialStartedAt || subscription?.trial_started_at || subscription?.subscriptionStartDate;
  const rawEndDate = subscription?.relevantEndDate || subscription?.trialEndsAt || subscription?.trial_ends_at || subscription?.currentPeriodEnd;
  const rawStatus = (subscription?.status || subscription?.subscriptionStatus || subscription?.subscription_status || '').toLowerCase();
  const isPaid = rawStatus === 'active';

  // Tick state to force re-render every 10 seconds for real-time accuracy
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000); // 10s interval

    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const planName = subscription?.planDetails?.name || subscription?.planName || subscription?.plan || 'Enterprise';

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
        progressPercent: 0,
        hasValidDates: false,
        planName,
        status: 'loading'
      };
    }

    if (isPaid) {
      const endD = rawEndDate ? new Date(rawEndDate) : null;
      const startD = rawStartDate ? new Date(rawStartDate) : null;
      return {
        isPaid: true,
        isTrial: false,
        isTrialExpired: false,
        isExpiringSoon: false,
        daysRemaining: endD && !isNaN(endD.getTime()) ? Math.max(0, Math.ceil((endD.getTime() - now) / 86400000)) : 30,
        hoursRemaining: endD && !isNaN(endD.getTime()) ? Math.max(0, Math.ceil((endD.getTime() - now) / 3600000)) : 720,
        startDateFormatted: startD && !isNaN(startD.getTime()) ? startD.toLocaleDateString() : 'Active',
        endDateFormatted: endD && !isNaN(endD.getTime()) ? endD.toLocaleDateString() : null,
        trialStatusText: 'Paid Plan Active',
        sidebarBadgeText: 'Active',
        progressPercent: 100,
        hasValidDates: Boolean(endD),
        planName,
        status: 'active'
      };
    }

    // Trial Calculation
    const endTimestamp = rawEndDate ? new Date(rawEndDate).getTime() : null;
    const startTimestamp = rawStartDate ? new Date(rawStartDate).getTime() : null;

    const hasValidEnd = endTimestamp != null && !isNaN(endTimestamp);
    const msRemaining = hasValidEnd ? endTimestamp - now : 0;
    const isElapsed = hasValidEnd ? msRemaining <= 0 : false;
    const isExplicitExpired = rawStatus === 'trial_expired' || rawStatus === 'expired' || subscription?.hasWorkspaceAccess === false;
    const isTrialExpired = isElapsed || isExplicitExpired;

    const daysRemaining = hasValidEnd && !isTrialExpired ? Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24))) : 0;
    const hoursRemaining = hasValidEnd && !isTrialExpired ? Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60))) : 0;

    let trialStatusText = 'Trial Active';
    let sidebarBadgeText = `${daysRemaining}d left`;

    if (isTrialExpired) {
      trialStatusText = 'Trial Expired';
      sidebarBadgeText = 'Expired';
    } else if (daysRemaining === 0 || hoursRemaining <= 24) {
      trialStatusText = 'Trial ends today';
      sidebarBadgeText = 'Ends today';
    } else if (daysRemaining === 1) {
      trialStatusText = 'Trial Active — 1 day remaining';
      sidebarBadgeText = '1d left';
    } else {
      trialStatusText = `Trial Active — ${daysRemaining} days remaining`;
      sidebarBadgeText = `${daysRemaining}d left`;
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
      progressPercent,
      hasValidDates: hasValidEnd,
      planName,
      status: isTrialExpired ? 'trial_expired' : 'trial'
    };
  }, [subscription, rawStartDate, rawEndDate, rawStatus, isPaid, now]);
}
