const demoRequestModel = require('../models/demoRequestModel');
const emailService = require('../services/emailService');

// In-memory rate limiting map for test-email endpoint (ip -> [timestamps])
const testEmailRateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TEST_EMAILS_PER_WINDOW = 5;

/**
 * Enterprise Demo Request Controller
 * Handles validation, Supabase & DB persistence, and email dispatch to the Ricoz team.
 */
class DemoRequestController {
  /**
   * Handle Inbound Enterprise Demo Request Submission
   * POST /api/demo-request or POST /api/demo-requests
   */
  async submitDemoRequest(req, res) {
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
        notes
      } = req.body || {};

      const resolvedName = (fullName || name || '').trim();
      const resolvedEmail = (workEmail || email || '').trim();
      const resolvedCompany = (company || '').trim();
      const resolvedTeamSize = (teamSize || '').trim();
      const resolvedDataSource = (primaryDataSource || 'PostgreSQL').trim();
      const resolvedPhone = (phone || '').trim();
      const resolvedNotes = (notes || '').trim();

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

      // 2. Persist in Supabase and Database layer
      const createdRecord = await demoRequestModel.createDemoRequest({
        fullName: resolvedName,
        workEmail: resolvedEmail,
        company: resolvedCompany,
        teamSize: resolvedTeamSize,
        primaryDataSource: resolvedDataSource,
        phone: resolvedPhone || null,
        notes: resolvedNotes || null,
        metadata: {
          ip: req.ip || req.headers['x-forwarded-for'] || null,
          userAgent: req.headers['user-agent'] || null,
          origin: req.headers.origin || req.headers.referer || null,
          timestamp: new Date().toISOString()
        }
      });

      // 3. Dispatch Email Notification & Prospect Confirmation
      console.log(`[DemoRequestController] Processing inquiry for "${resolvedName}" <${resolvedEmail}> (${resolvedCompany})`);
      const emailResult = await emailService.sendDemoRequestEmail({
        fullName: resolvedName,
        workEmail: resolvedEmail,
        company: resolvedCompany,
        teamSize: resolvedTeamSize,
        primaryDataSource: resolvedDataSource,
        phone: resolvedPhone || null,
        notes: resolvedNotes || null,
        requestedAt: createdRecord.created_at || new Date()
      });

      if (emailResult.attempted && !emailResult.success) {
        console.error(`[DemoRequestController] ❌ Email dispatch failed for inquiry [${createdRecord.id}]:`, emailResult.error);
      } else if (emailResult.success) {
        console.log(`[DemoRequestController] ✅ Email dispatched for inquiry [${createdRecord.id}] (Message ID: ${emailResult.messageId})`);
      } else {
        console.warn(`[DemoRequestController] ⚠️ Email dispatch skipped for inquiry [${createdRecord.id}] — SMTP not configured.`);
      }

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
            attempted: emailResult.attempted || false,
            success: emailResult.success || false,
            recipient: emailResult.recipient || 'care@ricoz.in',
            messageId: emailResult.messageId || null,
            prospect_confirmation: emailResult.prospectConfirmation || null,
            note: !emailResult.attempted ? 'SMTP transport unconfigured in environment' : undefined
          },
          supabase_stored: createdRecord.supabase_stored || false
        }
      });
    } catch (error) {
      console.error('[DemoRequestController] ❌ Error handling demo request submission:', error);
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
}

module.exports = new DemoRequestController();
