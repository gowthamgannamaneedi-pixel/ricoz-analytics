const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabase, isConfigured } = require('../config/supabase');
const UserModel = require('../models/userModel');
const OrganizationModel = require('../models/organizationModel');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');

/**
 * Helper to generate signed JWT token containing multi-tenant user claims
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'viewer',
      organization_id: user.organization_id || '00000000-0000-0000-0000-000000000001'
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

/**
 * Basic email validator
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/auth/register
 * Register a new user account with default 'viewer' role and multi-tenant organization linking
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, organization_name } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required.'
      });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // 2. Check for duplicate email in database
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // 3. Resolve or create user's organization
    let organizationId = '00000000-0000-0000-0000-000000000001';
    if (organization_name && organization_name.trim()) {
      const org = await OrganizationModel.create({
        name: organization_name.trim(),
        plan: 'starter'
      }).catch(() => null);
      if (org && org.id) organizationId = org.id;
    } else {
      const defaultOrg = await OrganizationModel.ensureDefaultOrganization().catch(() => null);
      if (defaultOrg && defaultOrg.id) organizationId = defaultOrg.id;
    }

    // 4. Hash password securely
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Enforce strict default role to prevent privilege escalation on public registration
    // Roles can only be upgraded by administrators
    const defaultRole = 'viewer';

    // 6. If Supabase Auth is configured, attempt Supabase Auth signup
    let supabaseUserId = null;
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              name: name.trim(),
              role: defaultRole,
              organization_id: organizationId
            }
          }
        });
        if (!error && data?.user?.id) {
          supabaseUserId = data.user.id;
        }
      } catch (_) {
        // Continue to local database insert
      }
    }

    // 7. Insert user record in public.users
    const newUser = await UserModel.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role: defaultRole,
      organization_id: organizationId
    });

    // Safe Audit Log
    await logAuditEvent({
      organizationId,
      userId: newUser.id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      resourceType: 'auth',
      resourceId: newUser.id,
      description: `New user registered: ${newUser.email} (${newUser.name}) with role "${defaultRole}"`,
      metadata: { email: newUser.email, role: defaultRole },
      req
    });

    // 8. Generate authentication token
    const token = generateToken(newUser);

    // 9. Return safe payload (without password_hash)
    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        organization_id: newUser.organization_id,
        created_at: newUser.created_at
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user with credentials and return signed session token
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    // 1. Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      // If not in database, attempt Supabase Auth signIn if configured
      if (isConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password }).catch(() => ({ error: true }));
        if (!error && data?.session?.access_token) {
          return res.status(200).json({
            success: true,
            message: 'Logged in successfully via Supabase.',
            token: data.session.access_token,
            user: {
              id: data.user.id,
              name: data.user.user_metadata?.name || email.split('@')[0],
              email: data.user.email,
              role: data.user.user_metadata?.role || 'viewer',
              organization_id: data.user.user_metadata?.organization_id || '00000000-0000-0000-0000-000000000001'
            }
          });
        }
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check account status
    if (user.status === 'deactivated' || user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact your organization administrator.'
      });
    }

    // 2. Verify password with bcrypt (supports both primary hash and alternate test hash)
    let isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch && user.password_hash_alt) {
      isMatch = await bcrypt.compare(password, user.password_hash_alt);
    }
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.'
        },
        message: 'Invalid email or password.'
      });
    }

    // Update last login timestamp
    await UserModel.updateLastLogin(user.id).catch(() => null);

    // Safe Audit Log
    await logAuditEvent({
      organizationId: user.organization_id || '00000000-0000-0000-0000-000000000001',
      userId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      resourceType: 'auth',
      resourceId: user.id,
      description: `User ${user.email} successfully logged into enterprise workspace`,
      metadata: { role: user.role, email: user.email },
      req
    });

    // 3. Generate signed session token with verified database role
    const token = generateToken(user);

    // Load organization name if available
    const org = await OrganizationModel.findById(user.organization_id || '00000000-0000-0000-0000-000000000001').catch(() => null);

    // 4. Return safe payload (strictly sanitized, never exposing password or secret keys)
    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // REAL role from database record
        organization_id: user.organization_id || '00000000-0000-0000-0000-000000000001',
        organization_name: org?.name || 'Ricoz Primary Organization',
        created_at: user.created_at
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Return profile and organization information for currently authenticated user
 */
const getMe = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id) || await UserModel.findByEmail(req.user.email);
    if (!user && !req.user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    const orgId = user?.organization_id || req.user.organization_id || '00000000-0000-0000-0000-000000000001';
    let organization = null;
    if (orgId) {
      organization = await OrganizationModel.findById(orgId).catch(() => null);
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user?.id || req.user.id,
        name: user?.name || req.user.name,
        email: user?.email || req.user.email,
        role: user?.role || req.user.role || 'viewer',
        organization_id: orgId,
        organization_name: organization?.name || 'Ricoz Primary Organization',
        avatar_url: user?.avatar_url || null,
        created_at: user?.created_at || new Date()
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Terminate user session
 */
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await logAuditEvent({
        organizationId: req.user.organization_id || '00000000-0000-0000-0000-000000000001',
        userId: req.user.id,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        resourceType: 'auth',
        resourceId: req.user.id,
        description: `User ${req.user.email} logged out from session`,
        metadata: { role: req.user.role },
        req
      });
    }

    if (isConfigured && supabase) {
      await supabase.auth.signOut().catch(() => null);
    }
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout
};
