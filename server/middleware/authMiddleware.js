const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabase, isConfigured } = require('../config/supabase');
const UserModel = require('../models/userModel');
const tenantService = require('../services/tenantService');
const tokenBlacklist = require('../utils/tokenBlacklist');

// In-flight single-flight request coalescing and short micro-cache (10s TTL)
const inflightUserLookups = new Map();
const userAuthCache = new Map();
const USER_CACHE_TTL_MS = 10 * 1000;

function clearUserAuthCache(key) {
  if (key) {
    userAuthCache.delete(String(key).toLowerCase());
  } else {
    userAuthCache.clear();
  }
}

function primeUserAuthCache(user) {
  if (user) {
    const entry = { user, cachedAt: Date.now() };
    if (user.id) userAuthCache.set(String(user.id).toLowerCase(), entry);
    if (user.email) userAuthCache.set(user.email.toLowerCase(), entry);
  }
}

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

  // Check token revocation blacklist (post-logout protection)
  if (tokenBlacklist.isRevoked(token)) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session has been revoked or logged out. Please sign in again.'
      },
      message: 'Session has been revoked or logged out. Please sign in again.',
      request_id: req.id
    });
  }

  req.token = token;
  const authStart = Date.now();

  // 1. Try local/internal JWT verification first (standard server-signed session)
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded && (decoded.id || decoded.email)) {
      // Check user revocation blacklist immediately
      const tokenUserId = decoded.id || decoded.userId;
      if (tokenUserId && tokenBlacklist.isUserRevoked(tokenUserId)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'This account has been deactivated or removed from the workspace. Access revoked.'
          },
          message: 'This account has been deactivated or removed from the workspace. Access revoked.',
          request_id: req.id
        });
      }

      // Query database for real, unforgeable user record with single-flight coalescing & micro-caching
      const cacheKey = (decoded.email || decoded.id || '').toLowerCase();
      const cached = userAuthCache.get(cacheKey);
      let dbUser = null;

      if (cached && (Date.now() - cached.cachedAt < USER_CACHE_TTL_MS)) {
        dbUser = cached.user;
      } else if (inflightUserLookups.has(cacheKey)) {
        dbUser = await inflightUserLookups.get(cacheKey);
      } else {
        const lookupPromise = (async () => {
          let u = decoded.email ? await UserModel.findByEmail(decoded.email).catch(() => null) : null;
          if (!u && decoded.id) {
            u = await UserModel.findById(decoded.id).catch(() => null);
          }
          if (u) {
            const entry = { user: u, cachedAt: Date.now() };
            userAuthCache.set(cacheKey, entry);
            if (u.id) userAuthCache.set(String(u.id).toLowerCase(), entry);
            if (u.email) userAuthCache.set(u.email.toLowerCase(), entry);
          }
          return u;
        })();

        inflightUserLookups.set(cacheKey, lookupPromise);
        try {
          dbUser = await lookupPromise;
        } finally {
          inflightUserLookups.delete(cacheKey);
        }
      }

      let userId = decoded.id || decoded.userId;
      let userEmail = decoded.email;
      let userName = decoded.name || decoded.email;
      let userRole = decoded.role || 'viewer';
      let userOrgId = decoded.organization_id || null;

      if (dbUser) {
        // Check user revocation blacklist against dbUser ID as well
        if (tokenBlacklist.isUserRevoked(dbUser.id)) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'This account has been deactivated or removed from the workspace. Access revoked.'
            },
            message: 'This account has been deactivated or removed from the workspace. Access revoked.',
            request_id: req.id
          });
        }

        // Enforce account status check
        if (dbUser.status === 'pending_verification') {
          return res.status(403).json({
            success: false,
            error: {
              code: 'EMAIL_NOT_VERIFIED',
              message: 'Email verification required. Please verify your email before accessing the workspace.'
            },
            message: 'Email verification required. Please verify your email before accessing the workspace.',
            requiresVerification: true,
            email: dbUser.email,
            request_id: req.id
          });
        }

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

        // ROLE AND TENANT COME EXCLUSIVELY FROM DATABASE RECORD (Strict isolation: never forgeable, never auto-assigned to existing tenants)
        userRole = dbUser.role || 'viewer';
        userOrgId = dbUser.organization_id || null;
        userName = dbUser.name || dbUser.email;
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

      // Resolve and verify authoritative active organization context (including explicit X-Organization-Id selection or memberships)
      const tenantRes = await tenantService.resolveAndAuthorizeOrganization(req, req.user);
      if (tenantRes.code === 'FORBIDDEN_ORGANIZATION') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_ORGANIZATION',
            message: tenantRes.error
          },
          message: tenantRes.error,
          request_id: req.id
        });
      }

      if (tenantRes.organizationId) {
        req.user.organization_id = tenantRes.organizationId;
        req.user.role = tenantRes.role || userRole;
        req.organization = tenantRes.organization;
      }

      const authDur = Date.now() - authStart;
      try {
        res.setHeader('Server-Timing', `auth;dur=${authDur}`);
      } catch (_) {}

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
          
          if (dbUser && dbUser.status === 'pending_verification') {
            return res.status(403).json({
              success: false,
              error: {
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Email verification required. Please verify your email before accessing the workspace.'
              },
              message: 'Email verification required. Please verify your email before accessing the workspace.',
              requiresVerification: true,
              email: dbUser.email,
              request_id: req.id
            });
          }

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
            organization_id: dbUser?.organization_id || null
          };

          const sbTenantRes = await tenantService.resolveAndAuthorizeOrganization(req, req.user);
          if (sbTenantRes.code === 'FORBIDDEN_ORGANIZATION') {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN_ORGANIZATION',
                message: sbTenantRes.error
              },
              message: sbTenantRes.error,
              request_id: req.id
            });
          }

          if (sbTenantRes.organizationId) {
            req.user.organization_id = sbTenantRes.organizationId;
            req.user.role = sbTenantRes.role || req.user.role;
            req.organization = sbTenantRes.organization;
          }

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

authenticateToken.clearUserAuthCache = clearUserAuthCache;
authenticateToken.primeUserAuthCache = primeUserAuthCache;

module.exports = authenticateToken;
