/**
 * FINAL PRODUCTION VERIFICATION SUITE — RicozAnalytics
 * Validates Cases A, B, C, D, E, F against the live server and database.
 */

require('dotenv').config();
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
  console.log('======================================================================');
  console.log(' RICOZ ANALYTICS - FINAL PRODUCTION REGISTRATION & VERIFICATION SUITE');
  console.log('======================================================================');

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

  const realTargetEmail = 'gowthamgannamaneedi@gmail.com';
  const password = 'ProductionPassword2026!';

  // =========================================================================
  // CASE A: New user registration with real email address
  // =========================================================================
  console.log(`\n--- CASE A: Register new user with real email (${realTargetEmail}) ---`);
  await db.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [realTargetEmail]);

  const regResA = await post('/api/auth/register', {
    name: 'Gowtham Production Lead',
    email: realTargetEmail,
    organization_name: 'Apex Global Analytics',
    password
  });

  assert(regResA.status === 201, `New registration returns HTTP 201 Created (got ${regResA.status})`);
  assert(regResA.body?.requiresVerification === true, 'Response flags requiresVerification: true');
  assert(regResA.body?.user?.email === realTargetEmail, `User email normalized correctly to "${realTargetEmail}"`);
  assert(regResA.body?.user?.status === 'pending_verification', 'User initially created in pending_verification status');
  
  // Verify live Gmail SMTP dispatch details
  const deliveryA = regResA.body?.email_delivery || {};
  assert(deliveryA.success === true, 'Gmail SMTP reported successful message acceptance');
  assert(deliveryA.recipient === realTargetEmail, `Message addressed to submitted email: ${deliveryA.recipient}`);
  assert(deliveryA.deliveredTo === realTargetEmail, `Delivery was NOT redirected (deliveredTo === recipient)`);
  assert(deliveryA.isTestRedirect === false, 'isTestRedirect is strictly false for real user email');

  // Verify DB state
  const dbUserA = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [realTargetEmail])).rows[0];
  assert(Boolean(dbUserA), 'User persisted in PostgreSQL users table');
  assert(dbUserA.status === 'pending_verification', 'Account status in DB is pending_verification');
  assert(Boolean(dbUserA.verification_token) && dbUserA.verification_token.length >= 32, 'Cryptographic token generated and stored');
  assert(Boolean(dbUserA.verification_otp) && dbUserA.verification_otp.length === 6, '6-digit OTP generated and stored');
  assert(new Date(dbUserA.verification_token_expires_at) > new Date(), 'Token expiration timestamp is in the future');

  // Verify unverified login is blocked
  const unverifiedLogin = await post('/api/auth/login', { email: realTargetEmail, password });
  assert(unverifiedLogin.status === 403, `Unverified login blocked with HTTP 403 (got ${unverifiedLogin.status})`);
  assert(unverifiedLogin.body?.error?.code === 'EMAIL_NOT_VERIFIED', 'Error code is EMAIL_NOT_VERIFIED');

  // =========================================================================
  // CASE B: Complete verification and log in
  // =========================================================================
  console.log('\n--- CASE B: Complete verification and log in ---');
  const verifyResB = await post('/api/auth/verify-email', { token: dbUserA.verification_token });
  assert(verifyResB.status === 200, `POST /api/auth/verify-email returns 200 OK (got ${verifyResB.status})`);
  assert(Boolean(verifyResB.body?.token), 'Valid session JWT returned upon verification');

  // Check DB transition
  const dbUserB = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [realTargetEmail])).rows[0];
  assert(dbUserB.status === 'active', 'User status transitioned to active in database');
  assert(dbUserB.verification_token === null, 'Single-use: verification_token cleared to NULL');
  assert(dbUserB.verification_otp === null, 'Single-use: verification_otp cleared to NULL');
  assert(Boolean(dbUserB.email_verified_at), 'email_verified_at timestamp populated');

  // Log in with verified account
  const loginResB = await post('/api/auth/login', { email: realTargetEmail, password });
  assert(loginResB.status === 200, 'Login succeeds with 200 OK for verified account');
  assert(loginResB.body?.user?.status === 'active', 'User profile reports status is active');

  // =========================================================================
  // CASE C: Same verified email registers again
  // =========================================================================
  console.log('\n--- CASE C: Re-registration of already-verified account ---');
  const regResC = await post('/api/auth/register', {
    name: 'Gowtham Impostor',
    email: realTargetEmail,
    organization_name: 'Duplicate Org Attempt',
    password: 'DifferentPassword999!'
  });

  assert(regResC.status === 409, `Re-registration of verified account rejected with HTTP 409 (got ${regResC.status})`);
  assert(regResC.body?.code === 'EMAIL_ALREADY_VERIFIED', 'Error code is EMAIL_ALREADY_VERIFIED');
  assert(regResC.body?.isVerified === true, 'Response flags isVerified = true');
  assert(regResC.body?.message.includes('already exists and is active'), 'Directs user to log in or reset password');

  // Verify existing user's password and organization were NOT overwritten
  const dbUserC = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [realTargetEmail])).rows[0];
  assert(dbUserC.name === 'Gowtham Production Lead', 'Existing user name was NOT overwritten');
  assert(dbUserC.organization_id === dbUserA.organization_id, 'Existing organization_id preserved');
  // Confirm original password still works
  const originalLogin = await post('/api/auth/login', { email: realTargetEmail, password });
  assert(originalLogin.status === 200, 'Original password still authenticates successfully');

  // =========================================================================
  // CASE D: Existing unverified account registers again (The screenshot failure)
  // =========================================================================
  console.log('\n--- CASE D: Re-registration of existing UNVERIFIED account ---');
  const unverifiedEmail = 'unverified_tester@ricoz.test';
  await db.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [unverifiedEmail]);

  // 1. Initial registration (simulates user who did not receive or lost the email)
  const initialReg = await post('/api/auth/register', {
    name: 'Priya Unverified',
    email: unverifiedEmail,
    organization_name: 'Priya Startup Inc',
    password: 'OriginalPassword123!'
  });
  assert(initialReg.status === 201, 'Initial registration succeeds (201 Created)');
  const initialDbUser = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [unverifiedEmail])).rows[0];
  const initialToken = initialDbUser.verification_token;
  const initialOrgId = initialDbUser.organization_id;

  // 2. User re-enters the registration form with the same email (e.g. within cooldown window)
  console.log('  Simulating user submitting registration form again for existing unverified email...');
  const reRegRes = await post('/api/auth/register', {
    name: 'Priya Unverified',
    email: unverifiedEmail,
    organization_name: 'Priya Startup Inc',
    password: 'OriginalPassword123!'
  });

  assert(reRegRes.status === 200, `Re-registering unverified email returns HTTP 200 OK (got ${reRegRes.status})`);
  assert(reRegRes.body?.requiresVerification === true, 'Response flags requiresVerification: true');
  assert(reRegRes.body?.isExistingUnverified === true, 'Response flags isExistingUnverified: true');
  assert(reRegRes.body?.message.includes('pending verification'), 'Clear informational message returned');

  // Verify account details and tokens are safely preserved without creating duplicate organizations
  const refreshedDbUser = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [unverifiedEmail])).rows[0];
  assert(Boolean(refreshedDbUser.verification_token), 'Valid cryptographic verification token exists in DB');
  assert(refreshedDbUser.organization_id === initialOrgId, 'Organization ID was preserved (no duplicate tenant created)');
  assert(refreshedDbUser.status === 'pending_verification', 'Status remains strictly pending_verification');

  // Complete verification with the valid token
  console.log('  Verifying account using token...');
  const verifyResD = await post('/api/auth/verify-email', { token: refreshedDbUser.verification_token });
  assert(verifyResD.status === 200, 'Verification with valid token succeeds (200 OK)');

  // Verify account is now active and can log in with original password
  const loginResD = await post('/api/auth/login', { email: unverifiedEmail, password: 'OriginalPassword123!' });
  assert(loginResD.status === 200, 'Account logs in successfully with original password after verification');

  // =========================================================================
  // CASE E: Invalid, expired, and reused tokens are rejected
  // =========================================================================
  console.log('\n--- CASE E: Invalid and expired token rejection ---');
  const invalidTokenRes = await post('/api/auth/verify-email', { token: 'completely_invalid_hex_token_123456789' });
  assert(invalidTokenRes.status === 400, `Invalid token rejected with 400 (got ${invalidTokenRes.status})`);

  const emptyTokenRes = await post('/api/auth/verify-email', { token: '' });
  assert(emptyTokenRes.status === 400, `Empty token rejected with 400 (got ${emptyTokenRes.status})`);

  // Token reuse rejection
  const reuseTokenRes = await post('/api/auth/verify-email', { token: refreshedDbUser.verification_token });
  assert(reuseTokenRes.status === 400, `Reused token rejected with 400 (got ${reuseTokenRes.status})`);

  // Expired token rejection
  const expiredEmail = 'expired_user_test@ricoz.test';
  await db.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [expiredEmail]);
  await post('/api/auth/register', { name: 'Expired User', email: expiredEmail, organization_name: 'Exp Org', password });
  // Force token expiration in past
  await db.query("UPDATE users SET verification_token_expires_at = NOW() - INTERVAL '1 hour' WHERE email = $1", [expiredEmail]);
  const expDbUser = (await db.query('SELECT * FROM users WHERE email = $1', [expiredEmail])).rows[0];
  const expiredRes = await post('/api/auth/verify-email', { token: expDbUser.verification_token });
  assert(expiredRes.status === 400, `Expired token rejected with 400 (got ${expiredRes.status})`);
  assert(expiredRes.body?.error?.code === 'TOKEN_EXPIRED', 'Error code is TOKEN_EXPIRED');

  // =========================================================================
  // CASE F: Resend Rate Limiting and Enumeration Protection
  // =========================================================================
  console.log('\n--- CASE F: Resend rate limiting and account enumeration protection ---');
  // Immediate resend blocked by rate limit
  const rateLimitTestEmail = 'ratelimit_tester@ricoz.test';
  await db.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [rateLimitTestEmail]);
  await post('/api/auth/register', { name: 'Rate User', email: rateLimitTestEmail, organization_name: 'Rate Org', password });
  
  const immediateResend = await post('/api/auth/resend-verification', { email: rateLimitTestEmail });
  assert(immediateResend.status === 429, `Immediate resend rejected with HTTP 429 Rate Limited (got ${immediateResend.status})`);
  assert(immediateResend.body?.error?.code === 'RATE_LIMITED', 'Error code is RATE_LIMITED');

  // Account enumeration protection for non-existent email
  const nonExistentEmail = 'completely_unregistered_random_user_9999@domain.test';
  const enumCheck = await post('/api/auth/resend-verification', { email: nonExistentEmail });
  assert(enumCheck.status === 200, `Non-existent email returns 200 to prevent enumeration (got ${enumCheck.status})`);
  assert(enumCheck.body?.message.includes('If an unverified account exists'), 'Returns generic message');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log(` FINAL TEST RESULTS: ${passed}/${total} ASSERTIONS PASSED (${passed === total ? '100% SUCCESS' : 'FAILURES DETECTED'})`);
  console.log('======================================================================\n');

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
