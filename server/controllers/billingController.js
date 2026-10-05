const paymentService = require('../services/paymentService');
const subscriptionService = require('../services/subscriptionService');
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
   * Get current organization subscription & 14-day trial status
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

      const invoices = await paymentService.getInvoices(orgId);

      return res.status(200).json({
        success: true,
        subscription,
        invoices
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
   * POST /api/billing/create-checkout-session
   * Create Stripe checkout session
   */
  async createCheckoutSession(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { planId, billingCycle = 'monthly', successUrl, cancelUrl } = req.body;

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required (starter, growth, or enterprise).'
        });
      }

      const session = await paymentService.createCheckoutSession({
        organizationId: orgId,
        planId,
        billingCycle,
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
      await paymentService.cancelSubscription(orgId);

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'billing',
        resourceId: orgId,
        description: `Subscription cancelled by ${req.user.email}`,
        metadata: { cancelledBy: req.user.id },
        req
      }).catch(() => null);

      return res.status(200).json({
        success: true,
        message: 'Subscription has been cancelled. Workspace will remain accessible until the end of current period.'
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
  }
};

module.exports = billingController;
