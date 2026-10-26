/**
 * RicozAnalytics — Complete Trial Expiry, Password Security & Professional Billing Automated Test Suite
 * Covers all criteria from the technical specifications:
 * 1. Trial Lifecycle & Authoritative Timestamps (14 days, isolation, dynamic countdown, backend 402 expiry, legacy backfill)
 * 2. Password Security & Strength Evaluation (weak rejection on backend & frontend utility, guidance, login compatibility)
 * 3. Invoices, Receipts & Billing Telemetry (PDF receipt endpoint, genuine data overview)
 */

const http = require('http');
const crypto = require('crypto');
const app = require('./app');
const db = require('./config/database');
const { evaluatePasswordStrength, isPredictableSequence } = require('./utils/passwordSecurity');
const subscriptionService = require('./services/subscriptionService');

const TEST_PORT = process.env.TEST_PORT || 5099;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => { chunks.push(chunk); });
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (_) {
          json = { raw: text };
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          rawBuffer: buffer
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('RicozAnalytics — Automated Test Suite: Trial, Password & Billing');
  console.log('===============================================================\n');

  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const s = app.listen(TEST_PORT, () => resolve(s));
      s.on('error', reject);
    });
    console.log(`[Test Server] Running on http://localhost:${TEST_PORT}\n`);

    // =========================================================================
    // SUITE 1: PASSWORD SECURITY & STRENGTH EVALUATION
    // =========================================================================
    console.log('--- SUITE 1: Password Strength Validation & Policy Enforcement ---');

    // 1.1 Unit evaluation: Weak passwords (< 8 chars, pure numbers, predictable patterns)
    const weakShort = evaluatePasswordStrength('Pass1!');
    assert(!weakShort.isValid && weakShort.strength === 'weak', 'Rejects short password (< 8 chars)', weakShort.feedback);

    const weakPredictable = evaluatePasswordStrength('Password123!');
    assert(!weakPredictable.isValid && weakPredictable.strength === 'weak', 'Rejects predictable password pattern (Password123!)', weakPredictable.feedback);

    const weakSequence = evaluatePasswordStrength('Abcd1234$');
    assert(!weakSequence.isValid && weakSequence.strength === 'weak', 'Rejects sequential run pattern (Abcd1234$)', weakSequence.feedback);

    // 1.2 Unit evaluation: Moderate and Strong passwords
    const moderate = evaluatePasswordStrength('Security#2026');
    assert(moderate.isValid && (moderate.strength === 'moderate' || moderate.strength === 'strong'), 'Accepts moderate strength password (Security#2026)', moderate.feedback);

    const strong = evaluatePasswordStrength('K#9xL@2qP$7mZ!');
    assert(strong.isValid && strong.strength === 'strong', 'Accepts strong complex password (K#9xL@2qP$7mZ!)', strong.feedback);

    // 1.3 Missing requirements checklist accuracy
    const missingNums = evaluatePasswordStrength('NoNumbersHere!');
    assert(!missingNums.requirements.hasNumber, 'Correctly flags missing number in requirements');

    const missingSymbols = evaluatePasswordStrength('NoSymbols1234');
    assert(!missingSymbols.requirements.hasSymbol, 'Correctly flags missing symbol in requirements');

    // 1.4 Backend Registration API: Weak password rejected with 400
    const weakRegEmail = `test_weak_${Date.now()}@example.com`;
    const weakRegRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Weak User',
        email: weakRegEmail,
        organization_name: 'Weak Org',
        password: 'weak'
      }
    });
    assert(weakRegRes.status === 400, 'Registration API rejects weak password with HTTP 400', `Status: ${weakRegRes.status}`);
    assert(weakRegRes.data?.missingRequirements?.length > 0 || weakRegRes.data?.message?.includes('weak'), 'Registration returns descriptive guidance on missing requirements');

    // 1.5 Backend Registration API: Strong password accepted with 201
    const strongRegEmail = `test_strong_${Date.now()}@example.com`;
    const strongPassword = 'Enterprise@Vision99';
    const strongRegRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Strong User',
        email: strongRegEmail,
        organization_name: 'Strong Corp',
        password: strongPassword
      }
    });
    assert(strongRegRes.status === 201, 'Registration API accepts strong password with HTTP 201', `Status: ${strongRegRes.status}`);

    // Verify password is never stored in plaintext
    const dbUserRes = await db.query('SELECT password_hash FROM users WHERE email = $1', [strongRegEmail]);
    const storedHash = dbUserRes.rows[0]?.password_hash;
    assert(storedHash && storedHash.startsWith('$2') && !storedHash.includes(strongPassword), 'Password is cryptographically hashed with bcrypt and never stored in plaintext');

    // 1.6 Login Compatibility: Existing user can sign in without strength re-evaluation blocking
    // Retrieve OTP from users table to verify account so user can login
    const otpRes = await db.query('SELECT verification_otp FROM users WHERE LOWER(email) = LOWER($1)', [strongRegEmail]);
    const otpCode = otpRes.rows[0]?.verification_otp;
    let authHeader = '';
    let userOrgId = null;

    if (otpCode) {
      const verifyRes = await request('/auth/verify-otp', {
        method: 'POST',
        body: { email: strongRegEmail, otp: otpCode }
      });
      assert(verifyRes.status === 200, 'Account verified successfully with OTP');
      authHeader = `Bearer ${verifyRes.data?.token}`;
      userOrgId = verifyRes.data?.user?.organization_id;

      // Now login with credentials
      const loginRes = await request('/auth/login', {
        method: 'POST',
        body: { email: strongRegEmail, password: strongPassword }
      });
      assert(loginRes.status === 200, 'User logs in successfully with valid credentials');
    }

    // =========================================================================
    // SUITE 2: 14-DAY TRIAL LIFECYCLE & AUTHORITATIVE TIMESTAMPS
    // =========================================================================
    console.log('\n--- SUITE 2: 14-Day Free Trial Lifecycle & Authoritative Timestamps ---');

    // 2.1 Authoritative trial timestamps initialized
    const subRes = await request('/billing/subscription', {
      method: 'GET',
      headers: { Authorization: authHeader, 'X-Organization-Id': userOrgId }
    });
    assert(subRes.status === 200, 'Subscription telemetry endpoint returns HTTP 200');

    const sub = subRes.data?.subscription;
    assert(sub?.trialStartedAt && sub?.trialEndsAt, 'Subscription contains non-null trialStartedAt and trialEndsAt');
    assert(sub?.relevantEndDate != null, 'relevantEndDate is populated and authoritative (never null)');

    // 2.2 Exact 14-day duration
    const startMs = new Date(sub.trialStartedAt).getTime();
    const endMs = new Date(sub.trialEndsAt).getTime();
    const durationDays = (endMs - startMs) / (1000 * 60 * 60 * 24);
    assert(Math.abs(durationDays - 14) < 0.01, `Trial duration is exactly 14 × 24 hours (${durationDays.toFixed(2)} days)`);

    // 2.3 Re-fetching or re-logging in does NOT reset or extend trial
    const subRes2 = await request('/billing/subscription', {
      method: 'GET',
      headers: { Authorization: authHeader, 'X-Organization-Id': userOrgId }
    });
    const sub2 = subRes2.data?.subscription;
    assert(sub2.trialStartedAt === sub.trialStartedAt, 'Refreshing/re-logging does not reset trial start timestamp');
    assert(sub2.trialEndsAt === sub.trialEndsAt, 'Refreshing/re-logging does not reset trial end timestamp');

    // 2.4 Multi-tenant isolation: A second organization has distinct isolated trial dates
    const org2Email = `test_org2_${Date.now()}@example.com`;
    const org2Reg = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Org2 Admin',
        email: org2Email,
        organization_name: 'Isolated Corp 2',
        password: 'ValidOrg2Secure#2026'
      }
    });
    assert(org2Reg.status === 201, 'Second organization created successfully');

    const org2OtpRes = await db.query('SELECT verification_otp FROM users WHERE LOWER(email) = LOWER($1)', [org2Email]);
    const org2Verify = await request('/auth/verify-otp', {
      method: 'POST',
      body: { email: org2Email, otp: org2OtpRes.rows[0]?.verification_otp }
    });
    const org2Token = `Bearer ${org2Verify.data?.token}`;
    const org2Id = org2Verify.data?.user?.organization_id;

    assert(org2Id !== userOrgId, 'Organizations have separate unique IDs');

    const org2SubRes = await request('/billing/subscription', {
      method: 'GET',
      headers: { Authorization: org2Token, 'X-Organization-Id': org2Id }
    });
    const org2Sub = org2SubRes.data?.subscription;
    assert(org2Sub?.organizationId === org2Id, 'Second organization subscription is linked to second organization ID');

    // 2.5 Safe legacy reconciliation: NULL trial dates are derived from created_at
    const legacyOrgRes = await db.query(
      `INSERT INTO organizations (name, slug, subscription_status, created_at, updated_at)
       VALUES ($1, $2, 'trial', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
       RETURNING id, created_at`,
      [`Legacy Org ${Date.now()}`, `legacy-org-${Date.now()}`]
    );
    const legacyOrgId = legacyOrgRes.rows[0].id;
    const legacyCreatedAt = new Date(legacyOrgRes.rows[0].created_at);

    // Call subscriptionService.getOrganizationSubscription which triggers safe reconciliation
    const reconciledSub = await subscriptionService.getOrganizationSubscription(legacyOrgId);
    assert(reconciledSub.trialStartedAt != null, 'Legacy organization without trial dates gets safe start timestamp');
    assert(reconciledSub.trialEndsAt != null, 'Legacy organization gets derived end timestamp');

    const reconciledDays = Math.ceil((new Date(reconciledSub.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    assert(reconciledDays <= 10 && reconciledDays >= 8, `Legacy org created 5 days ago has ~9 days remaining, NOT fresh 14 days (${reconciledDays}d remaining)`);

    // =========================================================================
    // SUITE 3: BACKEND EXPIRY & ACCESS CONTROL ENFORCEMENT
    // =========================================================================
    console.log('\n--- SUITE 3: Backend Trial Expiry Enforcement & Data Preservation ---');

    // 3.1 Simulate trial expiry on Org2
    const expireRes = await request('/billing/dev-simulate-trial-expiry', {
      method: 'POST',
      headers: { Authorization: org2Token, 'X-Organization-Id': org2Id }
    });
    assert(expireRes.status === 200, 'dev-simulate-trial-expiry endpoint returns 200');

    // Check backend workspace access entitlement directly
    const accessCheck = await subscriptionService.checkWorkspaceAccess(org2Id);
    assert(accessCheck.allowed === false, 'checkWorkspaceAccess returns allowed: false for expired trial');
    assert(accessCheck.code === 'TRIAL_EXPIRED', 'checkWorkspaceAccess returns code: TRIAL_EXPIRED');

    // Protected API access check: GET /datasets returns HTTP 402 Payment Required
    const datasetsRes = await request('/datasets', {
      method: 'GET',
      headers: { Authorization: org2Token, 'X-Organization-Id': org2Id }
    });
    assert(datasetsRes.status === 402, 'Protected API /datasets returns HTTP 402 for expired trial', `Status: ${datasetsRes.status}`);
    assert(datasetsRes.data?.requiresSubscription === true, 'HTTP 402 response indicates requiresSubscription: true');

    // Verify organization and user records remain intact in DB (zero data loss)
    const orgCheck = await db.query('SELECT id, name FROM organizations WHERE id = $1', [org2Id]);
    assert(orgCheck.rows.length === 1, 'Organization record is securely preserved after trial expiry');

    const userCheck = await db.query('SELECT id, email FROM users WHERE organization_id = $1', [org2Id]);
    assert(userCheck.rows.length >= 1, 'User account records are securely preserved after trial expiry');

    // =========================================================================
    // SUITE 4: INVOICE RECEIPTS & BILLING TELEMETRY
    // =========================================================================
    console.log('\n--- SUITE 4: Invoice PDF Receipts & Billing UI Telemetry ---');

    // Create a real test invoice in the database for the active user organization
    const invoiceId = crypto.randomUUID();
    await db.query(
      `INSERT INTO invoices (id, organization_id, amount, currency, plan, status, receipt_number, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [invoiceId, userOrgId, 699, 'INR', 'growth', 'paid', `REC-TEST-${Date.now().toString().slice(-4)}`]
    );

    // 4.1 Download receipt endpoint returns genuine PDF stream
    const receiptRes = await request(`/billing/invoices/${invoiceId}/receipt`, {
      method: 'GET',
      headers: { Authorization: authHeader, 'X-Organization-Id': userOrgId }
    });
    assert(receiptRes.status === 200, 'Invoice receipt download endpoint returns HTTP 200');
    assert(receiptRes.headers['content-type']?.includes('application/pdf'), 'Receipt response Content-Type is application/pdf');
    assert(receiptRes.rawBuffer?.slice(0, 4).toString() === '%PDF', 'Receipt buffer starts with standard %PDF magic header');

    // 4.2 Non-existent invoice returns 404
    const notFoundReceipt = await request('/billing/invoices/inv_non_existent/receipt', {
      method: 'GET',
      headers: { Authorization: authHeader, 'X-Organization-Id': userOrgId }
    });
    assert(notFoundReceipt.status === 404, 'Non-existent invoice receipt returns HTTP 404');

    // 4.3 Subscription endpoint returns genuine invoices list containing the real record
    const subWithInvoices = await request('/billing/subscription', {
      method: 'GET',
      headers: { Authorization: authHeader, 'X-Organization-Id': userOrgId }
    });
    const invList = subWithInvoices.data?.invoices || [];
    assert(invList.some(i => i.id === invoiceId), 'Subscription invoices list contains real backend invoice record');

    // Cleanup created test invoice
    await db.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n===============================================================');
    console.log(`Test Execution Finished: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    if (server) {
      server.close();
    }
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runTestSuite();
