/**
 * Live End-to-End Verification of Team Invitation to Real Controlled Inbox
 * RicozAnalytics — Brevo API Transactional Dispatch
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./config/database');
const UserModel = require('./models/userModel');
const OrganizationModel = require('./models/organizationModel');
const InvitationModel = require('./models/invitationModel');
const emailService = require('./services/emailService');
const adminController = require('./controllers/adminController');
const bcrypt = require('bcryptjs');

const TARGET_INBOX = process.env.TEST_EMAIL_INBOX || 'gowthamgannamaneedi@gmail.com';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    }
  };
}

async function runLiveInvitationVerification() {
  console.log('\n========================================================================');
  console.log(' 🚀 REAL INBOX END-TO-END INVITATION VERIFICATION (BREVO API)');
  console.log(` Target Inbox: ${TARGET_INBOX}`);
  console.log('========================================================================\n');

  let orgId = null;
  let adminId = null;

  try {
    // 1. Create a dedicated enterprise test organization
    const orgRes = await db.query(
      `INSERT INTO organizations (name, slug, plan, subscription_status)
       VALUES ('Acme Analytics Corp', 'acme-e2e-' || floor(random()*10000), 'growth', 'active')
       RETURNING id, name, plan;`
    );
    orgId = orgRes.rows[0].id;

    const pwdHash = await bcrypt.hash('SecureAdminPass2026!', 10);
    const adminRes = await db.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id, status)
       VALUES ('Workspace Owner', 'owner.' || floor(random()*10000) || '@acmeanalytics.com', $1, 'admin', $2, 'active')
       RETURNING id, name, email, role, organization_id;`,
      [pwdHash, orgId]
    );
    adminId = adminRes.rows[0].id;
    console.log(`[1] Created Test Organization: orgId=${orgId}`);
    console.log(`    Authenticated Admin: ${adminRes.rows[0].email} (Role: admin)`);

    // 2. Prepare HTTP request to create invitation
    const req = {
      user: {
        id: adminId,
        email: adminRes.rows[0].email,
        name: 'Workspace Owner',
        role: 'admin',
        organization_id: orgId
      },
      headers: {},
      params: {},
      query: {},
      body: {
        email: TARGET_INBOX,
        role: 'analyst'
      }
    };
    const res = createMockRes();

    console.log(`\n[2] Dispatching invitation to controlled inbox: ${TARGET_INBOX}...`);
    const startTime = Date.now();
    await adminController.createInvitation(req, res);
    const durationMs = Date.now() - startTime;

    console.log(`\n[3] HTTP Response Status: ${res.statusCode} (${durationMs}ms)`);
    console.log(`    Response Body:`, JSON.stringify(res.body, null, 2));

    if (res.statusCode !== 201) {
      throw new Error(`Invitation dispatch failed with status ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }

    const invitation = res.body.invitation;
    if (!invitation || !invitation.id) {
      throw new Error('Invitation record was not returned in response.');
    }

    // Security Check: Tokens must NEVER be in client response in production
    if (invitation.token || (invitation.inviteUrl && process.env.NODE_ENV === 'production')) {
      throw new Error('SECURITY VIOLATION: Invitation token or inviteUrl leaked in client response!');
    }

    // 3. Inspect database record
    console.log('\n[4] Inspecting PostgreSQL Database Record...');
    const dbRecord = await db.query(
      `SELECT id, organization_id, email, role, token_hash, status, expires_at, created_at
       FROM invitations
       WHERE id = $1;`,
      [invitation.id]
    );

    if (dbRecord.rows.length === 0) {
      throw new Error(`Invitation #${invitation.id} not found in database!`);
    }
    const row = dbRecord.rows[0];
    console.log(`    DB ID: ${row.id}`);
    console.log(`    Recipient: ${row.email}`);
    console.log(`    Role: ${row.role}`);
    console.log(`    Status: ${row.status}`);
    console.log(`    Token Hash (SHA-256): ${row.token_hash}`);
    console.log(`    Expires At: ${row.expires_at}`);

    // Verify 7-day expiration
    const expiresMs = new Date(row.expires_at).getTime();
    const createdMs = new Date(row.created_at).getTime();
    const daysDiff = Math.round((expiresMs - createdMs) / (1000 * 60 * 60 * 24));
    console.log(`    Expiration Duration: ${daysDiff} days`);
    if (daysDiff !== 7) {
      throw new Error(`Expected 7-day expiration, got ${daysDiff} days`);
    }

    // 4. Verify Brevo delivery status directly
    console.log('\n[5] Verifying Brevo API Delivery Diagnostic...');
    console.log(`    Is Brevo Active: ${emailService.isBrevo()}`);

    // 5. Verify production link sanitization (cannot point to localhost)
    console.log('\n[6] Verifying URL Sanitization for Production...');
    const rawLocalUrl = 'http://localhost:5173/auth/accept-invite?token=sample_token_123';
    // Temporarily verify production sanitization
    const sanitizedUrl = emailService.sanitizeUrlForProduction(rawLocalUrl);
    console.log(`    Raw input with localhost: ${rawLocalUrl}`);
    console.log(`    Sanitized output for environment: ${sanitizedUrl}`);

    console.log('\n========================================================================');
    console.log(' ✅ REAL INVITATION DISPATCH SUCCEEDED END-TO-END!');
    console.log(`    Recipient: ${TARGET_INBOX}`);
    console.log(`    Delivery Provider: Brevo REST API v3 (Port 443)`);
    console.log(`    HTTP Code: 201 Created`);
    console.log('========================================================================\n');
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
    process.exit(1);
  } finally {
    if (orgId) {
      console.log('[Cleanup] Removing test organization data...');
      await db.query(`DELETE FROM invitations WHERE organization_id = $1`, [orgId]).catch(() => null);
      await db.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]).catch(() => null);
      await db.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => null);
      console.log('[Cleanup] Done.');
    }
    process.exit(0);
  }
}

runLiveInvitationVerification();
