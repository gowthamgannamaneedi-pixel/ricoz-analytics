const db = require('../config/database');
const plansConfig = require('../config/plans');
const SubscriptionHistoryModel = require('../models/subscriptionHistoryModel');
const SubscriptionReminderModel = require('../models/subscriptionReminderModel');
const emailService = require('./emailService');
const { calculateNextBillingDate, calculateTrialEndDate, calculateTimeRemaining } = require('../utils/billingDateUtils');

const {
  PLANS,
  PLAN_HIERARCHY,
  getPlan,
  hasFeature,
  getLimit,
  isWithinLimit,
  comparePlans,
  getUpgradeGuidance
} = plansConfig;

const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  TRIAL_EXPIRING: 'trial_expiring',
  TRIAL_EXPIRED: 'trial_expired',
  PAYMENT_PENDING: 'payment_pending',
  ACTIVE: 'active',
  PAYMENT_FAILED: 'payment_failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended'
};

// In-memory cache for organization subscription details (60s TTL)
const orgSubscriptionCache = new Map();
const ORG_CACHE_TTL_MS = 60 * 1000;

/**
 * Enterprise Production Subscription & Plan Enforcement Service — RicozAnalytics
 */
class SubscriptionService {
  constructor() {
    this.PLANS = PLANS;
    this.SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES;
  }

  /**
   * Clear in-memory subscription cache for an organization (or all)
   * @param {string} [organizationId] 
   */
  clearOrganizationCache(organizationId) {
    if (organizationId) {
      orgSubscriptionCache.delete(String(organizationId));
    } else {
      orgSubscriptionCache.clear();
    }
  }

  /**
   * Pre-populate or update in-memory subscription cache
   * @param {string} organizationId 
   * @param {object} subscription 
   */
  primeOrganizationCache(organizationId, subscription) {
    if (organizationId && subscription) {
      orgSubscriptionCache.set(String(organizationId), {
        data: subscription,
        cachedAt: Date.now()
      });
    }
  }

