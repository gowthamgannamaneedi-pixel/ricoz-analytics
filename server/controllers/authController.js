const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabase, isConfigured } = require('../config/supabase');
const UserModel = require('../models/userModel');
const OrganizationModel = require('../models/organizationModel');
const InvitationModel = require('../models/invitationModel');
const subscriptionService = require('../services/subscriptionService');
const emailService = require('../services/emailService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');
const tokenBlacklist = require('../utils/tokenBlacklist');

// In-memory rate limiting map for verification resends: email -> lastSentTimestamp
const resendRateLimits = new Map();

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
      organization_id: user.organization_id,
      jti: crypto.randomUUID()
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

/**
 * Resolve client frontend base URL dynamically from environment or request headers
 */
function resolveFrontendUrl(req) {
  const envUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }
  const origin = req?.headers?.origin;
  if (origin && typeof origin === 'string' && origin.startsWith('http') && !origin.includes('localhost:5000')) {
    return origin.replace(/\/+$/, '');
  }
  const referer = req?.headers?.referer;
  if (referer && typeof referer === 'string' && referer.startsWith('http')) {
    try {
      const u = new URL(referer);
      if (!u.host.includes('localhost:5000')) {
        return `${u.protocol}//${u.host}`;
      }
    } catch (_) {}
  }
  return config.clientUrl || 'http://localhost:5173';
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
 * Register a new SaaS account.
 * Automatically creates a NEW tenant organization with a 14-day free trial.
 * The registering user is designated as 'admin' of their organization.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, organization_name, organizationName } = req.body;
    const orgName = (organization_name || organizationName || '').trim();

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

    if (!orgName) {
      return res.status(400).json({
        success: false,
        message: 'Organization or company name is required to create your workspace.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Check for duplicate email in database
    const existingUser = await UserModel.findByEmail(cleanEmail);
    if (existingUser) {
      if (existingUser.status === 'active') {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_VERIFIED',
          isVerified: true,
          message: 'An account with this email address already exists and is active. Please log in or reset your password.'
        });
      }

      // Existing user is UNVERIFIED (status === 'pending_verification')
      // Safely resend fresh verification code without creating duplicate organizations or modifying password
      const lastSent = resendRateLimits.get(cleanEmail);
      const now = Date.now();
      if (lastSent && now - lastSent < 60000) {
        const waitSeconds = Math.ceil((60000 - (now - lastSent)) / 1000);
        return res.status(200).json({
          success: true,
          requiresVerification: true,
          isExistingUnverified: true,
          inCooldown: true,
          retryAfter: waitSeconds,
          message: `An account with this email address already exists and is pending verification. A verification code was recently sent. Please enter your 6-digit code or wait ${waitSeconds}s to request another.`,
          email: existingUser.email,
          organization_id: existingUser.organization_id,
          user: {
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            status: 'pending_verification',
            organization_id: existingUser.organization_id,
            created_at: existingUser.created_at
          },
          email_delivery: {
            attempted: false,
            inCooldown: true,
            success: true,
            recipient: cleanEmail
          }
        });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenExpiresAt = new Date(now + 24 * 60 * 60 * 1000); // 24 hours

      await UserModel.setVerificationDetails(cleanEmail, verificationToken, verificationOtp, tokenExpiresAt);
      resendRateLimits.set(cleanEmail, now);

      const frontendBase = resolveFrontendUrl(req);
      const verifyUrl = `${frontendBase}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(cleanEmail)}`;

      console.log(`[AuthController] Resending fresh verification email for existing unverified user "${cleanEmail}" (Frontend: ${frontendBase})`);
      const emailResult = await emailService.sendVerificationEmail({
        email: cleanEmail,
        name: existingUser.name,
        token: verificationToken,
        otp: verificationOtp,
        verifyUrl
      });

      return res.status(200).json({
        success: true,
        requiresVerification: true,
        isExistingUnverified: true,
        message: 'An unverified account with this email address already exists. A fresh 6-digit verification code has been sent to your email.',
        email: existingUser.email,
        organization_id: existingUser.organization_id,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          status: 'pending_verification',
          organization_id: existingUser.organization_id,
          created_at: existingUser.created_at
        },
        email_delivery: {
          attempted: emailResult.attempted,
          success: emailResult.success,
          provider: emailResult.provider || 'SMTP',
          recipient: cleanEmail
        }
      });
    }

    // 3. Create a BRAND NEW isolated tenant organization with 14-day free trial
    const newOrg = await OrganizationModel.create({
      name: orgName,
      plan: 'starter',
      subscription_status: 'trial',
      payment_status: 'unpaid'
    });

    if (!newOrg || !newOrg.id) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize tenant workspace organization.'
      });
    }

    const organizationId = newOrg.id;

    // 4. Hash password securely
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Initial registering user is granted the 'admin' role of their organization
    const initialRole = 'admin';

    // 6. Generate cryptographic verification token and 6-digit OTP
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 7. Supabase Auth registration (if configured)
    if (isConfigured && supabase) {
      try {
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: name.trim(),
              role: initialRole,
              organization_id: organizationId
            }
          }
        });
      } catch (_) {
        // Fall back to local DB verification flow
      }
    }

    // 8. Insert user record in public.users with pending_verification status
    const newUser = await UserModel.create({
      name: name.trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      role: initialRole,
      organization_id: organizationId,
      status: 'pending_verification',
      verification_token: verificationToken,
      verification_otp: verificationOtp,
      verification_token_expires_at: tokenExpiresAt
    });

    // 9. Dispatch verification email with dynamic frontend domain resolution
    const frontendBase = resolveFrontendUrl(req);
    const verifyUrl = `${frontendBase}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(cleanEmail)}`;

    console.log(`[AuthController] Dispatching registration verification email to "${cleanEmail}" (Frontend: ${frontendBase})`);
    const emailResult = await emailService.sendVerificationEmail({
      email: cleanEmail,
      name: newUser.name,
      token: verificationToken,
      otp: verificationOtp,
      verifyUrl
    });

    if (!emailResult.success) {
      console.error(`[AuthController] ❌ Verification email dispatch failed for "${cleanEmail}":`, emailResult.error);
    } else {
      console.log(`[AuthController] ✅ Verification email dispatched for "${cleanEmail}" (Message ID: ${emailResult.messageId})`);
    }

    // Initialize 60s resend cooldown timer upon registration
    resendRateLimits.set(cleanEmail, Date.now());

    // 10. Audit Log
    await logAuditEvent({
      organizationId,
      userId: newUser.id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      resourceType: 'auth',
      resourceId: newUser.id,
      description: `New organization registered: "${orgName}" with admin user "${newUser.email}" (14-day free trial initiated)`,
      metadata: { email: newUser.email, organizationName: orgName, plan: 'starter', trialDays: 14 },
      req
    }).catch(() => null);

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully. A 6-digit verification code has been sent to your email.',
      requiresVerification: true,
      token,
      email: newUser.email,
      organization_id: organizationId,
      organization_name: orgName,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: 'pending_verification',
        organization_id: organizationId,
        created_at: newUser.created_at
      },
      email_delivery: {
        attempted: emailResult.attempted,
        success: emailResult.success,
        provider: emailResult.provider || 'SMTP',
        recipient: cleanEmail,
        deliveredTo: emailResult.deliveredTo || cleanEmail,
        isTestRedirect: Boolean(emailResult.isTestRedirect),
        mocked: Boolean(emailResult.mocked)
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
 * POST /api/auth/verify-email (and verify-otp)
 * Verify email address with 6-digit code or cryptographic token
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp, token } = req.body;

    if (!email && !token) {
      return res.status(400).json({
        success: false,
        message: 'Email address or verification token is required.'
      });
    }

    let user = null;
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanOtp = otp ? String(otp).trim() : null;
    const cleanToken = token ? String(token).trim() : null;

    if (cleanEmail) {
      user = await UserModel.findByEmail(cleanEmail);
    } else if (cleanToken) {
      user = await UserModel.findByVerificationToken(cleanToken);
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VERIFICATION',
          message: 'No pending verification matching the provided details.'
        },
        message: 'No pending verification matching the provided details.'
      });
    }

    if (user.status === 'active' || (!user.verification_otp && !user.verification_token)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_VERIFIED_OR_USED',
          message: 'This email is already verified or the verification token has already been used. Please log in directly.'
        },
        message: 'This email is already verified or the verification token has already been used. Please log in directly.'
      });
    }

    let isValid = false;

    // A. Check against cryptographic token
    if (cleanToken && user.verification_token === cleanToken) {
      if (user.verification_token_expires_at && new Date() > new Date(user.verification_token_expires_at)) {
        return res.status(400).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'The verification link has expired. Please request a new one.' },
          message: 'The verification link has expired. Please request a new one.'
        });
      }
      isValid = true;
    }

    // B. Check against 6-digit OTP
    if (!isValid && cleanOtp) {
      if (user.verification_otp && user.verification_otp === cleanOtp) {
        if (user.verification_token_expires_at && new Date() > new Date(user.verification_token_expires_at)) {
          return res.status(400).json({
            success: false,
            error: { code: 'OTP_EXPIRED', message: 'The 6-digit code has expired. Please request a new one.' },
            message: 'The 6-digit code has expired. Please request a new one.'
          });
        }
        isValid = true;
      }
    }

    // C. Supabase Auth fallback if configured
    if (!isValid && isConfigured && supabase && cleanEmail && cleanOtp) {
      try {
        const { error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: 'signup'
        });
        if (!error) isValid = true;
      } catch (_) {}
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid verification code or link. Please check your email and try again.'
        },
        message: 'Invalid verification code or link. Please check your email and try again.'
      });
    }

    // Mark verified in database
    await UserModel.markEmailVerified(user.email);

    // Generate authenticated session JWT token
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization_id: user.organization_id
    });

    // Audit log
    await logAuditEvent({
      organizationId: user.organization_id,
      userId: user.id,
      action: AUDIT_ACTIONS.USER_EMAIL_VERIFIED,
      resourceType: 'auth',
      resourceId: user.id,
      description: `User ${user.email} successfully verified their email address.`,
      metadata: { email: user.email },
      req
    }).catch(() => null);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now access your workspace.',
      email: user.email,
      token: authToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        status: 'active'
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/resend-otp (and resend-verification)
 * Resend email verification code with 60-second rate limiting
 */
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check rate limit: 60s cooldown
    const lastSent = resendRateLimits.get(cleanEmail);
    const now = Date.now();
    if (lastSent && now - lastSent < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - lastSent)) / 1000);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Please wait ${waitSeconds} seconds before requesting another verification email.`
        },
        message: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
        retryAfter: waitSeconds
      });
    }

    const user = await UserModel.findByEmail(cleanEmail);
    if (!user) {
      // Prevent account enumeration: return 200 with generic confirmation
      return res.status(200).json({
        success: true,
        message: 'If an unverified account exists with this email address, a 6-digit verification code has been sent.'
      });
    }

    if (user.status === 'active') {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'This email address is already verified. You can log in directly.'
      });
    }

    // Generate fresh verification details
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await UserModel.setVerificationDetails(cleanEmail, verificationToken, verificationOtp, tokenExpiresAt);
    resendRateLimits.set(cleanEmail, now);

    // Supabase trigger if configured
    if (isConfigured && supabase) {
      await supabase.auth.resend({ type: 'signup', email: cleanEmail }).catch(() => null);
    }

    // Dispatch verification email with dynamic frontend domain resolution
    const frontendBase = resolveFrontendUrl(req);
    const verifyUrl = `${frontendBase}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(cleanEmail)}`;

    console.log(`[AuthController] Resending verification email to "${cleanEmail}" (Frontend: ${frontendBase})`);
    const emailResult = await emailService.sendVerificationEmail({
      email: cleanEmail,
      name: user.name,
      token: verificationToken,
      otp: verificationOtp,
      verifyUrl
    });

    if (!emailResult.success) {
      console.error(`[AuthController] ❌ Resend verification email failed for "${cleanEmail}":`, emailResult.error);
    } else {
      console.log(`[AuthController] ✅ Resend verification email delivered for "${cleanEmail}" (Message ID: ${emailResult.messageId})`);
    }

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
      email_delivery: {
        attempted: emailResult.attempted,
        success: emailResult.success,
        provider: emailResult.provider || 'SMTP',
        recipient: cleanEmail,
        deliveredTo: emailResult.deliveredTo || cleanEmail,
        isTestRedirect: Boolean(emailResult.isTestRedirect),
        mocked: Boolean(emailResult.mocked)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user with credentials, verify email status, and check 14-day trial
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

    const cleanEmail = email.trim().toLowerCase();

    // 1. Find user by email
    const user = await UserModel.findByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 2. Check email verification status
    if (user.status === 'pending_verification') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before logging in.'
        },
        message: 'Please verify your email address before logging in. A 6-digit verification code was sent to your email.',
        requiresVerification: true,
        email: user.email
      });
    }

    // 3. Check account suspension status
    if (user.status === 'deactivated' || user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact your organization administrator.'
      });
    }

    // 4. Verify password with bcrypt
    let isMatch = false;
    const primaryHash = typeof user.password_hash === 'string' && user.password_hash.trim().length > 0 
      ? user.password_hash 
      : null;

    if (primaryHash) {
      try {
        isMatch = await bcrypt.compare(password, primaryHash);
      } catch (_) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      const altHash = typeof user.password_hash_alt === 'string' && user.password_hash_alt.trim().length > 0
        ? user.password_hash_alt
        : null;
      if (altHash) {
        try {
          isMatch = await bcrypt.compare(password, altHash);
        } catch (_) {
          isMatch = false;
        }
      }
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

    // 5. Check organization subscription & 14-day trial status
    const orgId = user.organization_id;
    let subscription = null;
    let org = null;

    if (orgId) {
      subscription = await subscriptionService.getOrganizationSubscription(orgId);
      org = await OrganizationModel.findById(orgId);
    }

    // Update last login timestamp
    await UserModel.updateLastLogin(user.id).catch(() => null);

    // Audit Log
    await logAuditEvent({
      organizationId: orgId,
      userId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      resourceType: 'auth',
      resourceId: user.id,
      description: `User ${user.email} logged into enterprise workspace`,
      metadata: { role: user.role, email: user.email },
      req
    }).catch(() => null);

    // 6. Generate signed session token with strictly verified claims
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || 'active',
        organization_id: orgId,
        organization_name: org?.name || 'Workspace',
        created_at: user.created_at
      },
      subscription: subscription || {
        subscriptionStatus: 'trial',
        daysRemaining: 14,
        canAccessApp: true
      },
      requiresPayment: subscription ? !subscription.canAccessApp : false
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Return current user profile, organization, and trial subscription status
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

    const orgId = user?.organization_id || req.user.organization_id;
    let organization = null;
    let subscription = null;

    if (orgId) {
      organization = await OrganizationModel.findById(orgId).catch(() => null);
      subscription = await subscriptionService.getOrganizationSubscription(orgId).catch(() => null);
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user?.id || req.user.id,
        name: user?.name || req.user.name,
        email: user?.email || req.user.email,
        role: user?.role || req.user.role || 'viewer',
        organization_id: orgId,
        organization_name: organization?.name || 'Workspace',
        avatar_url: user?.avatar_url || null,
        created_at: user?.created_at || new Date()
      },
      subscription: subscription || {
        subscriptionStatus: 'trial',
        daysRemaining: 14,
        canAccessApp: true
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/invitation/:token
 * Validate invitation token and return organization details
 */
const getInvitationDetails = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Invitation token is required.' });
    }

    const invitation = await InvitationModel.findByToken(token);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or invalid.'
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This invitation has already been ${invitation.status}.`
      });
    }

    if (new Date() > new Date(invitation.expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'This invitation has expired. Please ask your administrator to send a new invite.'
      });
    }

    return res.status(200).json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        organizationName: invitation.organization_name,
        inviterName: invitation.inviter_name,
        expiresAt: invitation.expires_at
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/accept-invite
 * Accept team member invitation and join the inviting organization
 */
