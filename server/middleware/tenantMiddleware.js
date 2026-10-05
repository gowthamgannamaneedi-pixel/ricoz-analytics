/**
 * Strict Multi-Tenant Isolation Middleware
 * Enforces authenticated_user.organization_id === resource.organization_id
 */
const requireTenantOwnership = (findResourceFn, idParam = 'id') => {
  return async (req, res, next) => {
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication with valid organization required.' },
        message: 'Authentication with valid organization required.'
      });
    }

    const resourceId = req.params[idParam];
    if (!resourceId) return next();

    try {
      const resource = await findResourceFn(resourceId, req.user.organization_id);
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Resource not found or access denied.' },
          message: 'Resource not found or access denied.'
        });
      }

      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  requireTenantOwnership
};
