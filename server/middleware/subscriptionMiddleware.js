const subscriptionService = require('../services/subscriptionService');

/**
 * Subscription & 14-Day Free Trial Verification Middleware
 * Guarantees that users cannot access protected workspace APIs if their 14-day trial has expired
 * without an active paid subscription.
 */
const requireActiveSubscription = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      },
      message: 'Authentication required.'
    });
  }

  const organizationId = req.user.organization_id;
  if (!organizationId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'NO_ORGANIZATION',
        message: 'No tenant organization associated with current session.'
      },
      message: 'No tenant organization associated with current session.'
    });
  }

  try {
    const access = await subscriptionService.checkWorkspaceAccess(organizationId);

    if (!access.allowed) {
      return res.status(402).json({
        success: false,
        error: {
          code: access.code,
          message: access.message
        },
        message: access.message,
        requiresSubscription: true,
        subscription: access.subscription,
        trialDetails: access.subscription
      });
    }

    // Attach verified subscription details to request for downstream handlers
    req.subscription = access.subscription;
    next();
  } catch (err) {
    console.error('[requireActiveSubscription] Exception:', err.message);
    next(err);
  }
};

module.exports = {
  requireActiveSubscription
};
