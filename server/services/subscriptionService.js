const db = require('../config/database');

const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  TRIAL_EXPIRING: 'trial_expiring',
  TRIAL_EXPIRED: 'trial_expired',
  PAYMENT_PENDING: 'payment_pending',
  ACTIVE: 'active',
  PAYMENT_FAILED: 'payment_failed',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended'
};

const PLANS = {
  STARTER: {
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
    maxDatasets: 10,
    maxUsers: 5,
    description: 'Essential analytics and dashboards for individuals and agile small teams.',
    features: ['10 Connected Datasets', '5 Team Members', 'Automated Daily Reports', 'Standard Email Support']
  },
  GROWTH: {
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
    maxDatasets: 50,
    maxUsers: 25,
    description: 'Advanced business intelligence, automated anomaly alerts, and executive AI insights.',
    features: ['50 Connected Datasets', '25 Team Members', 'Executive AI Insights', 'Real-time Anomaly Alerts', 'Priority SLA Support']
  },
  ENTERPRISE: {
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
    maxDatasets: -1, // Unlimited
    maxUsers: -1, // Unlimited
    description: 'Unlimited capacity, enterprise governance, dedicated infrastructure, and 24/7 support.',
    features: ['Unlimited Datasets & Warehouses', 'Unlimited Team Members', 'Custom AI Query Planner', 'Dedicated Infrastructure', '24/7 Dedicated Support']
  }
};

/**
 * Enterprise Subscription & 14-Day Free Trial Management Service
 */
class SubscriptionService {
  /**
   * Get subscription & calculated trial status for an organization
   * @param {string} organizationId 
   * @returns {Promise<any>}
   */
  async getOrganizationSubscription(organizationId) {
    if (!organizationId) {
      return null;
    }

    const sql = `
      SELECT 
        id, 
        name, 
        slug, 
        plan, 
        trial_started_at, 
        trial_ends_at, 
        subscription_status, 
        payment_status, 
        stripe_customer_id, 
        stripe_subscription_id, 
        stripe_price_id, 
        current_period_end,
        created_at
      FROM organizations
      WHERE id = $1
      LIMIT 1;
    `;
    const res = await db.query(sql, [organizationId]);
    const org = res.rows[0];
    if (!org) return null;

    const now = new Date();
    const trialStartedAt = org.trial_started_at ? new Date(org.trial_started_at) : new Date(org.created_at || now);
    
    // Default 14-day duration
    const trialEndsAt = org.trial_ends_at
      ? new Date(org.trial_ends_at)
      : new Date(trialStartedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

    const msRemaining = trialEndsAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60)));

    let effectiveStatus = org.subscription_status || SUBSCRIPTION_STATUSES.TRIAL;

    // Evaluate live dynamic status if in trial lifecycle and not active paid
    if (effectiveStatus !== SUBSCRIPTION_STATUSES.ACTIVE && effectiveStatus !== SUBSCRIPTION_STATUSES.CANCELLED && effectiveStatus !== SUBSCRIPTION_STATUSES.SUSPENDED) {
      if (now > trialEndsAt) {
        effectiveStatus = SUBSCRIPTION_STATUSES.TRIAL_EXPIRED;
      } else if (daysRemaining <= 3) {
        effectiveStatus = SUBSCRIPTION_STATUSES.TRIAL_EXPIRING;
      } else {
        effectiveStatus = SUBSCRIPTION_STATUSES.TRIAL;
      }
    }

    const planConfig = PLANS[String(org.plan || 'starter').toUpperCase()] || PLANS.STARTER;
    const canAccessApp = [SUBSCRIPTION_STATUSES.ACTIVE, SUBSCRIPTION_STATUSES.TRIAL, SUBSCRIPTION_STATUSES.TRIAL_EXPIRING].includes(effectiveStatus);

    return {
      organizationId: org.id,
      organizationName: org.name,
      slug: org.slug,
      plan: org.plan || 'starter',
      planDetails: planConfig,
      status: effectiveStatus,
      subscriptionStatus: effectiveStatus,
      subscription_status: effectiveStatus,
      hasWorkspaceAccess: canAccessApp,
      paymentStatus: org.payment_status || 'unpaid',
      trialStartedAt,
      trialEndsAt,
      daysRemaining,
      hoursRemaining,
      isTrial: [SUBSCRIPTION_STATUSES.TRIAL, SUBSCRIPTION_STATUSES.TRIAL_EXPIRING].includes(effectiveStatus),
      isExpired: effectiveStatus === SUBSCRIPTION_STATUSES.TRIAL_EXPIRED,
      isActive: effectiveStatus === SUBSCRIPTION_STATUSES.ACTIVE,
      canAccessApp,
      currentPeriodEnd: org.current_period_end || null,
      stripeCustomerId: org.stripe_customer_id || null,
      stripeSubscriptionId: org.stripe_subscription_id || null
    };
  }

  /**
   * Check if organization has active access rights (Trial or Paid)
   * @param {string} organizationId 
   * @returns {Promise<{ allowed: boolean, code?: string, message?: string, subscription?: any }>}
   */
  async checkWorkspaceAccess(organizationId) {
    const sub = await this.getOrganizationSubscription(organizationId);
    if (!sub) {
      return {
        allowed: false,
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found.'
      };
    }

    if (!sub.canAccessApp) {
      return {
        allowed: false,
        code: sub.isExpired ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED',
        message: sub.isExpired
          ? 'Your 14-day free trial has expired. Please select a plan to continue accessing your workspace.'
          : 'An active subscription is required to access workspace data.',
        subscription: sub
      };
    }

    return {
      allowed: true,
      subscription: sub
    };
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

    if (updates.subscription_status !== undefined) {
      fields.push(`subscription_status = $${idx++}`);
      values.push(updates.subscription_status);
    }
    if (updates.payment_status !== undefined) {
      fields.push(`payment_status = $${idx++}`);
      values.push(updates.payment_status);
    }
    if (updates.plan !== undefined) {
      fields.push(`plan = $${idx++}`);
      values.push(updates.plan);
    }
    if (updates.stripe_customer_id !== undefined) {
      fields.push(`stripe_customer_id = $${idx++}`);
      values.push(updates.stripe_customer_id);
    }
    if (updates.stripe_subscription_id !== undefined) {
      fields.push(`stripe_subscription_id = $${idx++}`);
      values.push(updates.stripe_subscription_id);
    }
    if (updates.current_period_end !== undefined) {
      fields.push(`current_period_end = $${idx++}`);
      values.push(updates.current_period_end);
    }
    if (updates.trial_ends_at !== undefined) {
      fields.push(`trial_ends_at = $${idx++}`);
      values.push(updates.trial_ends_at);
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
    return res.rows[0] || null;
  }
}

module.exports = new SubscriptionService();
module.exports.SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES;
module.exports.PLANS = PLANS;
