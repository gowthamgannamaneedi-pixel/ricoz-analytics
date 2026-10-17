const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { supabase, isConfigured } = require('../config/supabase');
const UserModel = require('../models/userModel');
const OrganizationModel = require('../models/organizationModel');
const InvitationModel = require('../models/invitationModel');
const subscriptionService = require('../services/subscriptionService');
const plansConfig = require('../config/plans');
const emailService = require('../services/emailService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');
const tokenBlacklist = require('../utils/tokenBlacklist');

// In-memory rate limiting map for verification resends: email -> lastSentTimestamp
const resendRateLimits = new Map();
// In-flight concurrency set to eliminate double-send race conditions
const inFlightResends = new Set();
const RESEND_COOLDOWN_MS = 60 * 1000; // 60s cooldown

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
 * In production, strictly ensures HTTPS domain and NEVER falls back to localhost.
 */
function resolveFrontendUrl(req) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  const envUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.APP_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    const cleanUrl = envUrl.replace(/\/+$/, '');
    if (isProd && (cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1'))) {
      console.warn('[AuthController] ⚠️ CLIENT_URL contains localhost in production environment. Falling back to production domain.');
      return 'https://ricoz-analytics.vercel.app';
    }
    return cleanUrl;
  }

  const origin = req?.headers?.origin;
  if (origin && typeof origin === 'string' && origin.startsWith('http')) {
    const cleanOrigin = origin.replace(/\/+$/, '');
    if (!cleanOrigin.includes('localhost:5000')) {
      if (!isProd || (!cleanOrigin.includes('localhost') && !cleanOrigin.includes('127.0.0.1'))) {
        return cleanOrigin;
      }
    }
  }

  const referer = req?.headers?.referer;
  if (referer && typeof referer === 'string' && referer.startsWith('http')) {
    try {
      const u = new URL(referer);
      const hostUrl = `${u.protocol}//${u.host}`;
      if (!hostUrl.includes('localhost:5000')) {
        if (!isProd || (!hostUrl.includes('localhost') && !hostUrl.includes('127.0.0.1'))) {
          return hostUrl;
        }
      }
    } catch (_) {}
  }

  if (isProd) {
    return 'https://ricoz-analytics.vercel.app';
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
      if (existingUser.status === 'pending_verification') {
        // User registered earlier but has not yet verified their email.
        // Provide a secure, rate-limited recovery path: dispatch a fresh OTP without invalidating old one until delivery succeeds!
        
        // A. Rate-limit check (60s cooldown)
        const lastSent = resendRateLimits.get(cleanEmail);
        const now = Date.now();
        if (lastSent && now - lastSent < RESEND_COOLDOWN_MS) {
          const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
          return res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: `A verification code was recently sent. Please wait ${waitSeconds} seconds before requesting another.`
            },
            message: `A verification code was recently sent. Please wait ${waitSeconds} seconds before requesting another.`,
            retryAfter: waitSeconds,
            requiresVerification: true,
            email: cleanEmail
          });
        }

        // B. Generate replacement verification credentials
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const frontendBase = resolveFrontendUrl(req);
        const verifyUrl = `${frontendBase}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(cleanEmail)}`;

        // C. Dispatch verification email via Brevo FIRST!
        console.log(`[AuthController] Dispatching verification email for unverified existing account "${cleanEmail}" (Frontend: ${frontendBase})`);
        const emailResult = await emailService.sendVerificationEmail({
          email: cleanEmail,
          name: name?.trim() || existingUser.name,
          token: verificationToken,
          otp: verificationOtp,
          verifyUrl
        });

        // D. If email dispatch failed, DO NOT invalidate the existing valid OTP in PostgreSQL!
        if (!emailResult.success) {
          console.error(`[AuthController] ❌ Verification email dispatch failed for "${cleanEmail}":`, emailResult.error);
          return res.status(502).json({
            success: false,
            error: {
              code: 'EMAIL_DISPATCH_FAILED',
              message: 'Failed to deliver the verification code to your email. Your existing code remains valid. Please click Resend Code to try again.',
              provider: emailResult.provider || 'Brevo',
              detail: emailResult.error
            },
            message: 'Failed to deliver the verification code to your email. Your existing code remains valid. Please click Resend Code to try again.',
            email_delivery: {
              attempted: emailResult.attempted,
              success: false,
              provider: emailResult.provider || 'Brevo',
              recipient: cleanEmail,
              error: emailResult.error
            }
          });
        }

        // E. Provider accepted delivery! Now update database and rate limit
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        await UserModel.updatePassword(cleanEmail, passwordHash);
        await UserModel.setVerificationDetails(cleanEmail, verificationToken, verificationOtp, tokenExpiresAt);
        resendRateLimits.set(cleanEmail, Date.now());

        // Safe diagnostic metadata log (Never logs OTPs, tokens, passwords, or API keys)
        console.log(`[AuthController] [SafeDiagnostic]`, JSON.stringify({
          timestamp: new Date().toISOString(),
          flow: 'Unverified Re-registration OTP',
          provider: emailResult.provider || 'Brevo',
          httpStatus: 200,
          brevoMessageId: emailResult.messageId || null,
          error: null
        }));

        const token = generateToken(existingUser);
        return res.status(200).json({
          success: true,
          message: 'An unverified account with this email was found. A fresh 6-digit verification code has been sent to your email.',
          emailSent: true,
          requiresVerification: true,
          token,
          email: existingUser.email,
          organization_id: existingUser.organization_id,
          email_delivery: {
            attempted: emailResult.attempted,
            success: true,
            provider: emailResult.provider || 'Brevo',
            recipient: cleanEmail,
            deliveredTo: emailResult.deliveredTo || cleanEmail,
            messageId: emailResult.messageId || null,
            isTestRedirect: Boolean(emailResult.isTestRedirect),
            mocked: Boolean(emailResult.mocked)
          }
        });
      }

      return res.status(409).json({
        success: false,
        code: 'EMAIL_ALREADY_VERIFIED',
        isVerified: true,
        message: 'An account with this email address already exists and is active. Please log in or reset your password.'
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
      console.log(`[AuthController] ✅ Verification email dispatched for "${cleanEmail}" (Message ID: ${emailResult.messageId || 'unknown'})`);
      // Initialize 60s resend cooldown timer upon registration ONLY if dispatch succeeded
      resendRateLimits.set(cleanEmail, Date.now());
    }

    // Safe diagnostic metadata log (Never logs OTPs, tokens, passwords, or API keys)
    console.log(`[AuthController] [SafeDiagnostic]`, JSON.stringify({
      timestamp: new Date().toISOString(),
      flow: 'Registration OTP',
      provider: emailResult.provider || 'Brevo',
      httpStatus: emailResult.success ? 201 : 502,
      brevoMessageId: emailResult.messageId || null,
      error: emailResult.error || null
    }));

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
      message: emailResult.success
        ? 'Account registered successfully. A 6-digit verification code has been sent to your email.'
        : 'Account registered successfully. However, we could not deliver the verification email. Please click Resend Code to try again.',
      emailSent: Boolean(emailResult.success),
      requiresVerification: true,
      token,
      email: newUser.email,
      organization_id: organizationId,
      organization_name: orgName,
      ...(process.env.NODE_ENV !== 'production' ? {
        _devVerificationOtp: verificationOtp,
        _devVerificationToken: verificationToken
      } : {}),
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
        provider: emailResult.provider || 'Brevo',
        recipient: cleanEmail,
        deliveredTo: emailResult.deliveredTo || cleanEmail,
        messageId: emailResult.messageId || null,
        error: emailResult.error || null,
        isTestRedirect: Boolean(emailResult.isTestRedirect),
        mocked: Boolean(emailResult.mocked)
      }
    });
  } catch (err) {
    console.error(`[AuthController] ❌ Registration error for "${req.body?.email}":`, err.message, err.code, err.constraint || '');
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_ALREADY_EXISTS',
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

    const user = await UserModel.findByEmail(cleanEmail);
    if (!user) {
      // Prevent account enumeration: return 200 with generic confirmation
      return res.status(200).json({
        success: true,
        message: 'If an unverified account exists with this email address, a 6-digit verification code has been sent.'
      });
    }

    if (user.status === 'active' || user.email_verified_at) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'This email address is already verified. You can log in directly.'
      });
    }

    // 1. Guard against concurrent duplicate requests
    if (inFlightResends.has(cleanEmail)) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RESEND_IN_PROGRESS',
          message: 'A verification email is currently being dispatched. Please wait a moment.'
        },
        message: 'A verification email is currently being dispatched. Please wait a moment.'
      });
    }

    // 2. Check rate limit: 60s cooldown for unverified resends
    const lastSent = resendRateLimits.get(cleanEmail);
    const now = Date.now();
    if (lastSent && now - lastSent < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
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

    inFlightResends.add(cleanEmail);

    try {
      // 3. Prepare fresh verification credentials (persisted ONLY after successful dispatch)
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // 4. Dispatch verification email with dynamic frontend domain resolution FIRST
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

      // 5. If dispatch failed, DO NOT invalidate existing valid OTP in PostgreSQL!
      if (!emailResult.success) {
        console.error(`[AuthController] ❌ Resend verification email failed for "${cleanEmail}":`, emailResult.error);
        return res.status(502).json({
          success: false,
          error: {
            code: 'EMAIL_DISPATCH_FAILED',
            message: 'Failed to deliver the verification code to your email. Your existing code remains valid. Please click Resend Code to try again.',
            provider: emailResult.provider || 'Brevo',
            detail: emailResult.error
          },
          message: 'Failed to deliver the verification code to your email. Your existing code remains valid. Please click Resend Code to try again.',
          email_delivery: {
            attempted: emailResult.attempted,
            success: false,
            provider: emailResult.provider || 'Brevo',
            recipient: cleanEmail,
            error: emailResult.error
          }
        });
      }

      // 6. Provider accepted delivery! Now update database and rate limit
      await UserModel.setVerificationDetails(cleanEmail, verificationToken, verificationOtp, tokenExpiresAt);

      if (isConfigured && supabase) {
        await supabase.auth.resend({ type: 'signup', email: cleanEmail }).catch(() => null);
      }

      // ONLY enforce cooldown when the email provider actually accepts the dispatch!
      resendRateLimits.set(cleanEmail, Date.now());
      console.log(`[AuthController] ✅ Resend verification email delivered for "${cleanEmail}" (Message ID: ${emailResult.messageId || 'unknown'})`);

      // Safe diagnostic metadata log (Never logs OTPs, tokens, passwords, or API keys)
      console.log(`[AuthController] [SafeDiagnostic]`, JSON.stringify({
        timestamp: new Date().toISOString(),
        flow: 'Resend OTP',
        provider: emailResult.provider || 'Brevo',
        httpStatus: 200,
        brevoMessageId: emailResult.messageId || null,
        error: null
      }));

      return res.status(200).json({
        success: true,
        message: 'A new 6-digit verification code has been sent to your email.',
        email_delivery: {
          attempted: emailResult.attempted,
          success: true,
          provider: emailResult.provider || 'Brevo',
          recipient: cleanEmail,
          deliveredTo: emailResult.deliveredTo || cleanEmail,
          messageId: emailResult.messageId || null,
          isTestRedirect: Boolean(emailResult.isTestRedirect),
          mocked: Boolean(emailResult.mocked)
        }
      });
    } finally {
      inFlightResends.delete(cleanEmail);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user with credentials, verify email status, and check 14-day trial
 */
const login = async (req, res, next) => {
  const loginStart = Date.now();
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

    if (orgId) {
      subscription = await subscriptionService.getOrganizationSubscription(orgId);
    }
    const orgName = subscription?.organizationName || 'Workspace';

    // Prime subscription cache and ensure user auth cache is clean
    const authMiddleware = require('../middleware/authMiddleware');
    if (authMiddleware.clearUserAuthCache) {
      authMiddleware.clearUserAuthCache(user.email);
      if (user.id) authMiddleware.clearUserAuthCache(user.id);
    }
    if (subscriptionService.primeOrganizationCache && orgId && subscription) {
      subscriptionService.primeOrganizationCache(orgId, subscription);
    }

    // Update last login timestamp and audit event asynchronously (non-blocking for HTTP response)
    setImmediate(() => {
      UserModel.updateLastLogin(user.id).catch(() => null);
      logAuditEvent({
        organizationId: orgId,
        userId: user.id,
        action: AUDIT_ACTIONS.USER_LOGIN,
        resourceType: 'auth',
        resourceId: user.id,
        description: `User ${user.email} logged into enterprise workspace`,
        metadata: { role: user.role, email: user.email },
        req
      }).catch(() => null);
    });

    // 6. Generate signed session token with strictly verified claims
    const token = generateToken(user);
    const loginDur = Date.now() - loginStart;

    try {
      res.setHeader('Server-Timing', `login;dur=${loginDur}`);
    } catch (_) {}

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
        organization_name: orgName,
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
 * Highly optimized: reuses authenticated request session and subscription cache
 */
const getMe = async (req, res, next) => {
  const meStart = Date.now();
  try {
    // Authenticate middleware already completely verified and attached req.user
    const resolvedUser = req.user || (await UserModel.findById(req.user?.id || req.userId).catch(() => null));
    if (!resolvedUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    const orgId = resolvedUser.organization_id;
    let subscription = null;

    if (orgId) {
      subscription = await subscriptionService.getOrganizationSubscription(orgId, { includeUsage: false }).catch(() => null);
    }

    const meDur = Date.now() - meStart;
    try {
      res.setHeader('Server-Timing', `me;dur=${meDur}`);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      user: {
        id: resolvedUser.id,
        name: resolvedUser.name,
        email: resolvedUser.email,
        role: resolvedUser.role || 'viewer',
        organization_id: orgId,
        organization_name: subscription?.organizationName || 'Workspace',
        avatar_url: resolvedUser.avatar_url || null,
        created_at: resolvedUser.created_at || new Date()
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

    const existingUser = await UserModel.findByEmail(invitation.email.toLowerCase());

    return res.status(200).json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        organizationName: invitation.organization_name,
        inviterName: invitation.inviter_name,
        expiresAt: invitation.expires_at,
        isExistingUser: Boolean(existingUser)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/accept-invite
 * Accept team member invitation and join the inviting organization
 * Supports both new users (name & password) and existing users (password verification or authenticated session)
 * Assigns authorized server-side role without trusting any role supplied by the invitee.
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
      return res.status(400).json({ success: false, message: 'This invitation has expired. Please ask your administrator to send a new invite.' });
    }

    const cleanEmail = invitation.email.toLowerCase();

    // Check if user already exists
    let user = await UserModel.findByEmail(cleanEmail);

    if (user) {
      // Existing user: verify email ownership via credentials or active authenticated session
      let isVerified = false;
      if (req.user && String(req.user.email).toLowerCase() === cleanEmail) {
        isVerified = true;
      } else if (password) {
        const matches = await bcrypt.compare(password, user.password_hash || '');
        const matchesAlt = user.password_hash_alt ? await bcrypt.compare(password, user.password_hash_alt) : false;
        if (matches || matchesAlt) {
          isVerified = true;
        }
      }

      if (!isVerified) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'An account already exists with this email address. Please provide your existing password to verify account ownership.'
          },
          message: 'An account already exists with this email address. Please provide your existing password to verify account ownership.'
        });
      }

      // Check seat limit if migrating from a different organization
      if (String(user.organization_id) !== String(invitation.organization_id)) {
        const usage = await subscriptionService.getOrganizationUsage(invitation.organization_id);
        const userLimit = usage.users.limit;
        if (userLimit !== -1 && usage.users.membersCount >= userLimit) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'RESOURCE_LIMIT_EXCEEDED',
              message: `Your organization has reached the maximum of ${userLimit} active team members for the current plan. Please upgrade to add more members.`
            },
            message: `Your organization has reached the maximum of ${userLimit} active team members for the current plan. Please upgrade to add more members.`,
            requiresUpgrade: true,
            limit: userLimit,
            currentCount: usage.users.membersCount
          });
        }
      }

      // Update organization and assign authorized server-side role (never trust client role)
      const updated = await UserModel.updateOrganizationAndRole(user.id, invitation.organization_id, invitation.role);
      await UserModel.markEmailVerified(cleanEmail);
      user = updated || user;
      user.organization_id = invitation.organization_id;
      user.role = invitation.role;
    } else {
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      }

      // Check that active members have not exceeded the plan limit
      const usage = await subscriptionService.getOrganizationUsage(invitation.organization_id);
      const userLimit = usage.users.limit;
      if (userLimit !== -1 && usage.users.membersCount >= userLimit) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'RESOURCE_LIMIT_EXCEEDED',
            message: `Your organization has reached the maximum of ${userLimit} active team members for the current plan. Please upgrade to add more members.`
          },
          message: `Your organization has reached the maximum of ${userLimit} active team members for the current plan. Please upgrade to add more members.`,
          requiresUpgrade: true,
          limit: userLimit,
          currentCount: usage.users.membersCount
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user = await UserModel.create({
        name: (name || cleanEmail.split('@')[0]).trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        role: invitation.role, // Server-enforced from invitation
        organization_id: invitation.organization_id,
        status: 'active'
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

      const clientBaseUrl = resolveFrontendUrl(req);
      const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

      if (isProd && (clientBaseUrl.includes('localhost') || clientBaseUrl.includes('127.0.0.1'))) {
        console.error('[AuthController] ❌ FATAL: Production password reset link cannot contain localhost!');
        throw new Error('Server configuration error: Invalid production client URL');
      }

      const resetUrl = `${clientBaseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

      console.log(`[AuthController] ✉️ Dispatching password reset email for "${cleanEmail}" (Frontend: ${clientBaseUrl})`);

      await emailService.sendPasswordResetEmail({
        email: cleanEmail,
        name: user.name,
        token: resetToken,
        resetUrl
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
