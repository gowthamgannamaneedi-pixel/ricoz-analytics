const crypto = require('crypto');
const demoRequestModel = require('../models/demoRequestModel');
const UserModel = require('../models/userModel');
const db = require('../config/database');
const emailService = require('../services/emailService');
const demoEmailQueueService = require('../services/demoEmailQueueService');

// In-memory rate limiting map for test-email endpoint (ip -> [timestamps])
const testEmailRateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TEST_EMAILS_PER_WINDOW = 5;

/**
 * Enterprise Demo Request Controller
 * Handles validation, fast DB persistence, durable background email queueing, and status checks.
 */
class DemoRequestController {
  /**
   * Handle Inbound Enterprise Demo Request Submission
   * POST /api/demo-request or POST /api/demo-requests
   */
  async submitDemoRequest(req, res) {
    const tStart = performance.now();
    try {
      const {
        fullName,
        name,
        workEmail,
        email,
        company,
        teamSize,
        primaryDataSource,
        phone,
        notes,
        idempotencyKey
      } = req.body || {};

      const resolvedName = (fullName || name || '').trim();
      const resolvedEmail = (workEmail || email || '').trim();
      const resolvedCompany = (company || '').trim();
      const resolvedTeamSize = (teamSize || '').trim();
      const resolvedDataSource = (primaryDataSource || 'PostgreSQL').trim();
      const resolvedPhone = (phone || '').trim();
      const resolvedNotes = (notes || '').trim();
      const resolvedIdempotency = (idempotencyKey || req.headers['x-idempotency-key'] || '').trim();

      console.log(`[DemoRequestController] [Timing] 📥 Incoming request received for: "${resolvedEmail}"`);

      // 1. Rigorous Field Validation
      if (!resolvedName || resolvedName.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid full name.'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!resolvedEmail || !emailRegex.test(resolvedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid work email address.'
        });
      }

