/**
 * RicozAnalytics - Real Inbox Verification & Test Recipient Routing Suite
 * 
 * Tests:
 * 1. Register with placeholder recipient 'testuser_verif_1@example.com':
 *    - Validates that Gmail "Address not found" bounce is eliminated.
 *    - Validates email is safely delivered to configured TEST_EMAIL_INBOX (gowthamgannamaneedi@gmail.com).
 *    - Validates account remains 'pending_verification' in database.
 *    - Validates login is blocked with 403 EMAIL_NOT_VERIFIED before verification.
 *    - Validates token verification endpoint transitions account to 'active'.
 *    - Validates token is single-use and cleared to NULL.
 *    - Validates login succeeds with 200 and JWT after verification.
 * 2. Register with direct real email (gowthamgannamaneedi@gmail.com):
 *    - Validates direct un-redirected delivery to the real address via Gmail SMTP.
 *    - Validates complete token verification lifecycle.
 * 3. Safe Mock Delivery for placeholder tests when MOCK_EMAIL=true:
 *    - Validates automated unit tests can run without live SMTP calls.
 *    - Validates account remains strictly 'pending_verification' until token is validated.
 */

require('dotenv').config();
const http = require('http');
const db = require('./config/database');
const emailService = require('./services/emailService');

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

async function runTestSuite() {
  console.log('======================================================================');
  console.log(' RICOZ ANALYTICS - REGISTRATION EMAIL VERIFICATION TEST SUITE');
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

  const placeholderEmail = 'testuser_verif_1@example.com';
  const realInboxEmail = 'gowthamgannamaneedi@gmail.com';
  const testPassword = 'SecurePassword2026!';

  // =========================================================================
  // SCENARIO 1: Registering with 'testuser_verif_1@example.com'
  // =========================================================================
  console.log(`\n--- SCENARIO 1: Testing Registration for "${placeholderEmail}" ---`);
  console.log(`  (Should route to configured test inbox "${realInboxEmail}", preventing Gmail 550 bounce)`);

  // Clean previous records
  await db.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [placeholderEmail]);

  const regPlaceholderRes = await post('/api/auth/register', {
    name: 'Test User Verif 1',
    email: placeholderEmail,
    organization_name: 'Example Org',
    password: testPassword
  });

  assert(regPlaceholderRes.status === 201, `Registration returned HTTP 201 Created (got ${regPlaceholderRes.status})`);
  assert(regPlaceholderRes.body?.requiresVerification === true, 'Response flags requiresVerification: true');
  assert(regPlaceholderRes.body?.user?.email === placeholderEmail, `User registered under submitted email "${placeholderEmail}"`);
  assert(regPlaceholderRes.body?.user?.status === 'pending_verification', 'User status initialized as "pending_verification"');
  
  // Inspect email delivery telemetry
  const delivery = regPlaceholderRes.body?.email_delivery || {};
  assert(delivery.success === true, 'Email delivery succeeded without bounce error');
  assert(delivery.isTestRedirect === true || delivery.mocked === true, 'Placeholder domain handled safely (test redirect or safe mock)');
  assert(delivery.mocked === true || delivery.deliveredTo === realInboxEmail, `Email safely mocked or delivered to test inbox: "${delivery.deliveredTo}"`);

  // Inspect PostgreSQL Database
  const dbUser1 = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [placeholderEmail])).rows[0];
  assert(Boolean(dbUser1), `User record exists in DB for "${placeholderEmail}"`);
  assert(dbUser1.status === 'pending_verification', 'CRITICAL: Account is NOT verified merely because an email was sent');
  assert(Boolean(dbUser1.verification_token), 'Cryptographic verification token stored in DB');
  assert(Boolean(dbUser1.verification_otp) && dbUser1.verification_otp.length === 6, '6-digit OTP stored in DB');
  assert(new Date(dbUser1.verification_token_expires_at) > new Date(), 'Token expiration timestamp is active (24 hours)');

  // Attempt login before verification
  console.log('\n  Checking login blocking before verification...');
  const blockedLogin1 = await post('/api/auth/login', { email: placeholderEmail, password: testPassword });
  assert(blockedLogin1.status === 403, `Login rejected with HTTP 403 Forbidden (got ${blockedLogin1.status})`);
  assert(blockedLogin1.body?.error?.code === 'EMAIL_NOT_VERIFIED', 'Error code is EMAIL_NOT_VERIFIED');

  // Verify account using the token from the email
  console.log('\n  Verifying account via POST /api/auth/verify-email with valid token...');
  const verifyTokenRes1 = await post('/api/auth/verify-email', { token: dbUser1.verification_token });
  assert(verifyTokenRes1.status === 200, `Verification endpoint returned HTTP 200 OK (got ${verifyTokenRes1.status})`);
  assert(Boolean(verifyTokenRes1.body?.token), 'JWT authentication token issued upon successful verification');

  // Check database after verification
  const dbUser1Verified = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [placeholderEmail])).rows[0];
  assert(dbUser1Verified.status === 'active', 'User status transitioned to "active" in database');
  assert(dbUser1Verified.verification_token === null, 'Single-use enforced: verification_token cleared to NULL');
  assert(dbUser1Verified.verification_otp === null, 'Single-use enforced: verification_otp cleared to NULL');

  // Attempt token reuse
  console.log('\n  Testing token reuse prevention...');
  const reuseRes1 = await post('/api/auth/verify-email', { token: dbUser1.verification_token });
  assert(reuseRes1.status === 400, `Reusing invalidated token rejected with HTTP 400 (got ${reuseRes1.status})`);

  // Login after verification
  console.log('\n  Logging in after verification...');
  const loginSuccess1 = await post('/api/auth/login', { email: placeholderEmail, password: testPassword });
  assert(loginSuccess1.status === 200, `Login succeeded with HTTP 200 OK (got ${loginSuccess1.status})`);
  assert(Boolean(loginSuccess1.body?.token), 'Login issued valid session JWT token');
  assert(loginSuccess1.body?.user?.status === 'active', 'Session profile reports user status is "active"');

  // =========================================================================
  // SCENARIO 2: Registering directly with real email (gowthamgannamaneedi@gmail.com)
  // =========================================================================
  console.log(`\n--- SCENARIO 2: Testing Direct Registration with Real Email "${realInboxEmail}" ---`);
  console.log(`  (Should deliver directly without redirection to ${realInboxEmail})`);

  await db.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [realInboxEmail]);

  const regRealRes = await post('/api/auth/register', {
    name: 'Gowtham Live Account',
    email: realInboxEmail,
    organization_name: 'Gowtham Production Org',
    password: testPassword
  });

  assert(regRealRes.status === 201, `Registration returned HTTP 201 Created (got ${regRealRes.status})`);
  assert(regRealRes.body?.user?.email === realInboxEmail, `Registered under real email "${realInboxEmail}"`);
  assert(regRealRes.body?.email_delivery?.success === true, 'Verification email dispatched successfully via Gmail SMTP');
  assert(regRealRes.body?.email_delivery?.isTestRedirect === false, 'Direct real email is NOT redirected (isTestRedirect: false)');
  assert(regRealRes.body?.email_delivery?.deliveredTo === realInboxEmail, `Delivered directly to real address "${realInboxEmail}"`);

  // Verify database state
  const dbUser2 = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [realInboxEmail])).rows[0];
  assert(dbUser2.status === 'pending_verification', 'User created in pending_verification status');

  // Verify with 6-digit OTP
  console.log('\n  Verifying account via 6-digit OTP...');
  const verifyOtpRes2 = await post('/api/auth/verify-email', {
    email: realInboxEmail,
    otp: dbUser2.verification_otp
  });
  assert(verifyOtpRes2.status === 200, `OTP verification returned HTTP 200 OK (got ${verifyOtpRes2.status})`);

  const dbUser2Verified = (await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [realInboxEmail])).rows[0];
  assert(dbUser2Verified.status === 'active', 'User status transitioned to "active"');
  assert(dbUser2Verified.verification_otp === null, 'OTP cleared to NULL in database');

  // Login after OTP verification
  const loginSuccess2 = await post('/api/auth/login', { email: realInboxEmail, password: testPassword });
  assert(loginSuccess2.status === 200, 'Login succeeded after OTP verification');

  // =========================================================================
  // SCENARIO 3: Automated Test Safe Mock (MOCK_EMAIL=true)
  // =========================================================================
  console.log('\n--- SCENARIO 3: Testing Automated Test Mocking (emailService with synthetic placeholder) ---');
  
  // Directly test emailService helper and mock mode
  assert(emailService.isTestOrPlaceholderRecipient('testuser_verif_1@example.com') === true, 'Detects example.com as placeholder');
  assert(emailService.isTestOrPlaceholderRecipient('user@test.com') === true, 'Detects test.com as placeholder');
  assert(emailService.isTestOrPlaceholderRecipient('analyst@ricoz.test') === true, 'Detects .test TLD as placeholder');
  assert(emailService.isTestOrPlaceholderRecipient('gowthamgannamaneedi@gmail.com') === false, 'Identifies real Gmail as NOT a placeholder');
  assert(emailService.isTestOrPlaceholderRecipient('john.doe@enterprise-corp.com') === false, 'Identifies enterprise domain as NOT a placeholder');

  // Test safe mock dispatch when MOCK_EMAIL is simulated
  const prevMock = process.env.MOCK_EMAIL;
  process.env.MOCK_EMAIL = 'true';
  const mockResult = await emailService.sendVerificationEmail({
    email: 'synthetic_tester@example.org',
    name: 'Mock Tester',
    token: 'mocktoken1234567890abcdef',
    otp: '123456'
  });
  process.env.MOCK_EMAIL = prevMock || '';

  assert(mockResult.success === true, 'Mock dispatch returned success: true');
  assert(mockResult.mocked === true, 'Mock dispatch flagged mocked: true');
  assert(mockResult.provider === 'MockTestService', 'Provider reported as MockTestService');

  console.log('\n======================================================================');
  console.log(` TEST SUMMARY: ${passed}/${total} ASSERTIONS PASSED (${passed === total ? '100% SUCCESS' : 'FAILURES DETECTED'})`);
  console.log('======================================================================\n');

  process.exit(passed === total ? 0 : 1);
}

runTestSuite().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
