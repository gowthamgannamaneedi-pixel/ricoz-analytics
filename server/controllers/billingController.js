const paymentService = require('../services/paymentService');
const razorpayService = require('../services/razorpayService');
const subscriptionService = require('../services/subscriptionService');
const { PLANS, comparePlans, getPlan } = require('../config/plans');
const SubscriptionHistoryModel = require('../models/subscriptionHistoryModel');
const RazorpayOrderModel = require('../models/razorpayOrderModel');
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
   * GET /api/billing/razorpay-config
   * Public configuration for frontend Razorpay checkout modal
   */
  async getRazorpayConfig(req, res) {
    try {
      const config = razorpayService.getPublicConfig();
      return res.status(200).json({
        success: true,
        ...config
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve Razorpay configuration',
        error: err.message
      });
    }
  },

  /**
   * GET /api/billing/subscription
   * Get current organization subscription, entitlements, usage telemetry, invoice & order history
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

      const [invoices, history, orders] = await Promise.all([
        paymentService.getInvoices(orgId).catch(() => []),
        SubscriptionHistoryModel.findByOrganizationId(orgId, 10).catch(() => []),
        RazorpayOrderModel.listByOrganization(orgId, 10).catch(() => [])
      ]);

      return res.status(200).json({
        success: true,
        subscription,
        invoices,
        history,
        orders
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
   * POST /api/billing/create-order or /api/billing/create-razorpay-order
   * Create an authoritative server-validated Razorpay order
   */
  async createRazorpayOrder(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { planId, interval, billingCycle, customAmount } = req.body;
      const effectiveCycle = (billingCycle || interval || 'monthly').toLowerCase();

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID is required (starter, growth, or enterprise).'
        });
      }

      const orderData = await razorpayService.createOrder({
        organizationId: orgId,
        userId: req.user.id,
        userEmail: req.user.email,
        planId,
        billingInterval: effectiveCycle,
        customAmount: customAmount ? Number(customAmount) : null
      });

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'billing',
        resourceId: orderData.orderId,
        description: `Razorpay payment order created for ${planId} (${effectiveCycle})`,
        metadata: {
          orderId: orderData.orderId,
          planId,
          billingInterval: effectiveCycle,
          amountPaise: orderData.amount
        },
        req
      }).catch(() => null);

      return res.status(200).json({
        success: true,
        ...orderData
      });
    } catch (err) {
      console.error('[BillingController.createRazorpayOrder] Error:', err.message);
      const isClientError = err.message && (
        err.message.includes('Invalid plan') ||
        err.message.includes('downgrade') ||
        err.message.includes('already has an active subscription')
      );
      return res.status(isClientError ? 400 : 500).json({
        success: false,
        message: err.message || 'Failed to create payment order.'
      });
    }
  },

  /**
   * POST /api/billing/verify-payment
   * Cryptographically verify payment signature and activate subscription
   */
  async verifyRazorpayPayment(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { orderId, paymentId, signature } = req.body;

      if (!orderId || !paymentId || !signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing required payment verification parameters: orderId, paymentId, signature.'
        });
      }

      const result = await razorpayService.verifyPayment({
        organizationId: orgId,
        userId: req.user.id,
        orderId,
        paymentId,
        signature,
        req
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error('[BillingController.verifyRazorpayPayment] Error:', err.message);
      const isSignatureError = err.message && err.message.includes('signature');
      const isAuthError = err.message && err.message.includes('Unauthorized organization');
      const statusCode = isAuthError ? 403 : (isSignatureError ? 400 : 500);

      return res.status(statusCode).json({
        success: false,
        message: err.message || 'Payment verification failed.'
      });
    }
  },

  /**
   * POST /api/billing/schedule-downgrade
   * Schedule plan downgrade at current period end
   */
  async scheduleDowngrade(req, res) {
    try {
      const orgId = req.user?.organization_id;
      const { planId } = req.body || {};

      if (!orgId) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      if (!planId || typeof planId !== 'string' || !planId.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Target planId is required (starter, growth, or enterprise).'
        });
      }

      const targetPlanNormalized = planId.trim().toLowerCase();
      if (!PLANS[targetPlanNormalized]) {
        return res.status(400).json({
          success: false,
          message: `Invalid plan "${planId}". Valid plans are: ${Object.keys(PLANS).join(', ')}.`
        });
      }

      const currentSub = await subscriptionService.getOrganizationSubscription(orgId);
      if (!currentSub) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      const comparison = comparePlans(targetPlanNormalized, currentSub.plan);

      if (comparison >= 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot schedule downgrade to "${planId}". Target plan must be a lower tier than current "${currentSub.plan}" plan. Use checkout to upgrade.`
        });
      }

      const result = await subscriptionService.scheduleDowngrade(orgId, targetPlanNormalized);

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'billing',
        resourceId: orgId,
        description: result.alreadyScheduled
          ? `Downgrade to ${targetPlanNormalized} verified (already scheduled)`
          : `Downgrade to ${targetPlanNormalized} scheduled for ${result.effectiveDate}`,
        metadata: { targetPlan: targetPlanNormalized, effectiveDate: result.effectiveDate, isDuplicate: Boolean(result.alreadyScheduled) },
        req
      }).catch(() => null);

      const freshSub = await subscriptionService.getOrganizationSubscription(orgId);

      const message = result.alreadyScheduled
        ? `Downgrade to ${result.targetPlan.toUpperCase()} is already scheduled for ${new Date(result.effectiveDate).toLocaleDateString()}. Your current features remain active until then.`
        : `Downgrade to ${result.targetPlan.toUpperCase()} successfully scheduled. Your current plan features remain active until ${new Date(result.effectiveDate).toLocaleDateString()}.`;

      return res.status(200).json({
        success: true,
        message,
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
   * POST /api/billing/cancel-downgrade
   * Cancel a pending scheduled downgrade before it takes effect
   */
  async cancelScheduledDowngrade(req, res) {
    try {
      const orgId = req.user?.organization_id;

      if (!orgId) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      const currentSub = await subscriptionService.getOrganizationSubscription(orgId);
      if (!currentSub) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      if (!currentSub.scheduledDowngradePlan) {
        return res.status(200).json({
          success: true,
          message: 'No downgrade is currently scheduled for this organization.',
          subscription: currentSub,
          cancelled: true,
          alreadyCancelled: true
        });
      }

      const result = await subscriptionService.cancelScheduledDowngrade(orgId);

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'billing',
        resourceId: orgId,
        description: `Cancelled scheduled downgrade to ${result.cancelledTargetPlan}`,
        metadata: { cancelledPlan: result.cancelledTargetPlan },
        req
      }).catch(() => null);

      const freshSub = await subscriptionService.getOrganizationSubscription(orgId);

      return res.status(200).json({
        success: true,
        message: `Scheduled downgrade to ${result.cancelledTargetPlan ? result.cancelledTargetPlan.toUpperCase() : 'lower plan'} has been successfully cancelled. You will remain on the ${freshSub.plan.toUpperCase()} plan.`,
        subscription: freshSub,
        ...result
      });
    } catch (err) {
      console.error('[BillingController.cancelScheduledDowngrade] Error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to cancel scheduled downgrade.'
      });
    }
  },

  /**
   * POST /api/billing/razorpay-webhook
   * Dedicated secure Razorpay webhook endpoint
   */
  async handleRazorpayWebhook(req, res) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const eventId = req.headers['x-razorpay-event-id'];
      const rawPayload = req.rawBody || req.body;

      if (!signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing x-razorpay-signature header'
        });
      }

      const result = await razorpayService.handleWebhook(rawPayload, signature, eventId);
      return res.status(200).json({
        status: 'ok',
        received: true,
        ...result
      });
    } catch (err) {
      console.error('[BillingController.handleRazorpayWebhook] Error:', err.message);
      return res.status(400).json({
        success: false,
        message: err.message || 'Webhook verification failed'
      });
    }
  },

  /**
   * POST /api/billing/webhook
   * Universal Webhook Router: automatically routes between Razorpay and Stripe signatures
   */
  async handleWebhook(req, res) {
    try {
      // Check for Razorpay signature first
      if (req.headers['x-razorpay-signature']) {
        return billingController.handleRazorpayWebhook(req, res);
      }

      // Check for Stripe signature
      const stripeSig = req.headers['stripe-signature'] || req.headers['x-webhook-signature'];
      const payload = req.rawBody || req.body;

      const result = await paymentService.handleWebhook(payload, stripeSig);
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