      if (!resolvedCompany || resolvedCompany.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Please provide your company or organization name.'
        });
      }

      if (!resolvedTeamSize) {
        return res.status(400).json({
          success: false,
          message: 'Please select your team or branch size.'
        });
      }

      if (!resolvedDataSource) {
        return res.status(400).json({
          success: false,
          message: 'Please select your primary data source.'
        });
      }

      const tVal = Math.round(performance.now() - tStart);

      // 2. Persist in Database layer with duplicate protection
      const tDbStart = performance.now();
      const createdRecord = await demoRequestModel.createDemoRequest({
        fullName: resolvedName,
        workEmail: resolvedEmail,
        company: resolvedCompany,
        teamSize: resolvedTeamSize,
        primaryDataSource: resolvedDataSource,
        phone: resolvedPhone || null,
        notes: resolvedNotes || null,
        idempotencyKey: resolvedIdempotency || null,
        metadata: {
          ip: req.ip || req.headers['x-forwarded-for'] || null,
          userAgent: req.headers['user-agent'] || null,
          origin: req.headers.origin || req.headers.referer || null,
          timestamp: new Date().toISOString()
        }
      });
      const tDb = Math.round(performance.now() - tDbStart);

      // Handle duplicate submission
      if (createdRecord.isDuplicate) {
        const tTotal = Math.round(performance.now() - tStart);
        console.log(`[DemoRequestController] [Timing] ℹ️ Returning existing record for duplicate submission in ${tTotal}ms`);
        return res.status(200).json({
          success: true,
          isDuplicate: true,
          message: 'Thanks! Your demo request has already been securely received. Our team will contact you shortly.',
          data: {
            id: createdRecord.id,
            fullName: createdRecord.full_name,
            workEmail: createdRecord.work_email,
            company: createdRecord.company,
            created_at: createdRecord.created_at,
            processing_time_ms: tTotal
          }
        });
      }

      // 3. Decouple Email Delivery — Enqueue durable background job
      const tQueueStart = performance.now();
      const recipientEmail = process.env.SMTP_FROM || process.env.DEMO_REQUEST_EMAIL || process.env.SMTP_USER || 'ricozanalytics@gmail.com';
      const queueResult = await demoEmailQueueService.enqueueJob({
        demoRequestId: createdRecord.id,
        recipient: recipientEmail,
        prospectEmail: resolvedEmail,
        payload: {
          fullName: resolvedName,
          workEmail: resolvedEmail,
          company: resolvedCompany,
          teamSize: resolvedTeamSize,
          primaryDataSource: resolvedDataSource,
          phone: resolvedPhone || null,
          notes: resolvedNotes || null,
          requestedAt: createdRecord.created_at || new Date()
        }
      });
      const tQueue = Math.round(performance.now() - tQueueStart);

      const totalTime = Math.round(performance.now() - tStart);
      console.log(`[DemoRequestController] [Timing] ⚡ Response ready in ${totalTime}ms (Validation: ${tVal}ms, DB: ${tDb}ms, Enqueue: ${tQueue}ms)`);

      // 4. Return fast response to client immediately
      return res.status(201).json({
        success: true,
        message: 'Thanks! Your demo request has been received. The Ricoz team will contact you shortly.',
        data: {
          id: createdRecord.id,
          fullName: createdRecord.full_name,
          workEmail: createdRecord.work_email,
          company: createdRecord.company,
          teamSize: createdRecord.team_size,
          primaryDataSource: createdRecord.primary_data_source,
          created_at: createdRecord.created_at,
          email_delivery: {
            status: 'queued',
            jobId: queueResult.jobId,
            provider: emailService.getProvider(),
            recipient: recipientEmail,
            prospect_recipient: resolvedEmail
          },
          supabase_stored: createdRecord.supabase_stored || false,
          processing_time_ms: totalTime
        }
      });
    } catch (error) {
      const totalTime = Math.round(performance.now() - tStart);
      console.error(`[DemoRequestController] ❌ Error handling demo request submission after ${totalTime}ms:`, error);
      return res.status(500).json({
        success: false,
        message: 'Something went wrong while submitting your request. Please try again.'
      });
    }
  }

  /**
   * Safe SMTP Status & Diagnostics
   * GET /api/demo-request/smtp-status
   */
  async getSmtpStatus(req, res) {
    try {
      const status = emailService.getSmtpStatus();
      return res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Background Email Queue Diagnostics
   * GET /api/demo-request/queue-status
   */
  async getQueueStatus(req, res) {
    try {
      const stats = await demoEmailQueueService.getQueueStats();
      return res.status(200).json({
        success: true,
        queue: stats
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Retry failed queue jobs
   * POST /api/demo-request/retry-jobs
   */
  async retryQueue(req, res) {
    try {
      const result = await demoEmailQueueService.retryFailedJobs();
      return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Test SMTP Connection Verification (Handshake only)
   * POST /api/demo-request/verify-smtp
   */
  async verifySmtp(req, res) {
    try {
      const result = await emailService.verifyConnection();
      return res.status(result.success ? 200 : 503).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Safe Diagnostic Test Email Endpoint
   * POST /api/demo-request/test-email
   * Sends a single test email to the specified recipient with rate limiting & zero credential exposure.
   */
  async sendTestEmail(req, res) {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      // Rate limit check
      const windowStart = now - RATE_LIMIT_WINDOW_MS;
      let timestamps = testEmailRateLimits.get(clientIp) || [];
      timestamps = timestamps.filter(ts => ts > windowStart);

      if (timestamps.length >= MAX_TEST_EMAILS_PER_WINDOW) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded: maximum ${MAX_TEST_EMAILS_PER_WINDOW} test emails allowed per 10 minutes. Please wait before retrying.`
          }
        });
      }

      const { recipient, subject } = req.body || {};
      const targetRecipient = (recipient || '').trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!targetRecipient || !emailRegex.test(targetRecipient)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RECIPIENT',
            message: 'Please provide a valid recipient email address in request body: { recipient: "you@example.com" }'
          }
        });
      }

      // Record rate limit hit
      timestamps.push(now);
      testEmailRateLimits.set(clientIp, timestamps);

      console.log(`[DemoRequestController] Test email requested for recipient: ${targetRecipient} from IP: ${clientIp}`);

      const result = await emailService.sendTestEmail({
        recipient: targetRecipient,
        subject: subject || 'RicozAnalytics SMTP Test Verification'
      });

      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'EMAIL_DELIVERY_FAILED',
            message: result.error || 'Failed to dispatch test email',
            provider: result.provider
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: `Test email successfully sent to ${targetRecipient}`,
        data: {
          recipient: result.recipient,
          provider: result.provider,
          messageId: result.messageId,
          smtpResponse: result.response,
          deliveredAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[DemoRequestController] ❌ Error in sendTestEmail endpoint:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * List demo requests (Internal / Admin)
   * GET /api/demo-requests
   */
  async listDemoRequests(req, res) {
    try {
      const { limit, offset } = req.query;
      const requests = await demoRequestModel.listDemoRequests({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0
      });

      return res.status(200).json({
        success: true,
        count: requests.length,
        data: requests
      });
    } catch (error) {
      console.error(' Error listing demo requests:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve demo requests'
      });
    }
  }

  /**
   * Safe Diagnostic Brevo Transactional Logs Endpoint
   * GET /api/demo-request/brevo-logs
   * Inspect Brevo transactional email logs, events (accepted, delivered, bounced, blocked, deferred)
   */
  async getBrevoLogs(req, res) {
    try {
      const email = req.query.email || '';
      const messageId = req.query.messageId || '';
      const limit = parseInt(req.query.limit, 10) || 20;
      const event = req.query.event || '';

      const logs = await emailService.getBrevoTransactionalLogs({ email, messageId, limit, event });
      return res.status(200).json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('[DemoRequestController] ❌ Error querying Brevo transactional logs:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'BREVO_LOGS_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * Diagnostic user account status check (never logs OTP or password)
   * GET /api/demo-request/user-status?email=...
   */
  async getUserStatus(req, res) {
    try {
      const email = req.query.email ? req.query.email.trim().toLowerCase() : null;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email query parameter is required' });
      }
      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(200).json({
          success: true,
          userExists: false,
          email
        });
      }
      return res.status(200).json({
        success: true,
        userExists: true,
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
          hasOtp: Boolean(user.verification_otp),
          hasToken: Boolean(user.verification_token),
          expiresAt: user.verification_token_expires_at,
          isExpired: user.verification_token_expires_at ? (new Date() > new Date(user.verification_token_expires_at)) : null,
          emailVerifiedAt: user.email_verified_at,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Reset user to pending_verification and dispatch fresh OTP via Brevo
   * POST /api/demo-request/reset-user-verification
   */
  async resetUserVerification(req, res) {
    try {
      const email = req.body.email ? req.body.email.trim().toLowerCase() : null;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required in request body' });
      }
      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, message: `User "${email}" not found` });
      }

      // 1. Reset user status in PostgreSQL to pending_verification
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.query(
        `UPDATE users 
         SET status = 'pending_verification', 
             email_verified_at = NULL, 
             verification_token = $1, 
             verification_otp = $2, 
             verification_token_expires_at = $3, 
             updated_at = NOW() 
         WHERE LOWER(email) = LOWER($4)`,
        [verificationToken, verificationOtp, tokenExpiresAt, email]
      );

      // 2. Dispatch verification email via Brevo
      const verifyUrl = `https://ricoz-analytics.vercel.app/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      const emailResult = await emailService.sendVerificationEmail({
        email,
        name: user.name,
        token: verificationToken,
        otp: verificationOtp,
        verifyUrl
      });

      console.log(`[DemoRequestController] [SafeDiagnostic]`, JSON.stringify({
        timestamp: new Date().toISOString(),
        flow: 'Reset User Verification',
        provider: emailResult.provider || 'Brevo',
        httpStatus: emailResult.success ? 200 : 502,
        brevoMessageId: emailResult.messageId || null,
        error: emailResult.error || null
      }));

      return res.status(200).json({
        success: true,
        message: emailResult.success
          ? `User "${email}" reset to pending_verification and fresh OTP dispatched via Brevo.`
          : `User "${email}" reset to pending_verification, but email dispatch failed.`,
        user: {
          id: user.id,
          email: user.email,
          status: 'pending_verification',
          expiresAt: tokenExpiresAt
        },
        email_delivery: {
          attempted: emailResult.attempted,
          success: emailResult.success,
          provider: emailResult.provider || 'Brevo',
          recipient: email,
          messageId: emailResult.messageId || null,
          error: emailResult.error || null
        }
      });
    } catch (err) {
      console.error('[DemoRequestController] ❌ Error in resetUserVerification:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Admin database purge: keeps only admin@ricoz.test and ricoz@admin.test, purges all other accounts
   * POST /api/demo-request/cleanup-accounts
   */
  async cleanupAccounts(req, res) {
    try {
      const crypto = require('crypto');
      const bcrypt = require('bcryptjs');
      const defaultPasswordHash = bcrypt.hashSync('admin123', 10);

      // 1. Ensure admin@ricoz.test exists and is updated to completely fresh state
      const check1 = await db.query("SELECT id, organization_id FROM users WHERE LOWER(email) = 'admin@ricoz.test' LIMIT 1");
      let orgId = '00000000-0000-0000-0000-000000000001';

      if (check1.rows.length === 0) {
        try {
          await db.query(`
            INSERT INTO users (
              name, email, password_hash, role, organization_id, status,
              verification_token, verification_otp, verification_token_expires_at,
              reset_password_token, reset_password_expires_at, email_verified_at,
              last_login_at, created_at, updated_at
            )
            VALUES (
              'Gowtham (Admin)', 'admin@ricoz.test', $1, 'admin', $2, 'active',
              NULL, NULL, NULL,
              NULL, NULL, NOW(),
              NULL, NOW(), NOW()
            )
          `, [defaultPasswordHash, orgId]);
        } catch (e1) {
          const newAdminId = crypto.randomUUID ? crypto.randomUUID() : '1';
          await db.query(`
            INSERT INTO users (
              id, name, email, password_hash, role, organization_id, status,
              verification_token, verification_otp, verification_token_expires_at,
              reset_password_token, reset_password_expires_at, email_verified_at,
              last_login_at, created_at, updated_at
            )
            VALUES (
              $1, 'Gowtham (Admin)', 'admin@ricoz.test', $2, 'admin', $3, 'active',
              NULL, NULL, NULL,
              NULL, NULL, NOW(),
              NULL, NOW(), NOW()
            )
          `, [newAdminId, defaultPasswordHash, orgId]);
        }
      } else {
        if (check1.rows[0].organization_id) {
          orgId = check1.rows[0].organization_id;
        }
        await db.query(`
          UPDATE users 
          SET 
            name = 'Gowtham (Admin)',
            role = 'admin',
            status = 'active',
            password_hash = $1,
            organization_id = $2,
            verification_token = NULL,
            verification_otp = NULL,
            verification_token_expires_at = NULL,
            reset_password_token = NULL,
            reset_password_expires_at = NULL,
            email_verified_at = NOW(),
            last_login_at = NULL,
            updated_at = NOW()
          WHERE LOWER(email) = 'admin@ricoz.test'
        `, [defaultPasswordHash, orgId]);
      }

      // 2. Ensure Primary Organization is active and enterprise
      try {
        await db.query(`
          UPDATE organizations 
          SET plan = 'enterprise', subscription_status = 'active', payment_status = 'paid', updated_at = NOW()
          WHERE id = $1
        `, [orgId]);
      } catch (eOrg) {
        console.warn('[DemoRequestController] Notice updating organization:', eOrg.message);
      }

      // 3. Find all user accounts to delete (EVERYTHING except admin@ricoz.test)
      const usersToDelete = await db.query(
        "SELECT id, email FROM users WHERE LOWER(email) != 'admin@ricoz.test'"
      );

      let deletedCount = 0;
      if (usersToDelete.rows.length > 0) {
        // Delete child dataset_rows for non-admin datasets
        try {
          await db.query(`
            DELETE FROM dataset_rows 
            WHERE dataset_id IN (
              SELECT id FROM datasets 
              WHERE user_id IN (
                SELECT id FROM users WHERE LOWER(email) != 'admin@ricoz.test'
              )
            )
          `);
        } catch (e) {
          console.warn('[DemoRequestController] Warning cleaning up dataset_rows:', e.message);
        }

        // Delete datasets owned by non-admin users
        try {
          await db.query(`
            DELETE FROM datasets 
            WHERE user_id IN (
              SELECT id FROM users WHERE LOWER(email) != 'admin@ricoz.test'
            )
          `);
        } catch (e) {
          console.warn('[DemoRequestController] Warning cleaning up datasets:', e.message);
        }

        // Delete all non-admin registrations
        const delRes = await db.query(
          "DELETE FROM users WHERE LOWER(email) != 'admin@ricoz.test'"
        );
        deletedCount = delRes.rowCount;
      }

      // 4. Purge invitations and test organizations
      try {
        await db.query("DELETE FROM invitations");
      } catch (_) {}

      try {
        await db.query(`
          DELETE FROM organizations 
          WHERE id != $1 AND id NOT IN (
            SELECT organization_id FROM users WHERE organization_id IS NOT NULL
          )
        `, [orgId]);
      } catch (_) {}

      // 5. Retrieve remaining users (Strictly ONLY admin@ricoz.test)
      const remaining = await db.query("SELECT id, name, email, role, status, email_verified_at, updated_at FROM users ORDER BY id ASC");

      return res.status(200).json({
        success: true,
        message: `Fresh registration purge complete. Deleted ${deletedCount} user registrations. Only admin@ricoz.test remains in fresh active state.`,
        deletedCount,
        remainingUsers: remaining.rows
      });
    } catch (err) {
      console.error('[DemoRequestController] ❌ Error in cleanupAccounts:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Diagnostic verification of password reset URL generation in current environment
   * GET /api/demo-request/verify-reset-url?email=...
   */
  async verifyResetUrl(req, res) {
    try {
      const email = (req.query.email || 'admin@ricoz.test').trim().toLowerCase();
      const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
      const clientBaseUrl = emailService.getClientBaseUrl();
      const mockToken = 'diagnostic_token_preview';
      const sampleUrl = emailService.sanitizeUrlForProduction(null, `/reset-password?token=${mockToken}&email=${encodeURIComponent(email)}`);
      const containsLocalhost = sampleUrl.includes('localhost') || sampleUrl.includes('127.0.0.1');

      return res.status(200).json({
        success: true,
        environment: {
          nodeEnv: process.env.NODE_ENV || 'development',
          isProduction: isProd,
          clientUrlEnv: process.env.CLIENT_URL || null,
          resolvedBaseUrl: clientBaseUrl
        },
        urlVerification: {
          sampleUrl,
          domain: new URL(sampleUrl).origin,
          containsLocalhost,
          isHttps: sampleUrl.startsWith('https://'),
          preservesToken: sampleUrl.includes(`token=${mockToken}`),
          preservesEmail: sampleUrl.includes(`email=${encodeURIComponent(email)}`)
        }
      });
    } catch (err) {
      console.error('[DemoRequestController] ❌ Error in verifyResetUrl:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new DemoRequestController();


