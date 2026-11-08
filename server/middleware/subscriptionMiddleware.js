const subscriptionService = require('../services/subscriptionService');
const tenantService = require('../services/tenantService');

/**
 * Authoritatively resolve and verify tenant organization for subscription middleware
 */
async function resolveOrganizationForRequest(req) {
  if (req.user?.organization_id && req.organization) {
    return req.user.organization_id;
  }
  const tenantRes = await tenantService.resolveAndAuthorizeOrganization(req, req.user);
  if (tenantRes.organizationId) {
    req.user.organization_id = tenantRes.organizationId;
    req.user.role = tenantRes.role || req.user.role;
    req.organization = tenantRes.organization;
    return tenantRes.organizationId;
  }
  return req.user?.organization_id || null;
}

/**
 * Subscription & Free Trial Verification Middleware
 * Guarantees that users cannot perform mutations, file uploads, AI execution, or add members
 * if their trial or paid subscription has expired.
 * Admin and Manager roles CANNOT bypass this check.
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

  const organizationId = await resolveOrganizationForRequest(req);

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
    const access = await subscriptionService.checkWriteAccess(organizationId);

    if (!access.allowed) {
      const statusCode = access.code === 'ACCOUNT_SUSPENDED' ? 403 : 402;
      return res.status(statusCode).json({
        success: false,
        code: access.code || 'SUBSCRIPTION_EXPIRED',
        error: {
          code: access.code || 'SUBSCRIPTION_EXPIRED',
          message: access.message
        },
        message: access.message,
        requiresSubscription: statusCode === 402,
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
 * Mutations additionally require an active subscription.
 * Returns HTTP 403 with upgrade guidance for tier limits; HTTP 402 for expired subscriptions.
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

    const organizationId = await resolveOrganizationForRequest(req);
    if (!organizationId) {
      return res.status(403).json({
        success: false,
        error: { code: 'NO_ORGANIZATION', message: 'No tenant organization associated with current session.' },
        message: 'No tenant organization associated with current session.'
      });
    }

    try {
      // 1. If this is a mutation request (POST, PUT, DELETE, PATCH), verify active subscription first
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const writeCheck = await subscriptionService.checkWriteAccess(organizationId);
        if (!writeCheck.allowed) {
          const statusCode = writeCheck.code === 'ACCOUNT_SUSPENDED' ? 403 : 402;
          return res.status(statusCode).json({
            success: false,
            code: writeCheck.code || 'SUBSCRIPTION_EXPIRED',
            error: {
              code: writeCheck.code || 'SUBSCRIPTION_EXPIRED',
              message: writeCheck.message
            },
            message: writeCheck.message,
            requiresSubscription: statusCode === 402,
            subscription: writeCheck.subscription
          });
        }
      }

      // 2. Verify tier entitlement for this feature
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

    const organizationId = await resolveOrganizationForRequest(req);
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
        const isExpired = check.code === 'TRIAL_EXPIRED' || check.code === 'SUBSCRIPTION_EXPIRED';
        const statusCode = isExpired ? 402 : 403;
        return res.status(statusCode).json({
          success: false,
          code: check.code,
          error: {
            code: check.code,
            message: check.message
          },
          message: check.message,
          requiresUpgrade: !isExpired,
          requiresSubscription: isExpired,
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
