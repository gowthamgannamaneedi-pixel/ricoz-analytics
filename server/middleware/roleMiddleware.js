const { hasPermission } = require('../utils/permissions');

/**
 * Role-Based Access Control (RBAC) & Multi-Tenancy Middleware
 */

/**
 * Role Authorization Middleware Helper
 * Checks if the authenticated user has one of the allowed roles.
 * Admins are granted universal access across organizational endpoints.
 * @param  {...string} allowedRoles 
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = req.user.role || 'viewer';

    // Admins automatically inherit access to all protected operations
    if (userRole === 'admin' || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden: Action requires one of [${allowedRoles.join(', ')}] role. Current role is "${userRole}".`,
      requiredRoles: allowedRoles,
      currentRole: userRole
    });
  };
};

/**
 * Permission-Based Authorization Middleware Helper
 * Checks if the authenticated user possesses the specific permission capability.
 * @param {string} permissionKey 
 */
const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = req.user.role || 'viewer';

    if (hasPermission(userRole, permissionKey)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden: User role "${userRole}" lacks the required permission "${permissionKey}".`,
      requiredPermission: permissionKey,
      currentRole: userRole
    });
  };
};

/**
 * Multi-Tenancy Organization Isolation Middleware
 * Prevents requests from accessing or modifying resources belonging to another organization.
 */
const requireOrgAccess = (paramKey = 'organization_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const targetOrgId = req.params[paramKey] || req.body[paramKey] || req.query[paramKey];
    if (targetOrgId && req.user.organization_id && String(targetOrgId) !== String(req.user.organization_id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Access to another organization\'s resources is strictly denied.',
        code: 'ORG_ISOLATION_VIOLATION'
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  requirePermission,
  checkPermission: requirePermission,
  requireOrgAccess
};
