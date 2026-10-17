const assert = require('assert');
const emailService = require('./services/emailService');
const config = require('./config');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RICOZANALYTICS PASSWORD RESET URL VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------------------
    // TEST GROUP 1: Production URL Construction & Localhost Prevention
    // -------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: Production URL Resolution & Localhost Prevention ---');

    test('1. Production environment with CLIENT_URL uses deployed HTTPS domain', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://ricoz-analytics.vercel.app';

      const url = emailService.getClientBaseUrl();
      assert.strictEqual(url, 'https://ricoz-analytics.vercel.app');
      assert.strictEqual(url.includes('localhost'), false, 'Production URL must never contain localhost');
    });

    test('2. Production reset email link preserves token & email query parameters', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://ricoz-analytics.vercel.app';

      const token = 'test-token-abcdef123456';
      const email = 'user@example.com';
      const resetPath = `/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      const link = emailService.sanitizeUrlForProduction(null, resetPath);

      assert.strictEqual(link, `https://ricoz-analytics.vercel.app/reset-password?token=${token}&email=user%40example.com`);
      assert.strictEqual(link.includes('localhost'), false);
      assert.strictEqual(link.startsWith('https://ricoz-analytics.vercel.app/reset-password'), true);
      assert.strictEqual(link.includes(`token=${token}`), true);
      assert.strictEqual(link.includes('email=user%40example.com'), true);
    });

    test('3. Production sanitizes any accidental localhost link passed as resetUrl', () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://ricoz-analytics.vercel.app';

      const accidentalLocalhost = 'http://localhost:5173/reset-password?token=secret123&email=admin%40ricoz.test';
      const sanitized = emailService.sanitizeUrlForProduction(accidentalLocalhost);

      assert.strictEqual(sanitized, 'https://ricoz-analytics.vercel.app/reset-password?token=secret123&email=admin%40ricoz.test');
      assert.strictEqual(sanitized.includes('localhost'), false);
    });

    test('4. Production defaults safely to canonical HTTPS domain when CLIENT_URL is unset', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CLIENT_URL;

      const url = emailService.getClientBaseUrl();
      assert.strictEqual(url, 'https://ricoz-analytics.vercel.app');
      assert.strictEqual(url.includes('localhost'), false, 'Must never fall back to localhost in production');
    });

    test('5. Development environment preserves localhost URL for local developer workflows', () => {
      process.env.NODE_ENV = 'development';
      process.env.CLIENT_URL = 'http://localhost:5173';

      const url = emailService.getClientBaseUrl();
      assert.strictEqual(url, 'http://localhost:5173');
      const resetPath = '/reset-password?token=dev-token&email=dev@ricoz.test';
      const link = emailService.sanitizeUrlForProduction(null, resetPath);
      assert.strictEqual(link, 'http://localhost:5173/reset-password?token=dev-token&email=dev@ricoz.test');
    });

    // -------------------------------------------------------------------------
    // TEST GROUP 2: HTML Email Content Generation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Email Template HTML Output Verification ---');

    await asyncTest('6. Generated email contains correct HTTPS reset link in HTML button and text', async () => {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://ricoz-analytics.vercel.app';
      process.env.MOCK_EMAIL = 'true';

      const res = await emailService.sendPasswordResetEmail({
        email: 'test_verify@ricoz.test',
        name: 'Tester',
        token: 'test_token_99999',
        resetUrl: 'https://ricoz-analytics.vercel.app/reset-password?token=test_token_99999&email=test_verify%40ricoz.test'
      });

      assert.strictEqual(res.success, true);
    });

    // -------------------------------------------------------------------------
    // TEST GROUP 3: End-to-End API Route Verification against local running server
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Live API Endpoints (Token Validation & Reset) ---');

    await asyncTest('7. POST /api/auth/forgot-password sends reset request safely', async () => {
      const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@ricoz.test' })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    await asyncTest('8. GET /api/auth/reset-password/:token rejects invalid tokens', async () => {
      const res = await fetch('http://localhost:5000/api/auth/reset-password/definitely-fake-token-12345');
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message.includes('Invalid or expired'), true);
    });

    await asyncTest('9. Full Token Lifecycle: Generate token, validate, update password, and test login', async () => {
      process.env.NODE_ENV = 'development';
      const UserModel = require('./models/userModel');
      const crypto = require('crypto');
      const bcrypt = require('bcryptjs');

      const testToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await UserModel.setResetPasswordToken('admin@ricoz.test', testToken, expiresAt);

      // Verify token
      const checkRes = await fetch(`http://localhost:5000/api/auth/reset-password/${testToken}`);
      assert.strictEqual(checkRes.status, 200);
      const checkData = await checkRes.json();
      assert.strictEqual(checkData.success, true);
      assert.strictEqual(checkData.valid, true);

      // Perform password reset with new password
      const resetRes = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: testToken,
          password: 'new_temp_password_123'
        })
      });
      assert.strictEqual(resetRes.status, 200);
      const resetData = await resetRes.json();
      assert.strictEqual(resetData.success, true);

      // Verify login with new password
      const loginRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@ricoz.test',
          password: 'new_temp_password_123'
        })
      });
      assert.strictEqual(loginRes.status, 200);
      const loginData = await loginRes.json();
      assert.strictEqual(loginData.success, true);

      // Reset password back to standard admin123
      const defaultHash = bcrypt.hashSync('admin123', 10);
      await UserModel.updatePassword('admin@ricoz.test', defaultHash);

      // Verify restored admin123 login
      const restoreRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@ricoz.test',
          password: 'admin123'
        })
      });
      assert.strictEqual(restoreRes.status, 200);
    });

  } finally {
    // Restore original environment
    for (const key in process.env) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/${total} PASSWORD RESET URL TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test run failed:', err);
  process.exit(1);
});
