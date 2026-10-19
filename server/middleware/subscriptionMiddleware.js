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

  let organizationId = req.user.organization_id;
  if (!organizationId) {
    try {
      const db = require('../config/database');
      const defaultOrgRes = await db.query('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1');
      if (defaultOrgRes.rows[0]) {
        organizationId = defaultOrgRes.rows[0].id;
        req.user.organization_id = organizationId;
      }
    } catch (_) {}
  }

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

/**
 * Plan Feature Entitlement Middleware
 * Enforces tier restrictions (e.g. Starter cannot access Executive Insights or Anomaly Alerts;
 * Growth cannot access Custom AI Query Planner; Enterprise can access all features).
 * Returns HTTP 403 with upgrade guidance.
 * 
 * @param {'insights'|'alerts'|'aiQueryPlanner'|'reports'|'automatedReports'} featureKey 
 */
const requirePlanFeature = (featureKey) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        message: 'Authentication required.'
      });
    }

    const organizationId = req.user.organization_id;
    if (!organizationId) {
      return res.status(403).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'No tenant organization associated with current session.' },
        message: 'No tenant organization associated with current session.'
      });
    }

    try {
      const check = await subscriptionService.checkFeatureEntitlement(organizationId, featureKey);

      if (!check.allowed) {
        const isUpgradeRequired = check.code === 'PLAN_UPGRADE_REQUIRED';
        const statusCode = isUpgradeRequired ? 403 : 402;

        return res.status(statusCode).json({
          success: false,
          error: {
            code: check.code,
            message: check.message
          },
          message: check.message,
          requiresUpgrade: isUpgradeRequired,
          requiresSubscription: check.code === 'SUBSCRIPTION_REQUIRED' || check.code === 'TRIAL_EXPIRED',
          upgradeGuidance: check.upgradeGuidance || null,
          subscription: check.subscription || null
        });
      }

      req.subscription = check.subscription;
      next();
    } catch (err) {
      console.error(`[requirePlanFeature(${featureKey})] Exception:`, err.message);
      next(err);
    }
  };
};

/**
 * Resource Usage Limit Middleware
 * Enforces server-side dataset and team-member limits.
 * If organization is already at or above limit, returns HTTP 403 with upgrade guidance.
 * 
 * @param {'datasets'|'users'} resourceType 
 */
const requireUsageLimit = (resourceType) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        message: 'Authentication required.'
      });
    }

    const organizationId = req.user.organization_id;
    if (!organizationId) {
      return res.status(403).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'No tenant organization associated with current session.' },
        message: 'No tenant organization associated with current session.'
      });
    }

    try {
      const check = await subscriptionService.checkUsageLimit(organizationId, resourceType);

      if (!check.allowed) {
        return res.status(403).json({
          success: false,
          error: {
            code: check.code,
            message: check.message
          },
          message: check.message,
          requiresUpgrade: true,
          limit: check.limit,
          currentCount: check.currentCount,
          upgradeGuidance: check.upgradeGuidance,
          subscription: check.subscription
        });
      }

      req.subscription = check.subscription;
      next();
    } catch (err) {
      console.error(`[requireUsageLimit(${resourceType})] Exception:`, err.message);
      next(err);
    }
  };
};

module.exports = {
  requireActiveSubscription,
  requirePlanFeature,
  requireUsageLimit
};
