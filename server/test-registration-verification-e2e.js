/**
 * End-to-End Registration & Email Verification Test Suite
 * Validates registration, SMTP dispatch, token security, rate limiting, and single-use enforcement.
 */

const http = require('http');
const db = require('./config/database');

const BASE_URL = 'http://localhost:5000';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, {
      method: 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log(' RicozAnalytics Registration & Verification E2E Test Suite');
  console.log('===============================================================');

  const liveTargetEmail = 'gowthamgannamaneedi@gmail.com';
  const password = 'TestSecurePass2026!';
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Existing verified account login
  console.log('\n[Test 1] Existing verified admin login...');
  const existingLogin = await post('/api/auth/login', { email: 'admin@ricoz.test', password: 'admin123' });
  assert(existingLogin.status === 200 && existingLogin.body?.token, 'Existing verified account logs in normally');

  // 2. Clean existing record for test email if present
  console.log(`\n[Test 2] Resetting user record for ${liveTargetEmail}...`);
  await db.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [liveTargetEmail]);

  // 3. Register with actual live recipient email
  console.log(`\n[Test 3] Registering new user (${liveTargetEmail})...`);
  const regRes = await post('/api/auth/register', {
    name: 'Gowtham Live Verifier',
    email: liveTargetEmail,
    organization_name: 'Gowtham Live Org',
    password
  });

  assert(regRes.status === 201, `Registration HTTP status is 201 Created (got ${regRes.status})`);
  assert(regRes.body?.requiresVerification === true, 'Response flags requiresVerification = true');
  assert(regRes.body?.user?.status === 'pending_verification', 'User created with pending_verification status');
  assert(regRes.body?.email_delivery?.success === true, 'Verification email dispatch reported success');
  assert(!regRes.body?._devVerificationOtp && !regRes.body?._devVerificationToken, 'Zero exposure: token & OTP NOT returned in API response');

  // 4. Inspect PostgreSQL Database
  console.log('\n[Test 4] Verifying database record and token storage...');
  let dbUser = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [liveTargetEmail])).rows[0];
  assert(Boolean(dbUser), 'User record exists in PostgreSQL users table');
  assert(dbUser.status === 'pending_verification', 'Database status is strictly pending_verification');
  assert(Boolean(dbUser.verification_token) && dbUser.verification_token.length >= 32, 'Cryptographic verification token stored in DB');
  assert(Boolean(dbUser.verification_otp) && dbUser.verification_otp.length === 6, '6-digit OTP stored in DB');
  assert(new Date(dbUser.verification_token_expires_at) > new Date(), 'Token expiration timestamp is in the future');

  // 5. Attempt login before email verification
  console.log('\n[Test 5] Attempt login before email verification...');
  const unverifiedLogin = await post('/api/auth/login', { email: liveTargetEmail, password });
  assert(unverifiedLogin.status === 403, `Login rejected with 403 Forbidden (got ${unverifiedLogin.status})`);
  assert(unverifiedLogin.body?.error?.code === 'EMAIL_NOT_VERIFIED', 'Error code is EMAIL_NOT_VERIFIED');

  // 6. Test Resend Cooldown
  console.log('\n[Test 6] Resend verification cooldown enforcement (immediate resend blocked)...');
  const immediateResend = await post('/api/auth/resend-verification', { email: liveTargetEmail });
  assert(immediateResend.status === 429, `Immediate resend blocked with 429 Too Many Requests (got ${immediateResend.status})`);
  assert(immediateResend.body?.error?.code === 'RATE_LIMITED', 'Error code is RATE_LIMITED');

  // 7. Test Invalid Token / Malformed requests
  console.log('\n[Test 7] Invalid token and malformed requests...');
  const badTokenRes = await post('/api/auth/verify-email', { token: 'invalid_bogus_token_12345' });
  assert(badTokenRes.status === 400, `Bogus token rejected with 400 (got ${badTokenRes.status})`);

  const badOtpRes = await post('/api/auth/verify-email', { email: liveTargetEmail, otp: '000000' });
  assert(badOtpRes.status === 400, `Incorrect OTP rejected with 400 (got ${badOtpRes.status})`);

  const malformedRes = await post('/api/auth/verify-email', {});
  assert(malformedRes.status === 400, `Empty verification payload rejected with 400 (got ${malformedRes.status})`);

  // 8. Test Expired Token
  console.log('\n[Test 8] Expired token rejection...');
  await db.query('UPDATE users SET verification_token_expires_at = CURRENT_TIMESTAMP - INTERVAL \'1 hour\' WHERE LOWER(email) = LOWER($1)', [liveTargetEmail]);
  const expiredRes = await post('/api/auth/verify-email', { token: dbUser.verification_token });
  assert(expiredRes.status === 400, `Expired token rejected with 400 (got ${expiredRes.status})`);
  assert(expiredRes.body?.error?.code === 'TOKEN_EXPIRED', `Error code is TOKEN_EXPIRED (got ${expiredRes.body?.error?.code})`);

  // 9. Restore valid token & verify successfully via link token
  console.log('\n[Test 9] Verification with valid token...');
  await db.query('UPDATE users SET verification_token_expires_at = CURRENT_TIMESTAMP + INTERVAL \'24 hours\' WHERE LOWER(email) = LOWER($1)', [liveTargetEmail]);
  const verifyRes = await post('/api/auth/verify-email', { token: dbUser.verification_token });
  assert(verifyRes.status === 200, `Verification returned 200 OK (got ${verifyRes.status})`);
  assert(Boolean(verifyRes.body?.token), 'Auth session JWT returned upon verification');
  assert(verifyRes.body?.user?.status === 'active', 'User status transitioned to active');

  // 10. Verify database state post-verification
  console.log('\n[Test 10] Checking database state post-verification...');
  const verifiedDbUser = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [liveTargetEmail])).rows[0];
  assert(verifiedDbUser.status === 'active', 'Database user status is active');
  assert(Boolean(verifiedDbUser.email_verified_at), 'email_verified_at timestamp is set');
  assert(verifiedDbUser.verification_token === null, 'verification_token cleared to NULL (single-use enforced)');
  assert(verifiedDbUser.verification_otp === null, 'verification_otp cleared to NULL (single-use enforced)');

  // 11. Attempt token reuse
  console.log('\n[Test 11] Token reuse prevention...');
  const reuseRes = await post('/api/auth/verify-email', { token: dbUser.verification_token });
  assert(reuseRes.status === 400, `Reused token rejected with 400 (got ${reuseRes.status})`);

  // 12. Login after verification
  console.log('\n[Test 12] Login after successful verification...');
  const postVerifyLogin = await post('/api/auth/login', { email: liveTargetEmail, password });
  assert(postVerifyLogin.status === 200, `Login succeeds with 200 OK (got ${postVerifyLogin.status})`);
  assert(Boolean(postVerifyLogin.body?.token), 'Session token returned for verified user');
  assert(postVerifyLogin.body?.user?.email === liveTargetEmail, 'Logged in user matches registered email');

  // 13. Test GET /api/auth/verify-email/:token redirect behavior
  console.log('\n[Test 13] Browser redirect on GET /api/auth/verify-email/:token...');
  const redirectRes = await get('/api/auth/verify-email/sample_token_abc', { 'Accept': 'text/html' });
  assert(redirectRes.status === 302, `Browser GET request redirects with 302 (got ${redirectRes.status})`);
  assert(redirectRes.headers?.location?.includes('/auth/verify-email?token='), 'Redirect Location points to frontend verification page');

  console.log('\n===============================================================');
  console.log(` Results: ${passed} of ${total} assertions passed (${total === passed ? '100% SUCCESS' : 'FAILURES DETECTED'})`);
  console.log('===============================================================');

  process.exit(total === passed ? 0 : 1);
}

runTests().catch(err => {
  console.error('[FATAL]:', err);
  process.exit(1);
});
