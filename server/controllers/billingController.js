const paymentService = require('../services/paymentService');
const subscriptionService = require('../services/subscriptionService');
const { PLANS, comparePlans, getPlan } = require('../config/plans');
const SubscriptionHistoryModel = require('../models/subscriptionHistoryModel');
const db = require('../config/database');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');

/**
 * Enterprise Billing & Subscription Controller
 */
const billingController = {
  /**
   * GET /api/billing/plans
   * List all available platform plans
   */
  async getPlans(req, res) {
    try {
      const plans = paymentService.getPlans();
      return res.status(200).json({
        success: true,
        plans
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve plans',
        error: err.message
      });
    }
  },

  /**
   * GET /api/billing/subscription
   * Get current organization subscription, entitlements, usage telemetry & invoice history
   */
  async getSubscription(req, res) {
    try {
      const orgId = req.user.organization_id;
      const subscription = await subscriptionService.getOrganizationSubscription(orgId);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Organization subscription record not found'
        });
      }

      const [invoices, history] = await Promise.all([
        paymentService.getInvoices(orgId).catch(() => []),
        SubscriptionHistoryModel.findByOrganizationId(orgId, 10).catch(() => [])
      ]);

      return res.status(200).json({
        success: true,
        subscription,
        invoices,
        history
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve subscription status',
        error: err.message
      });
    }
  },

  /**
   * GET /api/billing/history
   * Retrieve full subscription event audit history
   */
  async getSubscriptionHistory(req, res) {
    try {
      const orgId = req.user.organization_id;
      const history = await SubscriptionHistoryModel.findByOrganizationId(orgId, 50);
      return res.status(200).json({
        success: true,
        history
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve subscription history',
        error: err.message
      });
    }
  },

  /**
   * POST /api/billing/create-checkout-session
   * Create Stripe checkout session
   */
  async createCheckoutSession(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { planId, interval, billingCycle, successUrl, cancelUrl } = req.body;
      const rawCycle = (billingCycle || interval || 'monthly').toLowerCase();
      const effectiveCycle = rawCycle === 'yearly' || rawCycle === 'annual' ? 'yearly' : 'monthly';

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required (starter, growth, or enterprise).'
        });
      }

      const session = await paymentService.createCheckoutSession({
        organizationId: orgId,
        planId,
        billingCycle: effectiveCycle,
        successUrl,
        cancelUrl,
        userEmail: req.user.email
      });

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'billing',
        resourceId: session.sessionId,
        description: `Checkout session initiated for ${planId} plan (${billingCycle})`,
        metadata: { planId, billingCycle, sessionId: session.sessionId },
        req
      }).catch(() => null);

      return res.status(200).json({
        success: true,
        ...session
      });
    } catch (err) {
      console.error('[BillingController.createCheckoutSession] Error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to create payment checkout session.'
      });
    }
  },

  /**
   * POST /api/billing/schedule-downgrade
   * Schedule plan downgrade at current period end
   */
  async scheduleDowngrade(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Target planId is required (starter, growth, or enterprise).'
        });
      }

      const currentSub = await subscriptionService.getOrganizationSubscription(orgId);
      if (!currentSub) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      const comparison = PLANS[planId.toLowerCase()]
        ? comparePlans(planId, currentSub.plan)
        : -1;

      if (comparison >= 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot schedule downgrade to "${planId}". Target plan must be a lower tier than current "${currentSub.plan}" plan. Use checkout to upgrade.`
        });
      }

      const result = await subscriptionService.scheduleDowngrade(orgId, planId);

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'billing',
        resourceId: orgId,
        description: `Downgrade to ${planId} scheduled for ${result.effectiveDate}`,
        metadata: { targetPlan: planId, effectiveDate: result.effectiveDate },
        req
      }).catch(() => null);

      const freshSub = await subscriptionService.getOrganizationSubscription(orgId);

      return res.status(200).json({
        success: true,
        message: `Downgrade to ${result.targetPlan} successfully scheduled. Your current plan features remain active until ${new Date(result.effectiveDate).toLocaleDateString()}.`,
        subscription: freshSub,
        ...result
      });
    } catch (err) {
      console.error('[BillingController.scheduleDowngrade] Error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to schedule plan downgrade.'
      });
    }
  },

  /**
   * POST /api/billing/webhook
   * Process incoming Stripe webhooks with cryptographic signature verification
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['stripe-signature'] || req.headers['x-webhook-signature'];
      const payload = req.rawBody || req.body;

      const result = await paymentService.handleWebhook(payload, signature);

      return res.status(200).json({
        received: true,
        result
      });
    } catch (err) {
      console.error('[BillingController.handleWebhook] Error:', err.message);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  },

  /**
   * POST /api/billing/cancel-subscription
   */
  async cancelSubscription(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { immediate = false } = req.body || {};
      const updated = await paymentService.cancelSubscription(orgId, { immediate });

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'billing',
        resourceId: orgId,
        description: `Subscription cancelled by ${req.user.email} (immediate: ${immediate})`,
        metadata: { cancelledBy: req.user.id, immediate },
        req
      }).catch(() => null);

      return res.status(200).json({
        success: true,
        message: immediate
          ? 'Subscription has been cancelled immediately.'
          : 'Subscription has been cancelled. Workspace will remain accessible until the end of current period.',
        subscription: updated
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel subscription',
        error: err.message
      });
    }
  },

  /**
   * POST /api/billing/check-reminders
   * Trigger subscription expiry reminders check on-demand
   */
  async triggerReminderCheck(req, res) {
    try {
      const summary = await subscriptionService.checkAndSendExpiryReminders();
      return res.status(200).json({
        success: true,
        message: 'Expiry reminders evaluated successfully',
        summary
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to run expiry reminder evaluation',
        error: err.message
      });
    }
  },

  /**
   * DEV ONLY: Simulate trial expiration for integration tests
   */
  devSimulateTrialExpiry: async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Simulation disabled in production' });
    }
    try {
      const orgId = req.user.organization_id;
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      await db.query(
        `UPDATE organizations SET trial_ends_at = $1, subscription_status = 'trial_expired' WHERE id = $2`,
        [pastDate, orgId]
      );
      return res.status(200).json({ success: true, message: 'Trial simulated as expired' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * DEV ONLY: Simulate subscription dates for testing 10-day reminders & transitions
   */
  devSimulateDates: async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Simulation disabled in production' });
    }
    try {
      const orgId = req.user.organization_id;
      const { trialEndsAt, currentPeriodEnd, subscriptionStatus, plan } = req.body;
      const updates = {};
      if (trialEndsAt !== undefined) updates.trial_ends_at = trialEndsAt;
      if (currentPeriodEnd !== undefined) updates.current_period_end = currentPeriodEnd;
      if (subscriptionStatus !== undefined) updates.subscription_status = subscriptionStatus;
      if (plan !== undefined) updates.plan = plan;

      const updated = await subscriptionService.updateSubscription(orgId, updates);
      return res.status(200).json({ success: true, message: 'Dates updated for testing', organization: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

module.exports = billingController;
