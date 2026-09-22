const http = require('http');
const app = require('./app');
const UserModel = require('./models/userModel');
const bcrypt = require('bcryptjs');

// Helper to make HTTP JSON requests against the test server
function makeRequest(port, options, payload = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
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
        } catch (e) {
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

async function runAuthTests() {
  const TEST_PORT = 5097;
  const server = app.listen(TEST_PORT);
  console.log(`Starting Auth Security Test Suite on port ${TEST_PORT}...`);

  let testCount = 0;
  let passedCount = 0;

  function assert(condition, message) {
    testCount++;
    if (condition) {
      console.log(`  ✓ Test ${testCount}: ${message} — PASSED`);
      passedCount++;
    } else {
      console.error(`  ✗ Test ${testCount}: ${message} — FAILED`);
    }
  }

  try {
    // 1. Health check regression
    const healthRes = await makeRequest(TEST_PORT, { path: '/api/health', method: 'GET' });
    assert(
      healthRes.statusCode === 200 && healthRes.body.success === true,
      'GET /api/health returns 200 OK'
    );

    // 2. Register with attempted role escalation (client sends role: 'admin')
    const testEmail = `viewer_${Date.now()}@ricozanalytics.com`;
    const regRes = await makeRequest(TEST_PORT, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Standard Viewer',
      email: testEmail,
      password: 'testPassword123',
      role: 'admin' // Attempted escalation should be ignored
    });

    assert(
      regRes.statusCode === 201 &&
      regRes.body.success === true &&
      Boolean(regRes.body.token) &&
      regRes.body.user.email === testEmail &&
      regRes.body.user.role === 'viewer' && // STRICT: must be 'viewer'
      !regRes.body.user.password_hash,
      'POST /api/auth/register ignores client role and strictly sets role to "viewer"'
    );

    const authToken = regRes.body.token;

    // 3. Register duplicate email should fail with 409
    const dupRes = await makeRequest(TEST_PORT, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Duplicate User',
      email: testEmail,
      password: 'anotherPassword123'
    });

    assert(
      dupRes.statusCode === 409 && dupRes.body.success === false,
      'POST /api/auth/register rejects duplicate email with 409'
    );

    // 4. Login with correct credentials
    const loginRes = await makeRequest(TEST_PORT, { path: '/api/auth/login', method: 'POST' }, {
      email: testEmail,
      password: 'testPassword123'
    });

    assert(
      loginRes.statusCode === 200 &&
      loginRes.body.success === true &&
      Boolean(loginRes.body.token) &&
      loginRes.body.user.role === 'viewer' &&
      loginRes.body.user.email === testEmail,
      'POST /api/auth/login succeeds with valid credentials and returns "viewer" role'
    );

    // 5. Login with wrong password
    const badPassRes = await makeRequest(TEST_PORT, { path: '/api/auth/login', method: 'POST' }, {
      email: testEmail,
      password: 'wrongPassword999'
    });

    assert(
      badPassRes.statusCode === 401 && badPassRes.body.success === false,
      'POST /api/auth/login rejects invalid password with 401'
    );

    // 6. Login with non-existent email
    const nonExistRes = await makeRequest(TEST_PORT, { path: '/api/auth/login', method: 'POST' }, {
      email: 'nonexistent_user_999@test.com',
      password: 'anyPassword123'
    });

    assert(
      nonExistRes.statusCode === 401 && nonExistRes.body.success === false,
      'POST /api/auth/login rejects non-existent email with 401'
    );

    // 7. GET /api/auth/me with valid Bearer token for registered viewer
    const meRes = await makeRequest(TEST_PORT, {
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert(
      meRes.statusCode === 200 &&
      meRes.body.success === true &&
      meRes.body.user.email === testEmail &&
      meRes.body.user.role === 'viewer' &&
      !meRes.body.user.password_hash,
      'GET /api/auth/me returns authenticated user details with "viewer" role'
    );

    // 8. Verify existing admin user role preservation (e.g. system provisioned account)
    const adminEmail = `admin_${Date.now()}@ricozanalytics.com`;
    const adminPassHash = await bcrypt.hash('adminPass123', 10);
    const provisionedAdmin = await UserModel.create({
      name: 'System Administrator',
      email: adminEmail,
      password_hash: adminPassHash,
      role: 'admin' // Manually provisioned / enterprise assigned
    });

    const adminLoginRes = await makeRequest(TEST_PORT, { path: '/api/auth/login', method: 'POST' }, {
      email: adminEmail,
      password: 'adminPass123'
    });

    const adminMeRes = await makeRequest(TEST_PORT, {
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminLoginRes.body.token}`
      }
    });

    assert(
      adminMeRes.statusCode === 200 &&
      adminMeRes.body.user.role === 'admin' &&
      adminMeRes.body.user.name === 'System Administrator',
      'GET /api/auth/me correctly returns "admin" role for provisioned admin accounts'
    );

    // 9. GET /api/auth/me with missing token
    const noTokenRes = await makeRequest(TEST_PORT, { path: '/api/auth/me', method: 'GET' });

    assert(
      noTokenRes.statusCode === 401 && noTokenRes.body.success === false,
      'GET /api/auth/me rejects request without token with 401'
    );

    // 10. GET /api/auth/me with invalid/garbage token
    const badTokenRes = await makeRequest(TEST_PORT, {
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid_garbage_token_123'
      }
    });

    assert(
      badTokenRes.statusCode === 401 && badTokenRes.body.success === false,
      'GET /api/auth/me rejects invalid token with 401'
    );

    console.log(`\n===========================================`);
    console.log(` Auth Security Tests: ${passedCount}/${testCount} PASSED`);
    console.log(`===========================================`);

    server.close(() => {
      process.exit(passedCount === testCount ? 0 : 1);
    });
  } catch (err) {
    console.error('Fatal test error:', err);
    server.close(() => {
      process.exit(1);
    });
  }
}

runAuthTests();