  /**
   * Get subscription, entitlements, and live usage for an organization
   * @param {string} organizationId 
   * @param {{ includeUsage?: boolean, forceFresh?: boolean }} [options]
   * @returns {Promise<any>}
   */
  async getOrganizationSubscription(organizationId, options = {}) {
    if (!organizationId) {
      return null;
    }

    const includeUsage = options.includeUsage !== false;
    const forceFresh = Boolean(options.forceFresh);

    // 1. Fast cache check
    const cached = orgSubscriptionCache.get(String(organizationId));
    if (!forceFresh && cached && (Date.now() - cached.cachedAt < ORG_CACHE_TTL_MS)) {
      if (!includeUsage || (cached.data && cached.data.usage)) {
        return cached.data;
      }
    }

    let org = null;
    try {
      const res = await db.query('SELECT * FROM organizations WHERE id = $1 LIMIT 1;', [organizationId]);
      org = res.rows[0];
    } catch (err) {
      console.warn('[SubscriptionService] Error fetching organization subscription details:', err.message);
      return null;
    }
    if (!org) return null;

    const now = new Date();

    // 1. Process scheduled downgrade if effective date has arrived
    if (org.scheduled_downgrade_plan && org.scheduled_downgrade_effective_date) {
      const effectiveDate = new Date(org.scheduled_downgrade_effective_date);
      if (now >= effectiveDate) {
        const updated = await this._applyScheduledDowngrade(org);
        org.plan = org.scheduled_downgrade_plan;
        org.scheduled_downgrade_plan = null;
        org.scheduled_downgrade_effective_date = null;
        if (updated) {
          org.current_period_start = updated.current_period_start;
          org.current_period_end = updated.current_period_end;
        }
      }
    }

    const trialStartedAt = org.trial_started_at ? new Date(org.trial_started_at) : new Date(org.created_at || now);
    const trialEndsAt = org.trial_ends_at
      ? new Date(org.trial_ends_at)
      : calculateTrialEndDate(trialStartedAt, 14);

    const currentPeriodStart = org.current_period_start ? new Date(org.current_period_start) : null;
    const currentPeriodEnd = org.current_period_end ? new Date(org.current_period_end) : null;

    let effectiveStatus = org.subscription_status || SUBSCRIPTION_STATUSES.TRIAL;

    // 2. Evaluate active paid vs trial state
    if (effectiveStatus === SUBSCRIPTION_STATUSES.ACTIVE) {
      if (currentPeriodEnd && now > currentPeriodEnd) {
        // Paid period has lapsed
        if (org.cancel_at_period_end) {
          effectiveStatus = SUBSCRIPTION_STATUSES.CANCELLED;
        } else {
          effectiveStatus = SUBSCRIPTION_STATUSES.EXPIRED;
        }
      }
    } else if (
      effectiveStatus !== SUBSCRIPTION_STATUSES.CANCELLED &&
      effectiveStatus !== SUBSCRIPTION_STATUSES.SUSPENDED &&
      effectiveStatus !== SUBSCRIPTION_STATUSES.PAYMENT_FAILED &&
      effectiveStatus !== SUBSCRIPTION_STATUSES.TRIAL_EXPIRED &&
      effectiveStatus !== SUBSCRIPTION_STATUSES.EXPIRED
    ) {
      // In trial lifecycle
      if (now > trialEndsAt) {
        effectiveStatus = SUBSCRIPTION_STATUSES.TRIAL_EXPIRED;
      } else {
        const msRemaining = trialEndsAt.getTime() - now.getTime();
        const daysToTrialEnd = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
        if (daysToTrialEnd <= 3) {
          effectiveStatus = SUBSCRIPTION_STATUSES.TRIAL_EXPIRING;
        } else {
          effectiveStatus = SUBSCRIPTION_STATUSES.TRIAL;
        }
      }
    }

    // 3. Calculate reliable server-side days remaining
    let daysRemaining = 0;
    let hoursRemaining = 0;
    let relevantEndDate = null;

    if (effectiveStatus === SUBSCRIPTION_STATUSES.ACTIVE && currentPeriodEnd) {
      relevantEndDate = currentPeriodEnd;
      const ms = currentPeriodEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      hoursRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60)));
    } else if ([SUBSCRIPTION_STATUSES.TRIAL, SUBSCRIPTION_STATUSES.TRIAL_EXPIRING].includes(effectiveStatus)) {
      relevantEndDate = trialEndsAt;
      const ms = trialEndsAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      hoursRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60)));
    }

    const isExpiringSoon = daysRemaining <= 10 && daysRemaining > 0 && (
      effectiveStatus === SUBSCRIPTION_STATUSES.ACTIVE ||
      effectiveStatus === SUBSCRIPTION_STATUSES.TRIAL ||
      effectiveStatus === SUBSCRIPTION_STATUSES.TRIAL_EXPIRING
    );

    const planConfig = getPlan(org.plan || 'starter');
    const canAccessApp = [
      SUBSCRIPTION_STATUSES.ACTIVE,
      SUBSCRIPTION_STATUSES.TRIAL,
      SUBSCRIPTION_STATUSES.TRIAL_EXPIRING
    ].includes(effectiveStatus);

    // 4. Fetch actual server-side usage telemetry ONLY when needed (e.g. billing page or quota checks)
    let usage = null;
    if (includeUsage) {
      usage = await this.getOrganizationUsage(org.id, planConfig);
    }

    const result = {
      organizationId: org.id,
      organizationName: org.name,
      slug: org.slug,
      plan: planConfig.id,
      planName: planConfig.name,
      planDetails: planConfig,
      billingInterval: org.billing_interval || 'monthly',
      status: effectiveStatus,
      subscriptionStatus: effectiveStatus,
      subscription_status: effectiveStatus,
      paymentStatus: org.payment_status || 'unpaid',
      hasWorkspaceAccess: canAccessApp,
      canAccessApp,
      isTrial: [SUBSCRIPTION_STATUSES.TRIAL, SUBSCRIPTION_STATUSES.TRIAL_EXPIRING].includes(effectiveStatus),
      isExpired: [SUBSCRIPTION_STATUSES.TRIAL_EXPIRED, SUBSCRIPTION_STATUSES.EXPIRED].includes(effectiveStatus),
      isActive: effectiveStatus === SUBSCRIPTION_STATUSES.ACTIVE,
      isExpiringSoon,
      daysRemaining,
      hoursRemaining,
      relevantEndDate,
      trialStartedAt,
      trialEndsAt,
      subscriptionStartDate: org.subscription_start_date || org.created_at,
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate: org.next_billing_date || currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(org.cancel_at_period_end),
      cancelledAt: org.cancelled_at || null,
      cancellationEffectiveDate: org.cancellation_effective_date || null,
      scheduledDowngradePlan: org.scheduled_downgrade_plan || null,
      scheduledDowngradeEffectiveDate: org.scheduled_downgrade_effective_date || null,
      stripeCustomerId: org.stripe_customer_id || null,
      stripeSubscriptionId: org.stripe_subscription_id || null,
      entitlements: planConfig.entitlements,
      usage
    };

    // Cache computed subscription
    orgSubscriptionCache.set(String(org.id), {
      data: result,
      cachedAt: Date.now()
    });

    return result;
  }

  /**
   * Get accurate usage metrics (datasets, users) for an organization
   * Queries counts concurrently with Promise.all for high performance
   * @param {string} organizationId 
   * @param {object} planConfig 
   */
  async getOrganizationUsage(organizationId, planConfig) {
    const plan = planConfig || getPlan('starter');

    let datasetsCount = 0;
    let membersCount = 0;
    let pendingInvitationsCount = 0;

    try {
      const [dsRes, uRes, invRes] = await Promise.all([
        db.query(
          `SELECT COUNT(*)::int as count FROM data_sources WHERE organization_id::text = $1::text`,
          [organizationId]
        ).catch(() => ({ rows: [] })),
        db.query(
          `SELECT COUNT(*)::int as count FROM users WHERE organization_id::text = $1::text AND COALESCE(status, 'active') != 'deactivated'`,
          [organizationId]
        ).catch(() => ({ rows: [] })),
        db.query(
          `SELECT COUNT(*)::int as count FROM invitations WHERE organization_id::text = $1::text AND status = 'pending' AND expires_at > NOW()`,
          [organizationId]
        ).catch(() => ({ rows: [] }))
      ]);

      datasetsCount = Number(dsRes.rows[0]?.count || 0);
      membersCount = Number(uRes.rows[0]?.count || 0);
      pendingInvitationsCount = Number(invRes.rows[0]?.count || 0);
    } catch (_) {
      // Fallback resilience
    }

    const totalSeatsUsed = membersCount + pendingInvitationsCount;
    const maxDatasets = plan.maxDatasets;
    const maxUsers = plan.maxUsers;

    return {
      datasets: {
        count: datasetsCount,
        limit: maxDatasets,
        isWithinLimit: maxDatasets === -1 || datasetsCount < maxDatasets,
        isAtLimit: maxDatasets !== -1 && datasetsCount >= maxDatasets,
        remaining: maxDatasets === -1 ? 'Unlimited' : Math.max(0, maxDatasets - datasetsCount)
      },
      users: {
        count: totalSeatsUsed,
        membersCount,
        pendingInvitationsCount,
        limit: maxUsers,
        isWithinLimit: maxUsers === -1 || totalSeatsUsed < maxUsers,
        isAtLimit: maxUsers !== -1 && totalSeatsUsed >= maxUsers,
        remaining: maxUsers === -1 ? 'Unlimited' : Math.max(0, maxUsers - totalSeatsUsed)
      }
    };
  }

  /**
   * Check if organization has active access rights (Trial or Paid)
   * Highly optimized: checks in-memory cache first, skips 3 count queries
   * @param {string} organizationId 
   * @returns {Promise<{ allowed: boolean, code?: string, message?: string, subscription?: any }>}
   */
  async checkWorkspaceAccess(organizationId) {
    if (!organizationId) {
      return {
        allowed: false,
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found.'
      };
    }

    // 1. In-memory cache hit check
    const cached = orgSubscriptionCache.get(String(organizationId));
    if (cached && (Date.now() - cached.cachedAt < ORG_CACHE_TTL_MS)) {
      const sub = cached.data;
      if (!sub.canAccessApp) {
        const isTrialExp = sub.status === SUBSCRIPTION_STATUSES.TRIAL_EXPIRED;
        return {
          allowed: false,
          code: isTrialExp ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED',
          message: isTrialExp
            ? 'Your 14-day free trial has expired. Select a plan to continue accessing your workspace.'
            : 'An active paid subscription is required to access workspace data.',
          subscription: sub
        };
      }
      return {
        allowed: true,
        subscription: sub
      };
    }

    // 2. Fetch subscription status without running 3 usage count queries
    const sub = await this.getOrganizationSubscription(organizationId, { includeUsage: false });
    if (!sub) {
      return {
        allowed: false,
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found.'
      };
    }

    if (!sub.canAccessApp) {
      const isTrialExp = sub.status === SUBSCRIPTION_STATUSES.TRIAL_EXPIRED;
      return {
        allowed: false,
        code: isTrialExp ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED',
        message: isTrialExp
          ? 'Your 14-day free trial has expired. Select a plan to continue accessing your workspace.'
          : 'An active paid subscription is required to access workspace data.',
        subscription: sub
      };
    }

    return {
      allowed: true,
      subscription: sub
    };
  }

  /**
   * Check whether an organization is entitled to a specific platform feature
   * @param {string} organizationId 
   * @param {'insights'|'alerts'|'aiQueryPlanner'|'reports'|'automatedReports'} featureKey 
   * @returns {Promise<{ allowed: boolean, code?: string, message?: string, upgradeGuidance?: object, subscription?: any }>}
   */
  async checkFeatureEntitlement(organizationId, featureKey) {
    const access = await this.checkWorkspaceAccess(organizationId);
    if (!access.allowed) {
      return access;
    }

    const sub = access.subscription;
    const plan = getPlan(sub.plan);

    if (!plan.entitlements || !plan.entitlements[featureKey]) {
      const guidance = getUpgradeGuidance(sub.plan, featureKey);
      return {
        allowed: false,
        code: 'PLAN_UPGRADE_REQUIRED',
        message: guidance.message,
        upgradeGuidance: guidance,
        subscription: sub
      };
    }

    return {
      allowed: true,
      subscription: sub
    };
  }

  /**
   * Check whether adding one more resource would exceed the organization's plan limit
   * @param {string} organizationId 
   * @param {'datasets'|'users'} resourceType 
   * @returns {Promise<{ allowed: boolean, code?: string, message?: string, currentCount?: number, limit?: number, upgradeGuidance?: object, subscription?: any }>}
   */
  async checkUsageLimit(organizationId, resourceType) {
    const sub = await this.getOrganizationSubscription(organizationId, { includeUsage: true });
    if (!sub) {
      return {
        allowed: false,
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found.'
      };
    }

    if (!sub.canAccessApp) {
      const isTrialExp = sub.status === SUBSCRIPTION_STATUSES.TRIAL_EXPIRED;
      return {
        allowed: false,
        code: isTrialExp ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED',
        message: isTrialExp
          ? 'Your 14-day free trial has expired. Select a plan to continue accessing your workspace.'
          : 'An active paid subscription is required to access workspace data.',
        subscription: sub
      };
    }

    const usageData = sub.usage ? sub.usage[resourceType] : null;
    if (!usageData) {
      return { allowed: true, subscription: sub };
    }

    if (usageData.limit !== -1 && usageData.count >= usageData.limit) {
      const resourceLabel = resourceType === 'datasets' ? 'connected datasets' : 'team members';
      const targetPlanKey = PLAN_HIERARCHY.find(p => {
        const lim = getLimit(p, resourceType === 'datasets' ? 'maxDatasets' : 'maxUsers');
        return lim === -1 || lim > usageData.limit;
      }) || 'enterprise';
      const targetPlan = getPlan(targetPlanKey);

      return {
        allowed: false,
        code: 'RESOURCE_LIMIT_EXCEEDED',
        message: `Plan limit reached: Your current ${sub.planName} plan allows a maximum of ${usageData.limit} ${resourceLabel}. Upgrade to ${targetPlan.name} to add more.`,
        currentCount: usageData.count,
        limit: usageData.limit,
        upgradeGuidance: {
          currentPlan: sub.plan,
          targetPlan: targetPlan.id,
          targetPlanName: targetPlan.name,
          upgradeUrl: '/billing',
          priceMonthly: targetPlan.priceMonthly,
          currencySymbol: targetPlan.currencySymbol
        },
        subscription: sub
      };
    }

    return {
      allowed: true,
      subscription: sub
    };
  }

  /**
   * Apply verified upgrade to organization and record in audit history
   * @param {string} organizationId 
   * @param {{
   *   planId: string,
   *   billingInterval?: 'monthly'|'yearly',
   *   amount?: number,
   *   currency?: string,
   *   stripeCustomerId?: string,
   *   stripeSubscriptionId?: string,
   *   currentPeriodEnd?: Date
   * }} params
   */
  async applyUpgrade(organizationId, {
    planId,
    billingInterval = 'monthly',
    amount = null,
    currency = 'inr',
    stripeCustomerId = null,
    stripeSubscriptionId = null,
    razorpayPaymentId = null,
    razorpayOrderId = null,
    razorpayCustomerId = null,
    paymentGateway = 'razorpay',
    currentPeriodEnd = null
  } = {}) {
    const plan = getPlan(planId);
    const now = new Date();
    const isAnnual = billingInterval === 'yearly' || billingInterval === 'annual';
    const effectivePeriodEnd = currentPeriodEnd || calculateNextBillingDate(now, isAnnual ? 'yearly' : 'monthly');

    const oldSub = await this.getOrganizationSubscription(organizationId);
    const fromPlan = oldSub ? oldSub.plan : 'starter';

    const updates = {
      plan: plan.id,
      subscription_status: SUBSCRIPTION_STATUSES.ACTIVE,
      payment_status: 'paid',
      billing_interval: billingInterval,
      subscription_start_date: oldSub?.subscriptionStartDate || now,
      current_period_start: now,
      current_period_end: effectivePeriodEnd,
      next_billing_date: effectivePeriodEnd,
      cancel_at_period_end: false,
      scheduled_downgrade_plan: null,
      scheduled_downgrade_effective_date: null
    };

    if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
    if (stripeSubscriptionId) updates.stripe_subscription_id = stripeSubscriptionId;
    if (razorpayPaymentId) updates.razorpay_payment_id = razorpayPaymentId;
    if (razorpayOrderId) updates.razorpay_order_id = razorpayOrderId;
    if (razorpayCustomerId) updates.razorpay_customer_id = razorpayCustomerId;

    const updatedOrg = await this.updateSubscription(organizationId, updates);

    // Record in subscription history
    await SubscriptionHistoryModel.recordEvent({
      organizationId,
      eventType: comparePlans(plan.id, fromPlan) > 0 ? 'upgrade' : 'renewed',
      fromPlan,
      toPlan: plan.id,
      billingInterval,
      amount: amount != null ? amount : (isAnnual ? plan.priceYearly : plan.priceMonthly),
      currency,
      status: SUBSCRIPTION_STATUSES.ACTIVE,
      effectiveDate: now,
      metadata: {
        stripeCustomerId,
        stripeSubscriptionId,
        razorpayPaymentId,
        razorpayOrderId,
        razorpayCustomerId,
        paymentGateway: paymentGateway || (razorpayPaymentId ? 'razorpay' : 'stripe'),
        currentPeriodEnd: effectivePeriodEnd
      }
    }).catch(err => console.warn('[SubscriptionHistory] Recording error:', err.message));

    console.log(`[SubscriptionService] ✅ Verified upgrade applied: Org ${organizationId} -> ${plan.name} (${billingInterval}).`);
    return updatedOrg;
  }

  /**
   * Schedule a downgrade for the end of the current billing period
   * (Per billing policy: higher tier entitlements remain active until the paid period ends)
   * @param {string} organizationId 
   * @param {string} newPlanId 
   */
  async scheduleDowngrade(organizationId, newPlanId) {
    const sub = await this.getOrganizationSubscription(organizationId);
    if (!sub) throw new Error('Organization not found');

    const targetPlan = getPlan(newPlanId);
    const effectiveDate = sub.currentPeriodEnd || calculateNextBillingDate(new Date(), sub.billingInterval || 'monthly');

    // Schedule downgrade at current_period_end
    await this.updateSubscription(organizationId, {
      scheduled_downgrade_plan: targetPlan.id,
      scheduled_downgrade_effective_date: effectiveDate
    });

    await SubscriptionHistoryModel.recordEvent({
      organizationId,
      eventType: 'downgrade_scheduled',
      fromPlan: sub.plan,
      toPlan: targetPlan.id,
      billingInterval: sub.billingInterval,
      status: sub.status,
      effectiveDate,
      metadata: {
        reason: 'User scheduled downgrade',
        effectiveAt: effectiveDate
      }
    }).catch(err => console.warn('[SubscriptionHistory] Downgrade schedule record warning:', err.message));

    return {
      scheduled: true,
      currentPlan: sub.plan,
      targetPlan: targetPlan.id,
      effectiveDate
    };
  }

  /**
   * Internal helper to apply a scheduled downgrade once the effective date arrives
   * @param {object} org 
   */
  async _applyScheduledDowngrade(org) {
    const newPlan = getPlan(org.scheduled_downgrade_plan);
    console.log(`[SubscriptionService] ⬇️ Applying scheduled downgrade for Org ${org.id}: ${org.plan} -> ${newPlan.name}`);

    const now = new Date();
    const isAnnual = (org.billing_interval || 'monthly') === 'yearly' || (org.billing_interval || 'monthly') === 'annual';
    const nextEnd = calculateNextBillingDate(now, isAnnual ? 'yearly' : 'monthly');

    const updated = await this.updateSubscription(org.id, {
      plan: newPlan.id,
      scheduled_downgrade_plan: null,
      scheduled_downgrade_effective_date: null,
      current_period_start: now,
      current_period_end: nextEnd,
      next_billing_date: nextEnd
    });

    await SubscriptionHistoryModel.recordEvent({
      organizationId: org.id,
      eventType: 'downgrade_applied',
      fromPlan: org.plan,
      toPlan: newPlan.id,
      billingInterval: org.billing_interval || 'monthly',
      status: org.subscription_status,
      effectiveDate: new Date(),
      metadata: {
        note: 'Downgrade applied at billing period boundary. Customer data strictly preserved.'
      }
    }).catch(() => null);

    return updated;
  }

  /**
   * Cancel subscription (at period end or immediate)
   * @param {string} organizationId 
   * @param {{ immediate?: boolean }} options 
   */
  async cancelSubscription(organizationId, { immediate = false } = {}) {
    const sub = await this.getOrganizationSubscription(organizationId);
    if (!sub) throw new Error('Organization not found');

    const now = new Date();
    const effectiveDate = immediate ? now : (sub.currentPeriodEnd || now);

    const updates = {
      cancel_at_period_end: !immediate,
      cancelled_at: now,
      cancellation_effective_date: effectiveDate
    };

    if (immediate) {
      updates.subscription_status = SUBSCRIPTION_STATUSES.CANCELLED;
      updates.payment_status = 'unpaid';
    }

    const updated = await this.updateSubscription(organizationId, updates);

    await SubscriptionHistoryModel.recordEvent({
      organizationId,
      eventType: 'cancelled',
      fromPlan: sub.plan,
      toPlan: null,
      status: immediate ? SUBSCRIPTION_STATUSES.CANCELLED : sub.status,
      effectiveDate,
      metadata: {
        immediate,
        cancellationEffectiveDate: effectiveDate
      }
    }).catch(() => null);

    return updated;
  }

  /**
   * Check and send automated 10-day subscription and trial expiry reminders
   * @returns {Promise<{ checked: number, sent: number, skipped: number, errors: number }>}
   */
  async checkAndSendExpiryReminders() {
    const now = new Date();
    console.log(`[SubscriptionService] 🔍 Starting automated 10-day expiry reminder evaluation (${now.toISOString()})...`);

    let checked = 0;
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Find active or trialing organizations
      const sql = `
        SELECT id, name, plan, subscription_status, payment_status, trial_ends_at, current_period_end
        FROM organizations
        WHERE subscription_status IN ('active', 'trial', 'trial_expiring')
      `;
      const res = await db.query(sql);
      const organizations = res.rows || [];

      for (const org of organizations) {
        checked++;
        try {
          const isTrial = org.subscription_status !== 'active';
          const targetEndDate = isTrial
            ? (org.trial_ends_at ? new Date(org.trial_ends_at) : null)
            : (org.current_period_end ? new Date(org.current_period_end) : null);

          if (!targetEndDate) {
            skipped++;
            continue;
          }

          const msRemaining = targetEndDate.getTime() - now.getTime();
          const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

          // 10-day reminder threshold: 0 < daysRemaining <= 10
          if (daysRemaining <= 10 && daysRemaining > 0) {
            const milestoneKey = isTrial ? 'trial_10_day_warning' : '10_day_warning';
            const targetDateStr = targetEndDate.toISOString().split('T')[0];

            // 1. Idempotency Check: Was reminder already sent for this milestone & period?
            const alreadySent = await SubscriptionReminderModel.hasReminderBeenSent(
              org.id,
              milestoneKey,
              targetDateStr
            );

            if (alreadySent) {
              skipped++;
              continue;
            }

            // 2. Fetch billing contacts (Admins & Owners)
            const usersRes = await db.query(
              `SELECT id, name, email FROM users WHERE organization_id = $1 AND role IN ('admin', 'owner') AND COALESCE(status, 'active') = 'active' ORDER BY role = 'owner' DESC, created_at ASC`,
              [org.id]
            );
            const contacts = usersRes.rows || [];

            if (contacts.length === 0) {
              console.warn(`[SubscriptionService] No active admin found to receive reminder for Org ${org.name} (${org.id})`);
              skipped++;
              continue;
            }

            const primaryContact = contacts[0];
            const planConfig = getPlan(org.plan);

            // 3. Dispatch transactional reminder email
            const emailResult = await emailService.sendSubscriptionExpiryReminder({
              email: primaryContact.email,
              recipientName: primaryContact.name || 'Workspace Administrator',
              orgName: org.name,
              planName: planConfig.name,
              expiryDate: targetDateStr,
              daysRemaining,
              isTrial,
              billingUrl: process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/billing` : 'http://localhost:5173/billing'
            });

            // 4. Persist reminder record to prevent duplicate delivery
            await SubscriptionReminderModel.recordReminder({
              organizationId: org.id,
              reminderType: milestoneKey,
              targetDate: targetDateStr,
              recipientEmail: primaryContact.email,
              status: emailResult.success ? 'sent' : 'failed',
              attemptCount: 1,
              errorMessage: emailResult.error || null,
              metadata: {
                daysRemaining,
                isTrial,
                plan: planConfig.id,
                contactName: primaryContact.name
              }
            });

            if (emailResult.success) {
              sent++;
              console.log(`[SubscriptionService] ✉️ 10-day expiry reminder sent to ${primaryContact.email} for Org "${org.name}" (${daysRemaining} days left).`);
            } else {
              errors++;
            }
          } else {
            skipped++;
          }
        } catch (orgErr) {
          console.error(`[SubscriptionService] Error processing reminder for org ${org.id}:`, orgErr.message);
          errors++;
        }
      }
    } catch (err) {
      console.error('[SubscriptionService] Expiry reminder evaluation failed:', err.message);
      errors++;
    }

    console.log(`[SubscriptionService] 🏁 Reminder evaluation complete: Checked ${checked}, Sent ${sent}, Skipped ${skipped}, Errors ${errors}`);
    return { checked, sent, skipped, errors };
  }

  /**
   * Update subscription details on organization
   * @param {string} organizationId 
   * @param {object} updates 
   */
  async updateSubscription(organizationId, updates = {}) {
    const fields = [];
    const values = [];
    let idx = 1;

    const allowedColumns = [
      'subscription_status',
      'payment_status',
      'plan',
      'stripe_customer_id',
      'stripe_subscription_id',
      'stripe_price_id',
      'billing_interval',
      'subscription_start_date',
      'current_period_start',
      'current_period_end',
      'next_billing_date',
      'cancel_at_period_end',
      'cancelled_at',
      'cancellation_effective_date',
      'scheduled_downgrade_plan',
      'scheduled_downgrade_effective_date',
      'trial_started_at',
      'trial_ends_at'
    ];

    for (const col of allowedColumns) {
      if (updates[col] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(updates[col]);
      }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(organizationId);

    const sql = `
      UPDATE organizations
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;
    const res = await db.query(sql, values);
    this.clearOrganizationCache(organizationId);
    return res.rows[0] || null;
  }
}

module.exports = new SubscriptionService();
module.exports.SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES;
module.exports.PLANS = PLANS;
module.exports.PLAN_HIERARCHY = PLAN_HIERARCHY;
module.exports.getPlan = getPlan;
module.exports.hasFeature = hasFeature;
module.exports.getLimit = getLimit;
module.exports.isWithinLimit = isWithinLimit;
module.exports.getUpgradeGuidance = getUpgradeGuidance;
