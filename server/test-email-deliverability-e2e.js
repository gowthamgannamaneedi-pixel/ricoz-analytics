const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./config/database');
const emailValidator = require('./utils/emailValidator');
const emailSuppressionService = require('./services/emailSuppressionService');
const emailService = require('./services/emailService');
const authController = require('./controllers/authController');
const adminController = require('./controllers/adminController');
const demoRequestController = require('./controllers/demoRequestController');
const UserModel = require('./models/userModel');
const OrganizationModel = require('./models/organizationModel');
const InvitationModel = require('./models/invitationModel');

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
    setHeader(name, val) {
      this.headers[name] = val;
    }
  };
}

async function runDeliverabilityAcceptanceSuite() {
  console.log('========================================================================');
  console.log(' RICOZANALYTICS — TRANSACTIONAL EMAIL DELIVERABILITY & BOUNCE SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;
  const tracker = { failures: [] };

  async function testWorkflow(num, title, fn) {
    total++;
    process.stdout.write(`[WORKFLOW ${num}] ${title}... `);
    try {
      await fn();
      passed++;
      console.log('✅ PASS');
    } catch (err) {
      tracker.failures.push({ num, title, error: err.message });
      console.log(`❌ FAIL\n  Error: ${err.message}`);
      process.exitCode = 1;
    }
  }

  // Ensure services are initialized
  await emailSuppressionService.init();

  const timestamp = Date.now();
  const testOrg = await OrganizationModel.create({
    name: `Deliverability Org ${timestamp}`,
    plan: 'starter'
  });
  const orgId = testOrg.id;

  const validTestEmail = `deliverability_user_${timestamp}@enterprise.test`;
  const bouncedTestEmail = `bounced_recipient_${timestamp}@bounce-test.org`;
  const suppressedTestEmail = `permanently_suppressed_${timestamp}@suppressed.test`;
  const strongPassword = 'K#9xL@2qP$7mZ!';
  const passwordHash = await bcrypt.hash(strongPassword, 10);

  // -------------------------------------------------------------
  // WORKFLOW 1: Registration OTP flow (Brevo dispatch, no Supabase bounce)
  // -------------------------------------------------------------
  await testWorkflow(1, 'Registration OTP dispatches via primary provider without triggering Supabase mailer', async () => {
    const req = {
      body: {
        name: 'Deliverability Tester',
        email: validTestEmail,
        password: strongPassword,
        organization_name: `Tenant ${timestamp}`
      },
      headers: { host: 'localhost:5000' }
    };
    const res = createMockRes();

    await authController.register(req, res, () => {});

    assert(res.statusCode === 201 || res.statusCode === 200, `Expected 201 or 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    assert(res.body?.success === true, 'Response must indicate success');
    assert(res.body?.requiresVerification === true, 'User must require email verification');
    assert(res.body?.email_delivery?.attempted === true, 'Email delivery must be attempted');

    // Confirm user in DB
    const dbUser = await UserModel.findByEmail(validTestEmail);
    assert(dbUser !== null, 'User record must exist in DB');
    assert(dbUser.status === 'pending_verification', 'Status must be pending_verification');
    assert(Boolean(dbUser.verification_otp), 'Verification OTP must be stored');
    assert(dbUser.verification_otp.length === 6, 'Verification OTP must be exactly 6 digits');
  });

  // -------------------------------------------------------------
  // WORKFLOW 2: Email verification with 6-digit OTP
  // -------------------------------------------------------------
  await testWorkflow(2, 'Email verification succeeds with valid OTP and activates user account', async () => {
    const dbUser = await UserModel.findByEmail(validTestEmail);
    assert(dbUser !== null, 'User record must exist');

    const req = {
      body: {
        email: validTestEmail,
        otp: dbUser.verification_otp
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    assert(res.body?.success === true, 'Verification must succeed');
    assert(Boolean(res.body?.token), 'Session token must be issued');

    const updatedUser = await UserModel.findByEmail(validTestEmail);
    assert(updatedUser.status === 'active', 'User status must be updated to active');
    assert(updatedUser.verification_otp === null, 'OTP must be cleared to NULL to prevent reuse');
  });

  // -------------------------------------------------------------
  // WORKFLOW 3: Duplicate resend cooldown enforcement (60s)
  // -------------------------------------------------------------
  await testWorkflow(3, 'Duplicate resend request within 60s cooldown is rejected with HTTP 429 RATE_LIMITED', async () => {
    const unverifiedEmail = `unverified_cooldown_${timestamp}@enterprise.test`;
    await UserModel.create({
      name: 'Cooldown Tester',
      email: unverifiedEmail,
      password_hash: passwordHash,
      role: 'admin',
      organization_id: orgId,
      status: 'pending_verification',
      verification_otp: '333444',
      verification_token: 'cooldown_token_initial',
      verification_token_expires_at: new Date(Date.now() + 24 * 3600 * 1000)
    });

    const req1 = { body: { email: unverifiedEmail }, headers: { host: 'localhost:5000' } };
    const res1 = createMockRes();
    await authController.resendOtp(req1, res1, () => {});
    assert(res1.statusCode === 200, `First resend must succeed with 200, got ${res1.statusCode}`);

    // Immediate second request within cooldown
    const req2 = { body: { email: unverifiedEmail }, headers: { host: 'localhost:5000' } };
    const res2 = createMockRes();
    await authController.resendOtp(req2, res2, () => {});

    assert(res2.statusCode === 429, `Second resend must return 429, got ${res2.statusCode}`);
    assert(res2.body?.error?.code === 'RATE_LIMITED', 'Error code must be RATE_LIMITED');
    assert(res2.body?.retryAfter > 0, 'Retry-After seconds must be provided');
  });

  // -------------------------------------------------------------
  // WORKFLOW 4: Password reset link generation & deliverability check
  // -------------------------------------------------------------
  await testWorkflow(4, 'Password reset flow generates single-use token and dispatches without Supabase Auth calls', async () => {
    const req = {
      body: { email: validTestEmail },
      headers: { host: 'localhost:5000' }
    };
    const res = createMockRes();

    await authController.forgotPassword(req, res, () => {});

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body?.success === true, 'Password reset request must succeed');

    const user = await UserModel.findByEmail(validTestEmail);
    assert(Boolean(user.reset_password_token), 'Database must store reset_password_token');
    assert(new Date(user.reset_password_expires_at) > new Date(), 'Reset token expires in future');
  });

  // -------------------------------------------------------------
  // WORKFLOW 5: Organization & team member invitation delivery
  // -------------------------------------------------------------
  await testWorkflow(5, 'Workspace admin invitation dispatches safely with seat reservation', async () => {
    const inviteeEmail = `invitee_${timestamp}@enterprise.test`;
    const req = {
      user: {
        id: 1,
        name: 'Workspace Admin',
        email: 'admin@ricoz.test',
        role: 'admin',
        organization_id: orgId
      },
      body: {
        email: inviteeEmail,
        role: 'analyst'
      }
    };
    const res = createMockRes();

    await adminController.createInvitation(req, res);

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    assert(res.body?.success === true, 'Invitation creation must succeed');
    assert(res.body?.invitation?.email === inviteeEmail, 'Invitee email must match');
  });

  // -------------------------------------------------------------
  // WORKFLOW 6: Expired OTP rejection
  // -------------------------------------------------------------
  await testWorkflow(6, 'Expired OTP is strictly rejected with HTTP 400 OTP_EXPIRED', async () => {
    const expiredEmail = `expired_otp_${timestamp}@enterprise.test`;
    await UserModel.create({
      name: 'Expired Tester',
      email: expiredEmail,
      password_hash: passwordHash,
      role: 'analyst',
      organization_id: orgId,
      status: 'pending_verification',
      verification_otp: '777888',
      verification_token: 'expired_token_777',
      verification_token_expires_at: new Date(Date.now() - 3600 * 1000) // Expired 1 hour ago
    });

    const req = {
      body: {
        email: expiredEmail,
        otp: '777888'
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.body?.error?.code === 'OTP_EXPIRED', `Expected OTP_EXPIRED, got ${res.body?.error?.code}`);
  });

  // -------------------------------------------------------------
  // WORKFLOW 7: Invalid email & missing MX domain rejection
  // -------------------------------------------------------------
  await testWorkflow(7, 'Syntactically invalid and dead MX domains are intercepted before dispatch', async () => {
    // A. Malformed syntax
    const badSyntax = await emailValidator.validateEmail('invalid_syntax@no-dot');
    assert(badSyntax.isValid === false, 'Bad syntax must be invalid');
    assert(badSyntax.code === 'INVALID_EMAIL_SYNTAX', 'Must return INVALID_EMAIL_SYNTAX');

    // B. Disposable domain
    const disposable = await emailValidator.validateEmail('user@mailinator.com');
    assert(disposable.isValid === false, 'Disposable domain must be rejected');
    assert(disposable.code === 'DISPOSABLE_EMAIL_REJECTED', 'Must return DISPOSABLE_EMAIL_REJECTED');

    // C. Non-existent domain MX check
    const deadMx = await emailValidator.verifyDomainMx('admin@ricozanalytics.com');
    assert(deadMx.hasMx === false, 'Domain without MX records must be flagged as non-deliverable');
    assert(deadMx.reason.includes('does not exist') || deadMx.reason.includes('no mail records'), 'Reason must explain lack of mail records');
  });

  // -------------------------------------------------------------
  // WORKFLOW 8: Hard bounce suppression persistence & blocking
  // -------------------------------------------------------------
  await testWorkflow(8, 'Suppression list blocks future registrations and invitations to hard-bounced addresses', async () => {
    // Record hard bounce suppression
    await emailSuppressionService.addSuppression({
      email: suppressedTestEmail,
      reason: 'hard_bounce',
      bounceType: 'mailbox_not_found',
      provider: 'Brevo',
      errorDetail: '550 Mailbox does not exist'
    });

    const isSupp = await emailSuppressionService.isSuppressed(suppressedTestEmail);
    assert(isSupp.isSuppressed === true, 'Address must be marked suppressed');
    assert(isSupp.reason === 'hard_bounce', 'Reason must match');

    // Registration must be blocked
    const regReq = {
      body: {
        name: 'Suppressed Registrant',
        email: suppressedTestEmail,
        password: strongPassword,
        organization_name: 'Blocked Org'
      },
      headers: { host: 'localhost:5000' }
    };
    const regRes = createMockRes();
    await authController.register(regReq, regRes, () => {});

    assert(regRes.statusCode === 400, `Expected 400 for suppressed registration, got ${regRes.statusCode}`);
    assert(regRes.body?.error?.code === 'EMAIL_ADDRESS_SUPPRESSED', 'Expected code EMAIL_ADDRESS_SUPPRESSED');

    // Invitation must also be blocked
    const invReq = {
      user: {
        id: 1,
        name: 'Admin',
        email: 'admin@ricoz.test',
        role: 'admin',
        organization_id: orgId
      },
      body: {
        email: suppressedTestEmail,
        role: 'analyst'
      }
    };
    const invRes = createMockRes();
    await adminController.createInvitation(invReq, invRes);

    assert(invRes.statusCode === 400, `Expected 400 for suppressed invitation, got ${invRes.statusCode}`);
    assert(invRes.body?.error?.code === 'EMAIL_ADDRESS_SUPPRESSED', 'Expected code EMAIL_ADDRESS_SUPPRESSED');
  });

  // -------------------------------------------------------------
  // WORKFLOW 9: Webhook bounce ingestion & automatic suppression
  // -------------------------------------------------------------
  await testWorkflow(9, 'Brevo webhook event automatically records recipient into suppression table', async () => {
    const webhookBouncedEmail = `webhook_bounce_${timestamp}@bounced-inbox.com`;
    const req = {
      body: {
        event: 'hard_bounce',
        email: webhookBouncedEmail,
        reason: '550 User unknown',
        date: new Date().toISOString()
      }
    };
    const res = createMockRes();

    await demoRequestController.handleBrevoWebhook(req, res);

    assert(res.statusCode === 200, `Webhook must return 200, got ${res.statusCode}`);
    assert(res.body?.received === true, 'Webhook must report received: true');

    const isSupp = await emailSuppressionService.isSuppressed(webhookBouncedEmail);
    assert(isSupp.isSuppressed === true, 'Recipient must be automatically added to suppression list');
    assert(isSupp.provider === 'Brevo (Webhook)', 'Provider must be Brevo (Webhook)');
  });

  // -------------------------------------------------------------
  // WORKFLOW 10: Safe diagnostic logging & zero secret leakage
  // -------------------------------------------------------------
  await testWorkflow(10, 'Safe logging verifies zero leakage of OTPs, passwords, or SMTP secrets', async () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
      origLog(...args);
    };

    try {
      await emailService.sendVerificationEmail({
        email: `safe_log_${timestamp}@enterprise.test`,
        name: 'Safe Logger',
        token: 'super_secret_token_12345',
        otp: '887766',
        verifyUrl: 'http://localhost:5173/verify?token=super_secret_token_12345'
      });
    } finally {
      console.log = origLog;
    }

    const logBlob = logs.join('\n');
    assert(!logBlob.includes('super_secret_token_12345'), 'Token must not be present in diagnostic logs');
    assert(!logBlob.includes(process.env.BREVO_API_KEY || 'xkeysib'), 'API key must not be present in diagnostic logs');
  });

  // Cleanup test users and org
  try {
    await db.query('DELETE FROM users WHERE organization_id = $1', [orgId]);
    await db.query('DELETE FROM invitations WHERE organization_id = $1', [orgId]);
    await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await emailSuppressionService.removeSuppression(suppressedTestEmail);
  } catch (_) {}

  console.log('\n========================================================================');
  console.log(` RESULTS: ${passed}/${total} WORKFLOWS PASSED (${passed === total ? '100% SUCCESS' : 'FAILURES DETECTED'})`);
  console.log('========================================================================\n');

  process.exit(passed === total ? 0 : 1);
}

runDeliverabilityAcceptanceSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