const acceptInvite = async (req, res, next) => {
  try {
    const { token, name, password } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Invitation token is required.' });
    }

    const invitation = await InvitationModel.findByToken(token);
    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found or invalid.' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ success: false, message: `This invitation has already been ${invitation.status}.` });
    }

    if (new Date() > new Date(invitation.expires_at)) {
      return res.status(400).json({ success: false, message: 'This invitation has expired.' });
    }

    const cleanEmail = invitation.email.toLowerCase();

    // Check if user already exists
    let user = await UserModel.findByEmail(cleanEmail);

    if (user) {
      // If user exists, update their organization and role to the invited org
      await UserModel.updateRole(user.id, invitation.role, invitation.organization_id);
      await UserModel.markEmailVerified(cleanEmail);
    } else {
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user = await UserModel.create({
        name: (name || cleanEmail.split('@')[0]).trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        role: invitation.role,
        organization_id: invitation.organization_id,
        status: 'active' // Email is verified via invitation link
      });
      await UserModel.markEmailVerified(cleanEmail);
    }

    // Mark invitation accepted
    await InvitationModel.markAccepted(invitation.id);

    // Audit log
    await logAuditEvent({
      organizationId: invitation.organization_id,
      userId: user.id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      resourceType: 'auth',
      resourceId: user.id,
      description: `User ${user.email} accepted invitation and joined as ${invitation.role}`,
      metadata: { role: invitation.role, invitationId: invitation.id },
      req
    }).catch(() => null);

    const authToken = generateToken(user);

    return res.status(200).json({
      success: true,
      message: `You have successfully joined ${invitation.organization_name}!`,
      token: authToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: invitation.role,
        organization_id: invitation.organization_id,
        organization_name: invitation.organization_name
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Terminate user session and revoke JWT token
 */
const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1].trim();
      tokenBlacklist.revoke(token);
    }

    if (req.user) {
      await logAuditEvent({
        organizationId: req.user.organization_id,
        userId: req.user.id,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        resourceType: 'auth',
        resourceId: req.user.id,
        description: `User ${req.user.email} logged out from session`,
        metadata: { role: req.user.role },
        req
      }).catch(() => null);
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

/**
 * POST /api/auth/forgot-password
 * Initiate secure password reset flow
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await UserModel.findByEmail(cleanEmail);

    let devResetToken = null;

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await UserModel.setResetPasswordToken(cleanEmail, resetToken, expiresAt);
      devResetToken = resetToken;

      await emailService.sendPasswordResetEmail({
        email: cleanEmail,
        name: user.name,
        token: resetToken,
        resetUrl: `http://localhost:5173/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`
      });

      await logAuditEvent({
        organizationId: user.organization_id,
        userId: user.id,
        action: AUDIT_ACTIONS.USER_PASSWORD_RESET_REQUESTED,
        resourceType: 'auth',
        resourceId: user.id,
        description: `Password reset requested for user ${user.email}`,
        metadata: { email: user.email },
        req
      }).catch(() => null);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email address, a password reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' && devResetToken ? { _devResetToken: devResetToken } : {})
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/reset-password/:token
 * Verify whether password reset token is valid and unexpired
 */
const verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is required.'
      });
    }

    const user = await UserModel.findByResetPasswordToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset link.'
      });
    }

    if (!user.reset_password_expires_at || new Date() > new Date(user.reset_password_expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link has expired. Please request a new one.'
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      email: user.email
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/reset-password
 * Complete password reset with new password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is required.'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.'
      });
    }

    const user = await UserModel.findByResetPasswordToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset link.'
      });
    }

    if (!user.reset_password_expires_at || new Date() > new Date(user.reset_password_expires_at)) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link has expired. Please request a new one.'
      });
    }

    // Hash new password using modern bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(password, 10);
    await UserModel.updatePassword(user.email, passwordHash);

    // Audit Log
    await logAuditEvent({
      organizationId: user.organization_id,
      userId: user.id,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      resourceType: 'auth',
      resourceId: user.id,
      description: `Password reset successfully completed for user ${user.email}`,
      metadata: { email: user.email },
      req
    }).catch(() => null);

    return res.status(200).json({
      success: true,
      message: 'Your password has been successfully reset. You can now sign in with your new password.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  verifyOtp,
  verifyEmail: verifyOtp,
  resendOtp,
  resendVerification: resendOtp,
  login,
  getMe,
  getInvitationDetails,
  acceptInvite,
  logout,
  forgotPassword,
  verifyResetToken,
  resetPassword
};
