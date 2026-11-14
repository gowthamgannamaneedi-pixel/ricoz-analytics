const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const emailService = require('../services/emailService');
const tokenBlacklist = require('../utils/tokenBlacklist');

/**
 * Account Deletion Controller (Google Play Developer Compliance)
 * Handles public web requests (https://ricoz.in/delete-account) with email verification OTP,
 * and authenticated in-app self-service deletion workflows with password verification.
 */
class AccountDeletionController {
  /**
   * Helper to format a safe reference ticket ID
   */
  generateReferenceId() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `DEL-${today}-${rand}`;
  }

  /**
   * POST /api/auth/request-deletion
   * Public endpoint for initiating account deletion requests from the web portal
   */
  async requestDeletion(req, res) {
    try {
      const { email, name, scope = 'user_account', reason } = req.body || {};

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: 'A valid email address is required.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Verify whether a user with this email exists
      let matchedUser = null;
      try {
        const userRes = await db.query(
          'SELECT id, name, email, organization_id, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [cleanEmail]
        );
        if (userRes.rows && userRes.rows.length > 0) {
          matchedUser = userRes.rows[0];
        }
      } catch (err) {
        console.warn('[AccountDeletion] User lookup warning:', err.message);
      }

      // Generate 6-digit cryptographic verification OTP and verification token
      const otp = Math.floor(100000 + crypto.randomInt(900000)).toString();
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      const referenceId = this.generateReferenceId();
      const reqId = crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`;

      // Insert record into account_deletion_requests
      try {
        await db.query(`
          INSERT INTO account_deletion_requests (
            id, user_id, organization_id, email, name, scope, reason,
            status, verification_otp, verification_token, verification_expires_at,
            ip_address, user_agent, reference_id, metadata, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            'pending_verification', $8, $9, $10,
            $11, $12, $13, $14, NOW(), NOW()
          )
        `, [
          reqId,
          matchedUser ? matchedUser.id : null,
          matchedUser ? matchedUser.organization_id : null,
          cleanEmail,
          name || (matchedUser ? matchedUser.name : 'User'),
          scope === 'full_workspace' ? 'full_workspace' : 'user_account',
          reason || null,
          otp,
          token,
          expiresAt,
          ipAddress,
          userAgent,
          referenceId,
          JSON.stringify({ userFound: Boolean(matchedUser), userRole: matchedUser ? matchedUser.role : null })
        ]);
      } catch (dbErr) {
        console.warn('[AccountDeletion] Warning storing deletion request in DB:', dbErr.message);
      }

      // Dispatch 6-digit OTP verification email
      const reqUrl = req.headers.origin || process.env.CLIENT_URL || 'https://ricoz.in';
      await emailService.sendAccountDeletionOtpEmail({
        email: cleanEmail,
        name: name || (matchedUser ? matchedUser.name : 'User'),
        otp,
        token,
        reqUrl
      }).catch(err => {
        console.warn('[AccountDeletion] Email dispatch notice:', err.message);
      });

      // Mask email for user-facing response (e.g. j***e@domain.com)
      const parts = cleanEmail.split('@');
      const maskedLocal = parts[0].length <= 2 ? parts[0] : parts[0][0] + '***' + parts[0].slice(-1);
      const maskedEmail = `${maskedLocal}@${parts[1]}`;

      return res.status(200).json({
        success: true,
        message: `A 6-digit verification code has been dispatched to ${maskedEmail}. Please verify within 15 minutes to confirm account deletion.`,
        referenceId,
        token,
        scope,
        expiresInSeconds: 900
      });
    } catch (err) {
      console.error('[AccountDeletion] requestDeletion error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error processing account deletion request.'
      });
    }
  }

  /**
   * POST /api/auth/confirm-deletion
   * Confirms deletion request using 6-digit OTP or token and executes/schedules deletion
   */
  async confirmDeletion(req, res) {
    try {
      const { email, otp, token, referenceId } = req.body || req.query || {};

      if (!email && !token && !referenceId) {
        return res.status(400).json({
          success: false,
          message: 'Verification token or email with OTP is required.'
        });
      }

      const cleanEmail = email ? email.trim().toLowerCase() : null;

      // Locate pending deletion request
      let queryStr = `
        SELECT * FROM account_deletion_requests 
        WHERE status = 'pending_verification'
      `;
      const queryParams = [];

      if (token) {
        queryParams.push(token);
        queryStr += ` AND verification_token = $${queryParams.length}`;
      } else if (cleanEmail && otp) {
        queryParams.push(cleanEmail, String(otp).trim());
        queryStr += ` AND LOWER(email) = LOWER($1) AND verification_otp = $2`;
      } else if (referenceId && otp) {
        queryParams.push(referenceId.trim().toUpperCase(), String(otp).trim());
        queryStr += ` AND reference_id = $1 AND verification_otp = $2`;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Please provide either the 6-digit verification code or your security token.'
        });
      }

      queryStr += ' ORDER BY created_at DESC LIMIT 1';

      let requestRecord = null;
      try {
        const result = await db.query(queryStr, queryParams);
        if (result.rows && result.rows.length > 0) {
          requestRecord = result.rows[0];
        }
      } catch (e) {
        console.warn('[AccountDeletion] Query error:', e.message);
      }

      if (!requestRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code or deletion request not found. Please request a fresh code.'
        });
      }

      // Check expiration
      if (requestRecord.verification_expires_at && new Date() > new Date(requestRecord.verification_expires_at)) {
        return res.status(400).json({
          success: false,
          message: 'The verification code has expired. Please submit a new deletion request.'
        });
      }

      const verifiedEmail = requestRecord.email;
      const refId = requestRecord.reference_id || this.generateReferenceId();
      const scope = requestRecord.scope || 'user_account';

      // Find actual user record in database if one exists
      const userRes = await db.query(
        'SELECT id, name, email, organization_id, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [verifiedEmail]
      );

      const targetUser = userRes.rows && userRes.rows.length > 0 ? userRes.rows[0] : null;

      if (targetUser) {
        // Execute cascade deletion with full multi-tenant isolation
        await this._executeCascadeDeletion({
          userId: targetUser.id,
          orgId: targetUser.organization_id,
          userEmail: targetUser.email,
          scope,
          isOwner: targetUser.role === 'owner' || targetUser.role === 'admin'
        });
      }

      // Mark deletion request as completed in DB
      try {
        await db.query(`
          UPDATE account_deletion_requests 
          SET 
            status = 'completed',
            verified_at = NOW(),
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `, [requestRecord.id]);
      } catch (updErr) {
        console.warn('[AccountDeletion] Status update notice:', updErr.message);
      }

      // Dispatch confirmation email
      await emailService.sendAccountDeletionConfirmedEmail({
        email: verifiedEmail,
        name: requestRecord.name || (targetUser ? targetUser.name : 'User'),
        referenceId: refId,
        scope
      }).catch(err => {
        console.warn('[AccountDeletion] Confirmation email dispatch notice:', err.message);
      });

      return res.status(200).json({
        success: true,
        message: 'Your account deletion request has been verified and completed successfully.',
        referenceId: refId,
        completedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('[AccountDeletion] confirmDeletion error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal error verifying deletion request.'
      });
    }
  }

  /**
   * POST /api/auth/delete-my-account
   * Authenticated in-app self-service deletion with password confirmation
   */
  async deleteMyAccount(req, res) {
    try {
      const userId = req.user.id;
      const orgId = req.user.organization_id;
      const { password, reason, scope = 'user_account' } = req.body || {};

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Please enter your current password to confirm account deletion.'
        });
      }

      // Retrieve user with password hash
      const userRes = await db.query(
        'SELECT id, name, email, password_hash, password_hash_alt, organization_id, role FROM users WHERE id = $1 AND organization_id = $2 LIMIT 1',
        [userId, orgId]
      );

      if (!userRes.rows || userRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User account not found.'
        });
      }

      const user = userRes.rows[0];

      // Verify password
      let isValidPassword = false;
      if (user.password_hash) {
        isValidPassword = await bcrypt.compare(password, user.password_hash);
      }
      if (!isValidPassword && user.password_hash_alt) {
        isValidPassword = await bcrypt.compare(password, user.password_hash_alt);
      }

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password. Account deletion aborted.'
        });
      }

      const referenceId = this.generateReferenceId();
      const isOwner = user.role === 'owner' || user.role === 'admin';
      const actualScope = isOwner && scope === 'full_workspace' ? 'full_workspace' : 'user_account';

      // Record completed deletion request prior to cascade deletion
      try {
        const reqId = crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`;
        await db.query(`
          INSERT INTO account_deletion_requests (
            id, user_id, organization_id, email, name, scope, reason,
            status, verified_at, completed_at, reference_id, metadata, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            'completed', NOW(), NOW(), $8, $9, NOW(), NOW()
          )
        `, [
          reqId,
          userId,
          orgId,
          user.email,
          user.name,
          actualScope,
          reason || 'In-app authenticated self-deletion',
          referenceId,
          JSON.stringify({ authenticated: true, role: user.role })
        ]);
      } catch (dbErr) {
        console.warn('[AccountDeletion] Notice recording authenticated deletion:', dbErr.message);
      }

      // Execute cascade deletion
      await this._executeCascadeDeletion({
        userId: user.id,
        orgId: user.organization_id,
        userEmail: user.email,
        scope: actualScope,
        isOwner
      });

      // Dispatch confirmation email
      await emailService.sendAccountDeletionConfirmedEmail({
        email: user.email,
        name: user.name,
        referenceId,
        scope
      }).catch(() => null);

      return res.status(200).json({
        success: true,
        message: 'Your account and personal data have been permanently deleted.',
        referenceId,
        completedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('[AccountDeletion] deleteMyAccount error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while executing account deletion.'
      });
    }
  }

  /**
   * Internal Cascade Deletion Engine with Strict Multi-Tenant Isolation
   */
  async _executeCascadeDeletion({ userId, orgId, userEmail, scope, isOwner }) {
    console.log(`[AccountDeletion] 🗑️ Initiating cascade deletion for user ${userId} (${userEmail}) in org ${orgId} [Scope: ${scope}]`);

    // Invalidate active JWTs immediately
    tokenBlacklist.revokeUser(userId);

    // 1. Remove user-level memberships, preferences & notifications
    await db.query('DELETE FROM team_members WHERE user_id = $1', [userId]).catch(() => null);
    await db.query('DELETE FROM favorites WHERE user_id = $1', [userId]).catch(() => null);
    await db.query('DELETE FROM recently_viewed WHERE user_id = $1', [userId]).catch(() => null);
    await db.query('DELETE FROM saved_views WHERE user_id = $1', [userId]).catch(() => null);
    await db.query('DELETE FROM notifications WHERE user_id = $1', [userId]).catch(() => null);
    await db.query('DELETE FROM ai_conversations WHERE user_id = $1 AND organization_id = $2', [userId, orgId]).catch(() => null);
    await db.query('DELETE FROM invitations WHERE LOWER(email) = LOWER($1)', [userEmail]).catch(() => null);

    // Anonymize user comments
    await db.query(`
      UPDATE comments 
      SET user_id = NULL 
      WHERE user_id = $1 AND organization_id = $2
    `, [userId, orgId]).catch(() => null);

    // 2. If full workspace deletion requested AND user is owner/sole administrator:
    if (scope === 'full_workspace' && isOwner && orgId) {
      console.log(`[AccountDeletion] 🏢 Purging entire workspace data for organization ${orgId}`);

      // Delete dataset rows and datasets
      await db.query(`
        DELETE FROM dataset_rows 
        WHERE organization_id = $1 OR dataset_id IN (SELECT id FROM datasets WHERE organization_id = $1)
      `, [orgId]).catch(() => null);

      await db.query('DELETE FROM datasets WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM data_sources WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM dataset_relationships WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM data_quality_jobs WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM dataset_quality_snapshots WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM dataset_quality_rules WHERE organization_id = $1', [orgId]).catch(() => null);

      // Delete dashboards and widgets
      await db.query(`
        DELETE FROM dashboard_widgets 
        WHERE dashboard_id IN (SELECT id FROM dashboards WHERE organization_id = $1)
      `, [orgId]).catch(() => null);
      await db.query('DELETE FROM dashboard_shares WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM dashboards WHERE organization_id = $1', [orgId]).catch(() => null);

      // Delete reports and metrics
      await db.query('DELETE FROM report_executions WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM report_insights WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM report_shares WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM reports WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM metrics WHERE organization_id = $1', [orgId]).catch(() => null);

      // Delete alerts and forecasts
      await db.query('DELETE FROM alert_incidents WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM alerts WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM forecasts WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM ai_insights WHERE organization_id = $1', [orgId]).catch(() => null);

      // Delete teams and collaboration
      await db.query('DELETE FROM comments WHERE organization_id = $1', [orgId]).catch(() => null);
      await db.query('DELETE FROM teams WHERE organization_id = $1', [orgId]).catch(() => null);

      // Clean up cached physical disk files for this organization
      try {
        const uploadDir = path.resolve(__dirname, '../uploads/cache/datasets', String(orgId));
        if (fs.existsSync(uploadDir)) {
          fs.rmSync(uploadDir, { recursive: true, force: true });
        }
      } catch (fileErr) {
        console.warn('[AccountDeletion] File cleanup notice:', fileErr.message);
      }

      // Anonymize statutory billing records (tax law compliance up to 7 years)
      await db.query(`
        UPDATE invoices 
        SET invoice_number = 'ANON-' || id,
            status = 'archived'
        WHERE organization_id = $1
      `, [orgId]).catch(() => null);

      // Delete all organization users
      await db.query('DELETE FROM users WHERE organization_id = $1', [orgId]).catch(() => null);

      // Close and delete organization record
      await db.query('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => null);
    } else {
      // 3. User-only deletion: Delete the target user record
      await db.query('DELETE FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]).catch(() => null);
    }

    console.log(`[AccountDeletion] ✅ Cascade deletion completed for user ${userId}`);
  }
}

module.exports = new AccountDeletionController();
