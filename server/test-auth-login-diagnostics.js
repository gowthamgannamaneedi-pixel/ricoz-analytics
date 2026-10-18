const http = require('http');
const app = require('./app');
const UserModel = require('./models/userModel');
const bcrypt = require('bcryptjs');
const db = require('./config/database');

/**
 * Enterprise Authentication Diagnostics & Verification Suite
 * Verifies:
 *  1. Existing users valid login
 *  2. Existing users wrong password (INVALID_CREDENTIALS)
 *  3. Unregistered email login (ACCOUNT_NOT_FOUND + suggestRegister)
 *  4. Registration creating user in same database with pending_verification
 *  5. Unverified account login rejection (EMAIL_NOT_VERIFIED)
 *  6. Email OTP verification activating account
 *  7. Full registration-to-login lifecycle
 *  8. Email normalization & case-insensitive matching
 *  9. Deactivated user handling
 * 10. Zero credential/hash exposure in responses
 */
function makeRequest(port, options, payload = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(rawData);
        } catch (_) {
          body = rawData;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', reject);

    if (payload) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function runAuthDiagnostics() {
  console.log('\n========================================================================');
  console.log(' 🛡️ RICOZANALYTICS ENTERPRISE AUTHENTICATION & REGISTRATION TEST SUITE');
  console.log('========================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, testName, failureDetails = '') {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] Test ${totalTests}: ${testName}`);
      if (failureDetails) console.error(`     Details: ${failureDetails}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Test 1: Existing Verified User Login (admin@ricoz.test)
    // -------------------------------------------------------------------------
    const adminLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: 'admin@ricoz.test',
      password: 'admin123'
    });

    assert(
      adminLogin.statusCode === 200 &&
      adminLogin.body.success === true &&
      typeof adminLogin.body.token === 'string' &&
      adminLogin.body.user.role === 'admin' &&
      adminLogin.body.user.status === 'active' &&
      !adminLogin.body.user.password_hash &&
      !adminLogin.body.user.password,
      'Existing User Login — Successfully logs in with valid credentials',
      JSON.stringify(adminLogin.body)
    );

    // -------------------------------------------------------------------------
    // Test 2: Existing User with Wrong Password (Invalid Credentials)
    // -------------------------------------------------------------------------
    const wrongPass = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: 'admin@ricoz.test',
      password: 'wrong_password_attempt_999'
    });

    assert(
      wrongPass.statusCode === 401 &&
      wrongPass.body.success === false &&
      wrongPass.body.error?.code === 'INVALID_CREDENTIALS' &&
      wrongPass.body.message.includes('Invalid email or password') &&
      !wrongPass.body.token,
      'Wrong Password — Rejected with 401 Unauthorized and code INVALID_CREDENTIALS',
      JSON.stringify(wrongPass.body)
    );

    // -------------------------------------------------------------------------
    // Test 3: Unregistered Account Login (Clear & Safe Error)
    // -------------------------------------------------------------------------
    const unregisteredEmail = `candidate_${Date.now()}@unregistered-company.test`;
    const unregisteredLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: unregisteredEmail,
      password: 'AnyPassword123!'
    });

    assert(
      unregisteredLogin.statusCode === 401 &&
      unregisteredLogin.body.success === false &&
      unregisteredLogin.body.error?.code === 'ACCOUNT_NOT_FOUND' &&
      unregisteredLogin.body.suggestRegister === true &&
      unregisteredLogin.body.message.includes('No account found with this email'),
      'Unregistered Account — Returns 401 with code ACCOUNT_NOT_FOUND and suggestRegister flag',
      JSON.stringify(unregisteredLogin.body)
    );

    // -------------------------------------------------------------------------
    // Test 4: New User Registration (Persists in Same Database with pending_verification)
    // -------------------------------------------------------------------------
    const newRegEmail = `testuser_verif_${Date.now()}@example.com`;
    const regPassword = 'SecurePassword2026!';
    const regRes = await makeRequest(port, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Dr. Jane Analyst',
      email: newRegEmail,
      organization_name: 'Jane Health Analytics',
      password: regPassword
    });

    assert(
      regRes.statusCode === 201 &&
      regRes.body.success === true &&
      regRes.body.requiresVerification === true &&
      Boolean(regRes.body.organization_id) &&
      regRes.body.email === newRegEmail.toLowerCase(),
      'New User Registration — Provisions tenant & saves record with pending_verification',
      JSON.stringify(regRes.body)
    );

    // Verify record in PostgreSQL database
    const dbUserCheck = await UserModel.findByEmail(newRegEmail);
    assert(
      dbUserCheck !== null &&
      dbUserCheck.status === 'pending_verification' &&
      Boolean(dbUserCheck.verification_otp || dbUserCheck.verification_token) &&
      dbUserCheck.email === newRegEmail.toLowerCase(),
      'Database Consistency — Registered user found in users table with pending_verification status',
      dbUserCheck ? `Status: ${dbUserCheck.status}` : 'Not found in DB'
    );

    const otpCode = dbUserCheck.verification_otp || regRes.body._devVerificationOtp;

    // -------------------------------------------------------------------------
    // Test 5: Unverified User Login Attempt (Blocked with 403 EMAIL_NOT_VERIFIED)
    // -------------------------------------------------------------------------
    const unverifiedLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: newRegEmail,
      password: regPassword
    });

    assert(
      unverifiedLogin.statusCode === 403 &&
      unverifiedLogin.body.success === false &&
      unverifiedLogin.body.error?.code === 'EMAIL_NOT_VERIFIED' &&
      unverifiedLogin.body.requiresVerification === true &&
      unverifiedLogin.body.message.includes('verify your email address before logging in'),
      'Unverified Login Rejection — Blocked with 403 Forbidden and code EMAIL_NOT_VERIFIED',
      JSON.stringify(unverifiedLogin.body)
    );

    // -------------------------------------------------------------------------
    // Test 6: Email Verification with 6-Digit OTP
    // -------------------------------------------------------------------------
    const verifyRes = await makeRequest(port, { path: '/api/auth/verify-email', method: 'POST' }, {
      email: newRegEmail,
      otp: otpCode
    });

    assert(
      verifyRes.statusCode === 200 &&
      verifyRes.body.success === true &&
      typeof verifyRes.body.token === 'string' &&
      verifyRes.body.user?.status === 'active',
      'Email OTP Verification — Successfully activates account and returns session token',
      JSON.stringify(verifyRes.body)
    );

    // Verify DB status updated to active
    const verifiedDbCheck = await UserModel.findByEmail(newRegEmail);
    assert(
      verifiedDbCheck !== null &&
      verifiedDbCheck.status === 'active' &&
      verifiedDbCheck.verification_otp === null,
      'Database State — User status transitioned to active and OTP cleared',
      `DB Status: ${verifiedDbCheck?.status}`
    );

    // -------------------------------------------------------------------------
    // Test 7: Newly Verified User Login (Full Registration-to-Login Complete)
    // -------------------------------------------------------------------------
    const newVerifiedLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: newRegEmail,
      password: regPassword
    });

    assert(
      newVerifiedLogin.statusCode === 200 &&
      newVerifiedLogin.body.success === true &&
      typeof newVerifiedLogin.body.token === 'string' &&
      newVerifiedLogin.body.user.email === newRegEmail.toLowerCase() &&
      newVerifiedLogin.body.user.status === 'active' &&
      newVerifiedLogin.body.user.role === 'admin',
      'Registration-to-Login Lifecycle — Newly verified user logs in successfully',
      JSON.stringify(newVerifiedLogin.body)
    );

    // -------------------------------------------------------------------------
    // Test 8: Case-Insensitive Email Normalization
    // -------------------------------------------------------------------------
    const upperCaseLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: 'ADMIN@RICOZ.TEST',
      password: 'admin123'
    });

    assert(
      upperCaseLogin.statusCode === 200 &&
      upperCaseLogin.body.user.email === 'admin@ricoz.test',
      'Email Normalization — Case-insensitive email (UPPERCASE) authenticates seamlessly',
      JSON.stringify(upperCaseLogin.body)
    );

    // -------------------------------------------------------------------------
    // Test 9: Deactivated User Account Handling
    // -------------------------------------------------------------------------
    // Create a deactivated test user
    const deactEmail = `deactivated_${Date.now()}@test.com`;
    const deactHash = await bcrypt.hash('deactPass123', 10);
    await UserModel.create({
      name: 'Deactivated User',
      email: deactEmail,
      password_hash: deactHash,
      role: 'viewer',
      status: 'deactivated',
      organization_id: adminLogin.body.user.organization_id
    });

    const deactLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: deactEmail,
      password: 'deactPass123'
    });

    assert(
      deactLogin.statusCode === 403 &&
      deactLogin.body.error?.code === 'ACCOUNT_DEACTIVATED' &&
      deactLogin.body.message.includes('account has been deactivated'),
      'Deactivated Account — Blocked with 403 Forbidden and code ACCOUNT_DEACTIVATED',
      JSON.stringify(deactLogin.body)
    );

    // -------------------------------------------------------------------------
    // Test 10: Security Credential Masking in Responses
    // -------------------------------------------------------------------------
    const allResponses = [adminLogin.body, wrongPass.body, unregisteredLogin.body, regRes.body, unverifiedLogin.body, verifyRes.body, newVerifiedLogin.body];
    const rawString = JSON.stringify(allResponses);
    const hasExposedPasswordHash = rawString.includes('$2a$') || rawString.includes('$2b$');
    const hasPlainPassword = rawString.includes(regPassword) || rawString.includes('admin123');

    assert(
      !hasExposedPasswordHash && !hasPlainPassword,
      'Security Compliance — Password hashes and plaintext credentials never leaked in API responses',
      `Exposed hash: ${hasExposedPasswordHash}, Exposed pass: ${hasPlainPassword}`
    );

    console.log('\n========================================================================');
    console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${passedTests === totalTests ? '100% SUCCESS' : 'FAILURES DETECTED'})`);
    console.log('========================================================================\n');

    server.close(() => {
      process.exit(passedTests === totalTests ? 0 : 1);
    });
  } catch (err) {
    console.error('Fatal diagnostic suite error:', err);
    server.close(() => {
      process.exit(1);
    });
  }
}

runAuthDiagnostics();
