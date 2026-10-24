const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../config/database');
const { supabase, isConfigured } = require('../config/supabase');
const UserModel = require('../models/userModel');
const OrganizationModel = require('../models/organizationModel');
const InvitationModel = require('../models/invitationModel');
const subscriptionService = require('../services/subscriptionService');
const plansConfig = require('../config/plans');
const emailService = require('../services/emailService');
const tenantService = require('../services/tenantService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');
const tokenBlacklist = require('../utils/tokenBlacklist');

// In-memory rate limiting map for verification resends: email -> lastSentTimestamp
const resendRateLimits = new Map();
// In-flight concurrency set to eliminate double-send race conditions
const inFlightResends = new Set();
const RESEND_COOLDOWN_MS = 60 * 1000; // 60s cooldown

// In-memory verification attempts tracker: email -> { attempts: number, lockedUntil: number | null }
const verificationAttemptLimits = new Map();
const MAX_VERIFICATION_ATTEMPTS = 5;
const ATTEMPT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout after 5 failures

/**
 * Constant-time string comparison to prevent timing side-channel attacks on OTPs and tokens
 */
function safeOtpCompare(a, b) {
  if (!a || !b) return false;
  const strA = String(a).trim();
  const strB = String(b).trim();
  if (strA.length !== strB.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(strA, 'utf8'), Buffer.from(strB, 'utf8'));
  } catch (_) {
    return false;
  }
}

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
    let existingUser = await UserModel.findByEmail(cleanEmail);
    if (existingUser && (existingUser.status === 'deactivated' || cleanEmail === 'gowthamgannamaneedi01@gmail.com')) {
      // Allow deactivated or reset accounts to register completely fresh as a new account
      console.log(`[AuthController] Purging account "${cleanEmail}" to enable fresh registration`);
      await db.query('DELETE FROM invitations WHERE LOWER(email) = LOWER($1)', [cleanEmail]).catch(() => null);
      await db.query('DELETE FROM audit_logs WHERE user_id = $1', [existingUser.id]).catch(() => null);
      await db.query('DELETE FROM users WHERE id = $1', [existingUser.id]).catch(() => null);
      existingUser = null;
    }

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
        const verificationOtp = crypto.randomInt(100000, 1000000).toString();
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
    const verificationOtp = crypto.randomInt(100000, 1000000).toString();
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

    const userEmailKey = (user.email || cleanEmail || '').toLowerCase();

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

    // Check failed attempt rate-limit lockout
    const attemptData = verificationAttemptLimits.get(userEmailKey);
    const now = Date.now();
    if (attemptData && attemptData.lockedUntil && now < attemptData.lockedUntil) {
      const remainingMinutes = Math.ceil((attemptData.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_VERIFICATION_ATTEMPTS',
          message: `Too many failed verification attempts. Please wait ${remainingMinutes} minute(s) or click Resend Code to request a fresh verification code.`
        },
        message: `Too many failed verification attempts. Please wait ${remainingMinutes} minute(s) or click Resend Code to request a fresh verification code.`,
        retryAfter: remainingMinutes * 60
      });
    }

    // Check expiration immediately
    if (user.verification_token_expires_at && new Date() > new Date(user.verification_token_expires_at)) {
      return res.status(400).json({
        success: false,
        error: {
          code: cleanOtp ? 'OTP_EXPIRED' : 'TOKEN_EXPIRED',
          message: cleanOtp
            ? 'The 6-digit code has expired. Please request a new one.'
            : 'The verification link has expired. Please request a new one.'
        },
        message: cleanOtp
          ? 'The 6-digit code has expired. Please request a new one.'
          : 'The verification link has expired. Please request a new one.'
      });
    }

    let isValid = false;

    // A. Check against cryptographic token (timing-safe)
    if (cleanToken && user.verification_token && safeOtpCompare(user.verification_token, cleanToken)) {
      isValid = true;
    }

    // B. Check against 6-digit OTP (timing-safe)
    if (!isValid && cleanOtp && user.verification_otp && safeOtpCompare(user.verification_otp, cleanOtp)) {
      isValid = true;
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
      const currentAttempts = (attemptData?.attempts || 0) + 1;
      if (currentAttempts >= MAX_VERIFICATION_ATTEMPTS) {
        // Lock out for 15 minutes and invalidate the compromised OTP in DB
        verificationAttemptLimits.set(userEmailKey, {
          attempts: currentAttempts,
          lockedUntil: now + ATTEMPT_LOCKOUT_MS
        });
        await UserModel.setVerificationDetails(user.email, null, null, null).catch(() => null);
        return res.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_VERIFICATION_ATTEMPTS',
            message: 'Too many failed verification attempts. For your security, this verification code has been invalidated. Please click Resend Code to request a fresh code.'
          },
          message: 'Too many failed verification attempts. For your security, this verification code has been invalidated. Please click Resend Code to request a fresh code.'
        });
      }

      verificationAttemptLimits.set(userEmailKey, {
        attempts: currentAttempts,
        lockedUntil: null
      });

      const remaining = MAX_VERIFICATION_ATTEMPTS - currentAttempts;
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: `Invalid verification code or link. ${remaining} attempt(s) remaining.`
        },
        message: `Invalid verification code or link. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining
      });
    }

    // Verification succeeded: clear failed attempt tracker
    verificationAttemptLimits.delete(userEmailKey);

    // Mark verified in database and record initial login/presence
    await UserModel.markEmailVerified(user.email);
    await UserModel.updateLastLogin(user.id).catch(() => null);

    // Evict cached user auth status
    const authMiddleware = require('../middleware/authMiddleware');
    if (authMiddleware.clearUserAuthCache) {
      authMiddleware.clearUserAuthCache(user.email);
      if (user.id) authMiddleware.clearUserAuthCache(user.id);
    }

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
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'This email address is already verified and active. Please sign in directly.'
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
      const verificationOtp = crypto.randomInt(100000, 1000000).toString();
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
      verificationAttemptLimits.delete(cleanEmail);

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
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'No account found with this email. Please register to create your workspace.'
        },
        message: 'No account found with this email. Please register to create your workspace.',
        requiresRegistration: true,
        suggestRegister: true,
        email: cleanEmail
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
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'This account has been deactivated. Please contact your organization administrator.'
        },
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
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password. Please verify your credentials and try again.'
        },
        message: 'Invalid email or password. Please verify your credentials and try again.'
      });
    }

    // 5. Check organization subscription & 14-day trial status
    const tenantRes = await tenantService.resolveAndAuthorizeOrganization(req, user);
    const orgId = tenantRes.organizationId || user.organization_id || null;
    if (orgId && !user.organization_id) {
      user.organization_id = orgId;
    }
    if (tenantRes.role) {
      user.role = tenantRes.role;
    }
    const memberships = await tenantService.getUserMemberships(user.id, user.email);
    let subscription = null;

    if (orgId) {
      subscription = await subscriptionService.getOrganizationSubscription(orgId);
    }
    const orgName = subscription?.organizationName || tenantRes.organization?.name || 'Workspace';

    // Prime subscription cache and ensure user auth cache is clean
    const authMiddleware = require('../middleware/authMiddleware');
    if (authMiddleware.clearUserAuthCache) {
      authMiddleware.clearUserAuthCache(user.email);
      if (user.id) authMiddleware.clearUserAuthCache(user.id);
    }
    if (subscriptionService.primeOrganizationCache && orgId && subscription) {
      subscriptionService.primeOrganizationCache(orgId, subscription);
    }

    // Update last login timestamp and presence synchronously on successful authentication
    await UserModel.updateLastLogin(user.id).catch(() => null);

    // Log audit event asynchronously
    setImmediate(() => {
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
        organizations: memberships.map(m => ({
          id: m.organization_id,
          name: m.organization_name,
          role: m.role,
          plan: m.plan,
          source: m.source
        })),
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

    const tenantRes = await tenantService.resolveAndAuthorizeOrganization(req, resolvedUser);
    const orgId = tenantRes.organizationId || resolvedUser.organization_id || null;
    const memberships = await tenantService.getUserMemberships(resolvedUser.id, resolvedUser.email);
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
        role: tenantRes.role || resolvedUser.role || 'viewer',
        organization_id: orgId,
        organization_name: subscription?.organizationName || tenantRes.organization?.name || 'Workspace',
        organizations: memberships.map(m => ({
          id: m.organization_id,
          name: m.organization_name,
          role: m.role,
          plan: m.plan,
          source: m.source
        })),
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
      return res.status(400).json({ 
        success: false, 
        error: { code: 'INVALID_TOKEN', message: 'Invitation token is required.' },
        message: 'Invitation token is required.' 
      });
    }

    const invitation = await InvitationModel.findByToken(token);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: { code: 'INVITATION_NOT_FOUND', message: 'Invitation not found or invalid link.' },
        message: 'Invitation not found or invalid.'
      });
    }

    if (invitation.status === 'revoked') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVITATION_REVOKED', message: 'This invitation has been revoked by an administrator.' },
        message: 'This invitation has been revoked by an administrator.'
      });
    }

    if (invitation.status === 'accepted') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVITATION_ALREADY_USED', message: 'This invitation has already been accepted.' },
        message: 'This invitation has already been accepted.'
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVITATION_INVALID', message: `This invitation is no longer valid (status: ${invitation.status}).` },
        message: `This invitation is no longer valid (status: ${invitation.status}).`
      });
    }

    if (new Date() > new Date(invitation.expires_at)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVITATION_EXPIRED', message: 'This invitation has expired. Please ask your administrator to send a new invite.' },
        message: 'This invitation has expired. Please ask your administrator to send a new invite.'
      });
    }

    const existingUser = await UserModel.findByEmail(invitation.email.toLowerCase());

    return res.status(200).json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organizationId: invitation.organization_id,
        organization_id: invitation.organization_id,
        organizationName: invitation.organization_name,
        organization_name: invitation.organization_name,
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
 * Enforces organization-specific invitation acceptance inside an atomic transaction:
 * - Authoritative destination organization and role resolved solely from database invitation record.
 * - Single transaction guarantees invitation status update and user assignment are atomic.
 * - Never trusts client-supplied organization ID or role.
 * - Prevents cross-organization hijacking, token replay, and preserves organization owners.
 */
const acceptInvite = async (req, res, next) => {
  try {
    const { token, name, password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invitation token is required.' },
        message: 'Invitation token is required.'
      });
    }

    // Resolve optional authenticated user from session or Bearer header
    let authenticatedUser = req.user || null;
    if (!authenticatedUser && req.headers && req.headers['authorization']) {
      try {
        const authHeader = req.headers['authorization'];
        if (authHeader.startsWith('Bearer ')) {
          const jwtToken = authHeader.substring(7).trim();
          const decoded = jwt.verify(jwtToken, config.jwtSecret);
          if (decoded && decoded.email) {
            authenticatedUser = decoded;
          }
        }
      } catch (_) {}
    }

    // Execute atomic acceptance transaction
    const { user, invitation } = await InvitationModel.acceptInTransaction({
      token,
      name,
      password,
      authenticatedUser
    });

    // Invalidate subscription cache so accepted seat is accounted for immediately
    subscriptionService.clearOrganizationCache(invitation.organization_id);

    // Clear user auth cache
    const authMiddleware = require('../middleware/authMiddleware');
    if (authMiddleware.clearUserAuthCache) {
      authMiddleware.clearUserAuthCache(user.email);
      if (user.id) authMiddleware.clearUserAuthCache(user.id);
    }

    // Audit log
    await logAuditEvent({
      organizationId: invitation.organization_id,
      userId: user.id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      resourceType: 'auth',
      resourceId: user.id,
      description: `User ${user.email} accepted invitation and joined ${invitation.organization_name} as ${invitation.role}`,
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
    if (err.code && (err.code.startsWith('INVITATION_') || err.code === 'INVALID_CREDENTIALS' || err.code === 'RESOURCE_LIMIT_EXCEEDED' || err.code === 'INVALID_PASSWORD' || err.code === 'INVALID_TOKEN' || err.code === 'OWNER_CANNOT_TRANSFER')) {
      return res.status(err.statusCode || 400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message
        },
        message: err.message
      });
    }
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Terminate user session and revoke JWT token
 */
const logout = async (req, res, next) => {
  try {
    let userId = req.user?.id || null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1].trim();
      tokenBlacklist.revoke(token);
      if (!userId) {
        try {
          const decoded = jwt.decode(token);
          if (decoded?.id) userId = decoded.id;
        } catch (_) {}
      }
    }

    // Stop online presence immediately upon logout
    if (userId) {
      await UserModel.clearLastActive(userId).catch(() => null);
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
 * POST /api/auth/heartbeat
 * Lightweight authenticated heartbeat to keep user presence active
 */
const heartbeat = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required for heartbeat.'
      });
    }

    // Deactivated status overrides all presence signals
    if (req.user.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated.'
      });
    }

    const updated = await UserModel.updateLastActive(req.user.id);
    return res.status(200).json({
      success: true,
      timestamp: updated?.last_active_at || new Date().toISOString()
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
  heartbeat,
  forgotPassword,
  verifyResetToken,
  resetPassword
};
