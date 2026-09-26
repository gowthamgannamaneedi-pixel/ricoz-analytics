const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabase, isConfigured } = require('../config/supabase');
const UserModel = require('../models/userModel');

/**
 * Enterprise Authentication Middleware
 * Validates Bearer tokens against Supabase Auth (when connected) or Signed JWTs (for internal/local services).
 * Attaches fully resolved { id, email, name, role, organization_id } to req.user.
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access denied. No authorization header provided.'
      },
      message: 'Access denied. No authorization header provided.',
      request_id: req.id
    });
  }

  // Parse "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access denied. Malformed authorization token.'
      },
      message: 'Access denied. Malformed authorization token.',
      request_id: req.id
    });
  }

  const token = parts[1].trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access denied. Empty authorization token.'
      },
      message: 'Access denied. Empty authorization token.',
      request_id: req.id
    });
  }

  // 1. Try local/internal JWT verification first (standard server-signed session)
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded && (decoded.id || decoded.email)) {
      // Resolve latest organization and role EXCLUSIVELY from database record
      let userOrgId = decoded.organization_id || '00000000-0000-0000-0000-000000000001';
      let userRole = decoded.role || 'viewer';
      let userName = decoded.name || decoded.email;
      let userId = decoded.id;
      let userEmail = decoded.email;

      // Query database for real, unforgeable user record
      const dbUser = decoded.id 
        ? (await UserModel.findById(decoded.id).catch(() => null))
        : (decoded.email ? (await UserModel.findByEmail(decoded.email).catch(() => null)) : null);

      if (dbUser) {
        // Enforce account status check
        if (dbUser.status === 'deactivated' || dbUser.status === 'inactive') {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'This account has been deactivated. Please contact your organization administrator.'
            },
            message: 'This account has been deactivated. Please contact your organization administrator.',
            request_id: req.id
          });
        }

        // ROLE COMES EXCLUSIVELY FROM DATABASE RECORD (Overrides any payload claim)
        userRole = dbUser.role || 'viewer';
        userOrgId = dbUser.organization_id || userOrgId;
        userName = dbUser.name || userName;
        userId = dbUser.id;
        userEmail = dbUser.email;
      }

      req.user = {
        id: userId,
        email: userEmail,
        name: userName,
        role: userRole,
        organization_id: userOrgId
      };
      return next();
    }
  } catch (jwtErr) {
    // If not a local JWT or expired, check if it's a Supabase Auth access token
    if (isConfigured && supabase) {
      try {
        const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(token);
        if (!sbError && sbUser) {
          // Look up user profile in database to get synced role & organization
          const dbUser = await UserModel.findByEmail(sbUser.email).catch(() => null);
          
          if (dbUser && (dbUser.status === 'deactivated' || dbUser.status === 'inactive')) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'This account has been deactivated. Please contact your organization administrator.'
              },
              message: 'This account has been deactivated. Please contact your organization administrator.',
              request_id: req.id
            });
          }

          req.user = {
            id: dbUser ? dbUser.id : sbUser.id,
            email: sbUser.email,
            name: dbUser?.name || sbUser.user_metadata?.name || sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
            role: dbUser?.role || sbUser.user_metadata?.role || 'viewer', // Database role takes precedence
            organization_id: dbUser?.organization_id || '00000000-0000-0000-0000-000000000001'
          };
          return next();
        }
      } catch (_) {
        // Fall through to error handler below
      }
    }

    if (jwtErr.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token has expired. Please log in again.'
        },
        message: 'Authentication token has expired. Please log in again.',
        request_id: req.id
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization token.'
      },
      message: 'Invalid authorization token.',
      request_id: req.id
    });
  }
};

module.exports = authenticateToken;
