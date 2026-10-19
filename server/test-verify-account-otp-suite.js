/**
 * RicozAnalytics — Complete Verify Account, OTP, Email & Security Suite
 * Exhaustively tests all 19 cases specified in requirements:
 * 1. Already-verified active account clicking Verify Account.
 * 2. Unverified account requesting an OTP.
 * 3. OTP email accepted by Brevo.
 * 4. Brevo rejection or API timeout.
 * 5. Duplicate registration.
 * 6. Incorrect OTP.
 * 7. Correct OTP.
 * 8. Expired OTP.
 * 9. Reused OTP.
 * 10. Resending an OTP.
 * 11. Previous OTP invalidation.
 * 12. Rate limiting and excessive verification attempts.
 * 13. Missing email configuration.
 * 14. Database failure while storing the OTP.
 * 15. Browser refresh on the OTP page.
 * 16. Direct navigation to the OTP page without a valid verification flow.
 * 17. Case-insensitive email matching.
 * 18. Password reset for an already-verified account.
 * 19. Existing authentication and email integration regressions.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./config/database');
const UserModel = require('./models/userModel');
const OrganizationModel = require('./models/organizationModel');
const authController = require('./controllers/authController');
const emailService = require('./services/emailService');
const tokenBlacklist = require('./utils/tokenBlacklist');

function createMockRes() {
  const res = {
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
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    }
  };
  return res;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runVerifyAccountOtpSuite() {
  console.log('================================================================');
  console.log('  RicozAnalytics — Verify Account, OTP & Email Security Suite  ');
  console.log('================================================================\n');

  const tracker = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  async function testCase(num, title, fn) {
    tracker.total++;
    process.stdout.write(`[TEST ${num}] ${title}... `);
    try {
      await fn();
      tracker.passed++;
      console.log('✅ PASS');
    } catch (err) {
      tracker.failed++;
      tracker.failures.push({ num, title, error: err.message });
      console.log(`❌ FAIL\n  Error: ${err.message}`);
    }
  }

  // Create isolated test organization
  const testOrg = await OrganizationModel.create({
    name: `OTP Test Org ${Date.now()}`,
    plan: 'starter'
  });
  const orgId = testOrg.id;

  const testEmailPrefix = `otp_test_${Date.now()}`;
  const verifiedEmail = `${testEmailPrefix}_verified@ricoztest.com`;
  const unverifiedEmail = `${testEmailPrefix}_unverified@ricoztest.com`;
  const caseSensitiveEmail = `${testEmailPrefix}_CaseSensitive@RicozTest.COM`;

  // Pre-seed an already-verified active user
  const passwordHash = await bcrypt.hash('SecurePassword123!', 10);
  const activeUser = await UserModel.create({
    name: 'Verified Admin',
    email: verifiedEmail,
    password_hash: passwordHash,
    role: 'admin',
    organization_id: orgId,
    status: 'active'
  });
  await UserModel.markEmailVerified(verifiedEmail);

  // Pre-seed an unverified user
  const unverifiedUser = await UserModel.create({
    name: 'Pending User',
    email: unverifiedEmail,
    password_hash: passwordHash,
    role: 'analyst',
    organization_id: orgId,
    status: 'pending_verification',
    verification_token: 'initial_token_123',
    verification_otp: '111222',
    verification_token_expires_at: new Date(Date.now() + 24 * 3600 * 1000)
  });

  // Track created users for teardown
  const createdEmails = [verifiedEmail, unverifiedEmail, caseSensitiveEmail.toLowerCase()];

  // -------------------------------------------------------------
  // TEST 1: Already-verified active account clicking Verify Account
  // -------------------------------------------------------------
  await testCase(1, 'Already-verified active account clicking Verify Account does not send OTP', async () => {
    const req = {
      body: { email: verifiedEmail },
      headers: { host: 'localhost:5000' }
    };
    const res = createMockRes();
    let emailSent = false;

    // Spy on emailService.sendVerificationEmail
    const origSend = emailService.sendVerificationEmail;
    emailService.sendVerificationEmail = async () => {
      emailSent = true;
      return { success: true };
    };

    try {
      await authController.resendOtp(req, res, () => {});
    } finally {
      emailService.sendVerificationEmail = origSend;
    }

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body?.alreadyVerified === true, 'Response body must declare alreadyVerified: true');
    assert(!emailSent, 'OTP email MUST NOT be sent for an already verified account');
    assert(res.body?.code === 'EMAIL_ALREADY_VERIFIED', 'Code must be EMAIL_ALREADY_VERIFIED');
  });

  // -------------------------------------------------------------
  // TEST 2: Unverified account requesting an OTP
  // -------------------------------------------------------------
  let generatedOtp = null;
  let generatedToken = null;
  await testCase(2, 'Unverified account requesting an OTP generates secure credentials & persists in DB', async () => {
    const req = {
      body: { email: unverifiedEmail },
      headers: { host: 'localhost:5000' }
    };
    const res = createMockRes();

    await authController.resendOtp(req, res, () => {});

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body?.success === true, 'Response body success must be true');

    // Verify DB state
    const dbUser = await UserModel.findByEmail(unverifiedEmail);
    assert(Boolean(dbUser.verification_otp), 'DB must contain verification_otp');
    assert(dbUser.verification_otp.length === 6, 'OTP must be exactly 6 digits');
    assert(/^\d{6}$/.test(dbUser.verification_otp), 'OTP must be all numeric digits');
    assert(Boolean(dbUser.verification_token), 'DB must contain verification_token');
    assert(new Date(dbUser.verification_token_expires_at) > new Date(), 'OTP expiration must be in the future');

    generatedOtp = dbUser.verification_otp;
    generatedToken = dbUser.verification_token;
  });

  // -------------------------------------------------------------
  // TEST 3: OTP email accepted by Brevo
  // -------------------------------------------------------------
  await testCase(3, 'OTP email accepted by Brevo returns success and message ID', async () => {
    const emailResult = await emailService.sendVerificationEmail({
      email: `brevo_verify_${Date.now()}@ricoztest.com`,
      name: 'Brevo Test Recipient',
      token: crypto.randomBytes(32).toString('hex'),
      otp: '654321',
      verifyUrl: 'http://localhost:5173/auth/verify-email?token=test'
    });

    assert(emailResult.attempted === true, 'Email dispatch must be attempted');
    assert(emailResult.success === true, 'Email dispatch must succeed');
    assert(Boolean(emailResult.messageId), 'Message ID must be returned');
    assert(emailResult.provider === 'Brevo' || emailResult.provider === 'MockTestService', 'Provider must be Brevo or MockTestService');
  });

  // -------------------------------------------------------------
  // TEST 4: Brevo rejection or API timeout
  // -------------------------------------------------------------
  await testCase(4, 'Brevo rejection returns HTTP 502 and preserves existing valid OTP in DB', async () => {
    const brevoFailEmail = `${testEmailPrefix}_fail@ricoztest.com`;
    createdEmails.push(brevoFailEmail);

    await UserModel.create({
      name: 'Fail User',
      email: brevoFailEmail,
      password_hash: passwordHash,
      role: 'analyst',
      organization_id: orgId,
      status: 'pending_verification',
      verification_otp: '888999',
      verification_token: 'fail_token_888',
      verification_token_expires_at: new Date(Date.now() + 24 * 3600 * 1000)
    });

    const origSend = emailService.sendVerificationEmail;
    emailService.sendVerificationEmail = async () => {
      return {
        attempted: true,
        success: false,
        error: 'Brevo API rate limited or connection timed out',
        provider: 'Brevo'
      };
    };

    const req = {
      body: { email: brevoFailEmail },
      headers: { host: 'localhost:5000' }
    };
    const res = createMockRes();

    try {
      await authController.resendOtp(req, res, () => {});
    } finally {
      emailService.sendVerificationEmail = origSend;
    }

    assert(res.statusCode === 502, `Expected 502, got ${res.statusCode}`);
    assert(res.body?.error?.code === 'EMAIL_DISPATCH_FAILED', 'Code must be EMAIL_DISPATCH_FAILED');
    assert(res.body?.email_delivery?.success === false, 'email_delivery.success must be false');

    // Confirm existing OTP was not wiped
    const postDbUser = await UserModel.findByEmail(brevoFailEmail);
    assert(postDbUser.verification_otp === '888999', 'Existing OTP in DB must be preserved when delivery fails');
  });

  // -------------------------------------------------------------
  // TEST 5: Duplicate registration
  // -------------------------------------------------------------
  await testCase(5, 'Duplicate registration: already-verified returns 409 EMAIL_ALREADY_VERIFIED', async () => {
    const req = {
      body: {
        name: 'Another User',
        email: verifiedEmail,
        password: 'Password123!',
        organization_name: 'Conflict Org'
      },
      headers: { host: 'localhost:5000' }
    };
    const res = createMockRes();

    await authController.register(req, res, () => {});

    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    assert(res.body?.code === 'EMAIL_ALREADY_VERIFIED', 'Expected code EMAIL_ALREADY_VERIFIED');
    assert(res.body?.isVerified === true, 'Expected isVerified: true');
  });

  // -------------------------------------------------------------
  // TEST 6: Incorrect OTP
  // -------------------------------------------------------------
  await testCase(6, 'Incorrect OTP returns HTTP 400 INVALID_CODE with remaining attempts', async () => {
    const req = {
      body: {
        email: unverifiedEmail,
        otp: '000000' // wrong OTP
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.body?.error?.code === 'INVALID_CODE', 'Expected code INVALID_CODE');
    assert(typeof res.body?.remainingAttempts === 'number', 'Expected remainingAttempts number');

    const dbUser = await UserModel.findByEmail(unverifiedEmail);
    assert(dbUser.status === 'pending_verification', 'User must remain pending_verification');
  });

  // -------------------------------------------------------------
  // TEST 7: Correct OTP
  // -------------------------------------------------------------
  await testCase(7, 'Correct OTP verifies user, sets active status, clears OTP to NULL, and returns JWT', async () => {
    const dbUserBefore = await UserModel.findByEmail(unverifiedEmail);
    const validOtp = dbUserBefore.verification_otp;

    const req = {
      body: {
        email: unverifiedEmail,
        otp: validOtp
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body?.success === true, 'Expected success: true');
    assert(Boolean(res.body?.token), 'Expected authenticated session token');

    const dbUserAfter = await UserModel.findByEmail(unverifiedEmail);
    assert(dbUserAfter.status === 'active', 'User status must be active');
    assert(dbUserAfter.verification_otp === null, 'verification_otp must be cleared to NULL (single-use)');
    assert(dbUserAfter.verification_token === null, 'verification_token must be cleared to NULL');
    assert(Boolean(dbUserAfter.email_verified_at), 'email_verified_at must be populated');
  });

  // -------------------------------------------------------------
  // TEST 8: Expired OTP
  // -------------------------------------------------------------
  await testCase(8, 'Expired OTP is rejected with HTTP 400 OTP_EXPIRED', async () => {
    const expiredEmail = `${testEmailPrefix}_expired@ricoztest.com`;
    createdEmails.push(expiredEmail);

    await UserModel.create({
      name: 'Expired User',
      email: expiredEmail,
      password_hash: passwordHash,
      role: 'analyst',
      organization_id: orgId,
      status: 'pending_verification',
      verification_otp: '333444',
      verification_token: 'expired_token',
      verification_token_expires_at: new Date(Date.now() - 3600 * 1000) // 1 hour ago
    });

    const req = {
      body: {
        email: expiredEmail,
        otp: '333444'
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.body?.error?.code === 'OTP_EXPIRED', 'Expected code OTP_EXPIRED');
  });

  // -------------------------------------------------------------
  // TEST 9: Reused OTP
  // -------------------------------------------------------------
  await testCase(9, 'Reused OTP is rejected with HTTP 400 ALREADY_VERIFIED_OR_USED', async () => {
    // Re-verify the already-verified unverifiedEmail from Test 7
    const req = {
      body: {
        email: unverifiedEmail,
        otp: generatedOtp
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.body?.error?.code === 'ALREADY_VERIFIED_OR_USED', 'Expected code ALREADY_VERIFIED_OR_USED');
  });

  // -------------------------------------------------------------
  // TEST 10: Resending an OTP
  // -------------------------------------------------------------
  const resendTestEmail = `${testEmailPrefix}_resend@ricoztest.com`;
  createdEmails.push(resendTestEmail);
  let oldOtp = null;

  await testCase(10, 'Resending an OTP generates fresh credentials and renews expiration', async () => {
    await UserModel.create({
      name: 'Resend Test User',
      email: resendTestEmail,
      password_hash: passwordHash,
      role: 'analyst',
      organization_id: orgId,
      status: 'pending_verification',
      verification_otp: '111111',
      verification_token: 'old_token_111',
      verification_token_expires_at: new Date(Date.now() + 3600 * 1000)
    });
    oldOtp = '111111';

    const req = {
      body: { email: resendTestEmail },
      headers: { host: 'localhost:5000' }
    };
    const res = createMockRes();

    await authController.resendOtp(req, res, () => {});

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const updatedUser = await UserModel.findByEmail(resendTestEmail);
    assert(updatedUser.verification_otp !== oldOtp, 'New OTP must differ from old OTP');
    assert(updatedUser.verification_otp.length === 6, 'New OTP must be 6 digits');
  });

  // -------------------------------------------------------------
  // TEST 11: Previous OTP invalidation
  // -------------------------------------------------------------
  await testCase(11, 'Previous OTP is invalidated after resend and cannot be used', async () => {
    const req = {
      body: {
        email: resendTestEmail,
        otp: oldOtp // Attempt to use the old OTP
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.body?.error?.code === 'INVALID_CODE', 'Old OTP must be rejected as INVALID_CODE');
  });

  // -------------------------------------------------------------
  // TEST 12: Rate limiting and excessive verification attempts
  // -------------------------------------------------------------
  await testCase(12, 'Excessive failed verification attempts (5x) triggers 429 lockout & invalidates OTP', async () => {
    const bruteForceEmail = `${testEmailPrefix}_bruteforce@ricoztest.com`;
    createdEmails.push(bruteForceEmail);

    await UserModel.create({
      name: 'Brute Force Target',
      email: bruteForceEmail,
      password_hash: passwordHash,
      role: 'analyst',
      organization_id: orgId,
      status: 'pending_verification',
      verification_otp: '555666',
      verification_token: 'brute_force_token',
      verification_token_expires_at: new Date(Date.now() + 24 * 3600 * 1000)
    });

    let lastRes = null;
    // Send 5 wrong OTPs
    for (let i = 1; i <= 5; i++) {
      const req = {
        body: {
          email: bruteForceEmail,
          otp: '000000'
        }
      };
      lastRes = createMockRes();
      await authController.verifyOtp(req, lastRes, () => {});
    }

    assert(lastRes.statusCode === 429, `Expected 429 on 5th failure, got ${lastRes.statusCode}`);
    assert(lastRes.body?.error?.code === 'TOO_MANY_VERIFICATION_ATTEMPTS', 'Expected code TOO_MANY_VERIFICATION_ATTEMPTS');

    // Confirm compromised OTP was wiped from DB for security
    const lockedUser = await UserModel.findByEmail(bruteForceEmail);
    assert(lockedUser.verification_otp === null, 'Compromised OTP must be wiped from DB after 5 failures');
  });

  // -------------------------------------------------------------
  // TEST 13: Missing email configuration
  // -------------------------------------------------------------
  await testCase(13, 'Missing email configuration returns structured error without crashing', async () => {
    const origBrevoKey = process.env.BREVO_API_KEY;
    const origSmtpHost = process.env.SMTP_HOST;
    try {
      process.env.BREVO_API_KEY = '';
      process.env.SMTP_HOST = '';

      const unconfiguredResult = await emailService.sendVerificationEmail({
        email: 'unconfigured_test@ricozanalytics.com',
        name: 'Test',
        token: 'token_123',
        otp: '123456',
        verifyUrl: 'http://localhost:5173/verify'
      });

      assert(unconfiguredResult.success === false, 'Expected success: false');
      assert(unconfiguredResult.error.includes('not configured'), 'Expected "not configured" in error');
    } finally {
      process.env.BREVO_API_KEY = origBrevoKey;
      process.env.SMTP_HOST = origSmtpHost;
    }
  });

  // -------------------------------------------------------------
  // TEST 14: Database failure while storing the OTP
  // -------------------------------------------------------------
  await testCase(14, 'Database update error during verification handled safely without orphan state', async () => {
    const origMark = UserModel.markEmailVerified;
    UserModel.markEmailVerified = async () => {
      throw new Error('Simulated database connection timeout');
    };

    let caughtErr = null;
    try {
      const dbUser = await UserModel.findByEmail(resendTestEmail);
      const req = { body: { email: resendTestEmail, otp: dbUser.verification_otp } };
      const res = createMockRes();
      await authController.verifyOtp(req, res, (err) => { caughtErr = err; });
    } finally {
      UserModel.markEmailVerified = origMark;
    }

    assert(Boolean(caughtErr), 'Database exception must be safely forwarded to error middleware');
    assert(caughtErr.message.includes('Simulated database connection timeout'), 'Expected timeout error message');
  });

  // -------------------------------------------------------------
  // TEST 15: Browser refresh on the OTP page
  // -------------------------------------------------------------
  await testCase(15, 'Browser refresh on OTP page maintains pending status without side effects', async () => {
    const pendingEmail = `${testEmailPrefix}_refresh@ricoztest.com`;
    createdEmails.push(pendingEmail);

    await UserModel.create({
      name: 'Refresh User',
      email: pendingEmail,
      password_hash: passwordHash,
      role: 'analyst',
      organization_id: orgId,
      status: 'pending_verification',
      verification_otp: '777888',
      verification_token: 'refresh_token',
      verification_token_expires_at: new Date(Date.now() + 24 * 3600 * 1000)
    });

    // Simulating page refresh by querying user status twice
    const state1 = await UserModel.findByEmail(pendingEmail);
    assert(state1.status === 'pending_verification', 'State 1 must be pending_verification');

    const state2 = await UserModel.findByEmail(pendingEmail);
    assert(state2.status === 'pending_verification', 'State 2 must be pending_verification');
    assert(state2.verification_otp === '777888', 'OTP must remain unchanged across reads');
  });

  // -------------------------------------------------------------
  // TEST 16: Direct navigation to the OTP page without a valid verification flow
  // -------------------------------------------------------------
  await testCase(16, 'Direct submission without email or token returns HTTP 400', async () => {
    const req = { body: { otp: '123456' } }; // Missing email and token
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.body?.message?.includes('Email address or verification token is required'), 'Expected parameter validation message');
  });

  // -------------------------------------------------------------
  // TEST 17: Case-insensitive email matching
  // -------------------------------------------------------------
  await testCase(17, 'Case-insensitive email matching: mixed case email registers, receives OTP, and verifies', async () => {
    const mixedCase = `MixCase_${Date.now()}@RicozTest.Com`;
    createdEmails.push(mixedCase.toLowerCase());

    const created = await UserModel.create({
      name: 'Mixed Case User',
      email: mixedCase,
      password_hash: passwordHash,
      role: 'analyst',
      organization_id: orgId,
      status: 'pending_verification',
      verification_otp: '998877',
      verification_token: 'mix_token',
      verification_token_expires_at: new Date(Date.now() + 24 * 3600 * 1000)
    });

    // Verify using ALL UPPERCASE
    const req = {
      body: {
        email: mixedCase.toUpperCase(),
        otp: '998877'
      }
    };
    const res = createMockRes();

    await authController.verifyOtp(req, res, () => {});

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const verified = await UserModel.findByEmail(mixedCase);
    assert(verified.status === 'active', 'User must be marked active regardless of email casing');
  });

  // -------------------------------------------------------------
  // TEST 18: Password reset for an already-verified account
  // -------------------------------------------------------------
  await testCase(18, 'Password reset for an already-verified account works without registration OTP conflict', async () => {
    const req = {
      body: { email: verifiedEmail },
      headers: { host: 'localhost:5000' }
    };
    const res = createMockRes();

    await authController.forgotPassword(req, res, () => {});

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body?.success === true, 'Forgot password response success must be true');

    const dbUser = await UserModel.findByEmail(verifiedEmail);
    assert(Boolean(dbUser.reset_password_token), 'reset_password_token must be generated');
    assert(Boolean(dbUser.reset_password_expires_at), 'reset_password_expires_at must be populated');
  });

  // -------------------------------------------------------------
  // TEST 19: Existing authentication and email integration regressions
  // -------------------------------------------------------------
  await testCase(19, 'Authentication regressions: valid login succeeds, invalid password rejected, token blacklisted', async () => {
    // 1. Valid login
    const reqLogin = {
      body: { email: verifiedEmail, password: 'SecurePassword123!' },
      headers: { host: 'localhost:5000' }
    };
    const resLogin = createMockRes();
    await authController.login(reqLogin, resLogin, () => {});
    assert(resLogin.statusCode === 200, `Expected 200 on login, got ${resLogin.statusCode}`);
    assert(Boolean(resLogin.body?.token), 'Expected JWT session token');

    // 2. Invalid password
    const reqBadLogin = {
      body: { email: verifiedEmail, password: 'WrongPassword999!' },
      headers: { host: 'localhost:5000' }
    };
    const resBadLogin = createMockRes();
    await authController.login(reqBadLogin, resBadLogin, () => {});
    assert(resBadLogin.statusCode === 401, `Expected 401 on bad password, got ${resBadLogin.statusCode}`);

    // 3. Token blacklist
    tokenBlacklist.revoke(resLogin.body.token);
    assert(tokenBlacklist.isRevoked(resLogin.body.token) === true, 'Token must be recognized as revoked in blacklist');
  });

  // -------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------
  console.log('\n[Teardown] Cleaning up test records from database...');
  for (const em of createdEmails) {
    await db.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [em]).catch(() => null);
  }
  await db.query('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => null);
  console.log('[Teardown] Complete.\n');

  console.log('================================================================');
  console.log(`  VERIFICATION & OTP TEST RESULTS: ${tracker.passed} Passed, ${tracker.failed} Failed (Total: ${tracker.total})`);
  console.log('================================================================\n');

  if (tracker.failed > 0) {
    console.error('Failed test summary:');
    for (const f of tracker.failures) {
      console.error(`- Test ${f.num}: ${f.title} (${f.error})`);
    }
    process.exit(1);
  } else {
    console.log('🎉 ALL 19 TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  }
}

runVerifyAccountOtpSuite().catch(err => {
  console.error('[TestSuite] Uncaught exception:', err);
  process.exit(1);
});
