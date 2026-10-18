const http = require('http');
const app = require('./app');
const UserModel = require('./models/userModel');

/**
 * Regression Test Suite for RicozAnalytics Login Flow
 * Covers:
 *  1. New / never-registered email -> 401 ACCOUNT_NOT_FOUND, suggestRegister: true
 *  2. Existing unverified account -> 403 EMAIL_NOT_VERIFIED, requiresVerification: true
 *  3. Existing verified account -> 200 OK with session token
 *  4. Incorrect password for existing account -> 401 INVALID_CREDENTIALS
 *  5. Email normalization (trim + lowercase) across all paths
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

async function runLoginFlowRegressionSuite() {
  console.log('\n========================================================================');
  console.log(' 🛡️ RICOZANALYTICS AUTHENTICATION LOGIN FLOW REGRESSION TEST SUITE');
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
    // Test 1: New / Never-registered email -> 401 with ACCOUNT_NOT_FOUND & suggestRegister
    // -------------------------------------------------------------------------
    const brandNewEmail = `fresh_user_${Date.now()}@unregistered-domain.com`;
    const resUnregistered = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: brandNewEmail,
      password: 'AnyPassword123!'
    });

    assert(
      resUnregistered.statusCode === 401 &&
      resUnregistered.body.success === false &&
      resUnregistered.body.error?.code === 'ACCOUNT_NOT_FOUND' &&
      resUnregistered.body.suggestRegister === true &&
      resUnregistered.body.requiresRegistration === true &&
      resUnregistered.body.message === 'No account found with this email. Please register to create your workspace.' &&
      !resUnregistered.body.message.toLowerCase().includes('verify') &&
      resUnregistered.body.requiresVerification !== true,
      'Never-registered email -> returns 401 ACCOUNT_NOT_FOUND with suggestRegister: true and clean message (no verification prompt)',
      JSON.stringify(resUnregistered.body)
    );

    // -------------------------------------------------------------------------
    // Test 2: Email Normalization for unregistered email (spaces and uppercase)
    // -------------------------------------------------------------------------
    const resUnregisteredNormalized = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: `   ${brandNewEmail.toUpperCase()}   `,
      password: 'AnyPassword123!'
    });

    assert(
      resUnregisteredNormalized.statusCode === 401 &&
      resUnregisteredNormalized.body.error?.code === 'ACCOUNT_NOT_FOUND' &&
      resUnregisteredNormalized.body.email === brandNewEmail.toLowerCase() &&
      resUnregisteredNormalized.body.suggestRegister === true,
      'Email Normalization -> Unregistered email with mixed case & padding trimmed and lowercased',
      JSON.stringify(resUnregisteredNormalized.body)
    );

    // -------------------------------------------------------------------------
    // Test 3: Existing Unverified Account -> 403 with EMAIL_NOT_VERIFIED
    // -------------------------------------------------------------------------
    const unverifiedEmail = `pending_user_${Date.now()}@testcorp.com`;
    const regPassword = 'SecurePassword2026!';
    const regRes = await makeRequest(port, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Unverified Test Candidate',
      email: unverifiedEmail,
      organization_name: 'Unverified Corp',
      password: regPassword
    });

    assert(
      regRes.statusCode === 201 &&
      regRes.body.requiresVerification === true,
      'Setup unverified account -> 201 Created with status pending_verification',
      JSON.stringify(regRes.body)
    );

    // Attempt login on the unverified account
    const resUnverifiedLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: unverifiedEmail,
      password: regPassword
    });

    assert(
      resUnverifiedLogin.statusCode === 403 &&
      resUnverifiedLogin.body.success === false &&
      resUnverifiedLogin.body.error?.code === 'EMAIL_NOT_VERIFIED' &&
      resUnverifiedLogin.body.requiresVerification === true &&
      resUnverifiedLogin.body.message.toLowerCase().includes('verify your email') &&
      resUnverifiedLogin.body.suggestRegister !== true,
      'Existing unverified account -> returns 403 EMAIL_NOT_VERIFIED with verification prompt',
      JSON.stringify(resUnverifiedLogin.body)
    );

    // -------------------------------------------------------------------------
    // Test 4: Existing Verified Account -> 200 OK with normal login and JWT
    // -------------------------------------------------------------------------
    const resVerifiedLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: 'admin@ricoz.test',
      password: 'admin123'
    });

    assert(
      resVerifiedLogin.statusCode === 200 &&
      resVerifiedLogin.body.success === true &&
      typeof resVerifiedLogin.body.token === 'string' &&
      resVerifiedLogin.body.user.role === 'admin' &&
      resVerifiedLogin.body.user.status === 'active' &&
      !resVerifiedLogin.body.user.password_hash,
      'Existing verified account -> returns 200 OK with valid JWT and active status',
      JSON.stringify(resVerifiedLogin.body)
    );

    // -------------------------------------------------------------------------
    // Test 5: Existing Verified Account with mixed case & padding -> 200 OK
    // -------------------------------------------------------------------------
    const resVerifiedNormalized = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: '  ADMIN@RICOZ.TEST  ',
      password: 'admin123'
    });

    assert(
      resVerifiedNormalized.statusCode === 200 &&
      resVerifiedNormalized.body.success === true &&
      resVerifiedNormalized.body.user.email === 'admin@ricoz.test',
      'Existing verified account email normalization -> matches case-insensitively',
      JSON.stringify(resVerifiedNormalized.body)
    );

    // -------------------------------------------------------------------------
    // Test 6: Incorrect Password for Existing Account -> 401 INVALID_CREDENTIALS
    // -------------------------------------------------------------------------
    const resWrongPass = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: 'admin@ricoz.test',
      password: 'completely_incorrect_password_999'
    });

    assert(
      resWrongPass.statusCode === 401 &&
      resWrongPass.body.success === false &&
      resWrongPass.body.error?.code === 'INVALID_CREDENTIALS' &&
      resWrongPass.body.message.includes('Invalid email or password') &&
      resWrongPass.body.suggestRegister !== true &&
      resWrongPass.body.requiresVerification !== true,
      'Incorrect password for existing account -> returns 401 INVALID_CREDENTIALS without register prompt',
      JSON.stringify(resWrongPass.body)
    );

    // -------------------------------------------------------------------------
    // Test 7: Absence of sensitive data leakage
    // -------------------------------------------------------------------------
    assert(
      !resUnregistered.body.token &&
      !resUnverifiedLogin.body.token &&
      !resWrongPass.body.token &&
      !JSON.stringify(resWrongPass.body).includes('password_hash'),
      'Security posture -> zero credential or hash exposure in rejection flows'
    );

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close();
  }

  console.log('\n========================================================================');
  console.log(` RESULTS: ${passedTests}/${totalTests} tests passed`);
  console.log('========================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runLoginFlowRegressionSuite();
