const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const UserModel = require('./models/userModel');

let baseUrl = '';

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        ...headers
      }
    };

    let reqBody = null;
    if (body) {
      reqBody = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let parsed = rawData;
        try {
          parsed = JSON.parse(rawData);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

async function runAuthSecurityTests() {
  console.log('\n===============================================================');
  console.log('  RICOZ ENTERPRISE AUTHENTICATION & AUTHORIZATION SECURITY SUITE');
  console.log('===============================================================\n');

  // Spin up test server
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  let testCount = 0;
  let passedCount = 0;

  function assert(condition, testName) {
    testCount++;
    if (condition) {
      console.log(`  ✅ [PASS] Test ${testCount}: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] Test ${testCount}: ${testName}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Valid Login
    // -------------------------------------------------------------
    const validLoginRes = await request('POST', '/api/auth/login', {
      email: 'admin@ricoz.test',
      password: 'admin123'
    });

    assert(
      validLoginRes.statusCode === 200 &&
      validLoginRes.body.success === true &&
      typeof validLoginRes.body.token === 'string' &&
      validLoginRes.body.user.email === 'admin@ricoz.test' &&
      validLoginRes.body.user.role === 'admin' &&
      !validLoginRes.body.user.password_hash &&
      !validLoginRes.body.user.password,
      'Valid Login — Authenticates credentials, returns signed JWT and safe user object'
    );

    const adminToken = validLoginRes.body.token;

    // -------------------------------------------------------------
    // Test 2: Wrong Password
    // -------------------------------------------------------------
    const wrongPassRes = await request('POST', '/api/auth/login', {
      email: 'admin@ricoz.test',
      password: 'completelyWrongPassword999'
    });

    assert(
      wrongPassRes.statusCode === 401 &&
      wrongPassRes.body.success === false,
      'Wrong Password — Rejected with 401 Unauthorized'
    );

    // -------------------------------------------------------------
    // Test 3: Nonexistent User
    // -------------------------------------------------------------
    const nonExistRes = await request('POST', '/api/auth/login', {
      email: 'ghost_user_does_not_exist@ricoz.test',
      password: 'admin123'
    });

    assert(
      nonExistRes.statusCode === 401 &&
      nonExistRes.body.success === false,
      'Nonexistent User — Rejected with 401 Unauthorized'
    );

    // -------------------------------------------------------------
    // Test 4: Missing Email
    // -------------------------------------------------------------
    const missingEmailRes = await request('POST', '/api/auth/login', {
      password: 'admin123'
    });

    assert(
      missingEmailRes.statusCode === 400 &&
      missingEmailRes.body.success === false,
      'Missing Email — Rejected early with 400 Bad Request'
    );

    // -------------------------------------------------------------
    // Test 5: Missing Password
    // -------------------------------------------------------------
    const missingPassRes = await request('POST', '/api/auth/login', {
      email: 'admin@ricoz.test'
    });

    assert(
      missingPassRes.statusCode === 400 &&
      missingPassRes.body.success === false,
      'Missing Password — Rejected early with 400 Bad Request'
    );

    // -------------------------------------------------------------
    // Test 6: Expired Token
    // -------------------------------------------------------------
    const expiredToken = jwt.sign(
      { id: 1, email: 'admin@ricoz.test', role: 'admin', organization_id: '00000000-0000-0000-0000-000000000001' },
      config.jwtSecret,
      { expiresIn: '-10s' }
    );

    const expiredRes = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${expiredToken}`
    });

    assert(
      expiredRes.statusCode === 401 &&
      expiredRes.body.success === false,
      'Expired Token — Blocked with 401 Unauthorized'
    );

    // -------------------------------------------------------------
    // Test 7: Invalid Token
    // -------------------------------------------------------------
    const invalidRes = await request('GET', '/api/auth/me', null, {
      'Authorization': 'Bearer invalid.tampered.token123'
    });

    assert(
      invalidRes.statusCode === 401 &&
      invalidRes.body.success === false,
      'Invalid Token — Blocked with 401 Unauthorized'
    );

    // -------------------------------------------------------------
    // Test 8: Missing Authorization Header
    // -------------------------------------------------------------
    const noAuthRes = await request('GET', '/api/forecasts');

    assert(
      noAuthRes.statusCode === 401 &&
      noAuthRes.body.success === false &&
      (noAuthRes.body.message.includes('No authorization header') || noAuthRes.body.error?.message.includes('No authorization header')),
      'Missing Authorization Header — Blocked with 401 Unauthorized'
    );

    // -------------------------------------------------------------
    // Test 9: Viewer Authorization (Allowed for read, blocked for write)
    // -------------------------------------------------------------
    const viewerLoginRes = await request('POST', '/api/auth/login', {
      email: 'viewer@ricoz.test',
      password: 'viewer123'
    });

    assert(
      viewerLoginRes.statusCode === 200 &&
      viewerLoginRes.body.user.role === 'viewer',
      'Viewer Login — Authenticates and returns verified "viewer" role'
    );

    const viewerToken = viewerLoginRes.body.token;

    const viewerReadRes = await request('GET', '/api/forecasts', null, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerReadRes.statusCode === 200,
      'Viewer Authorization — Viewer permitted to read shared forecasts'
    );

    // -------------------------------------------------------------
    // Test 10: Analyst Authorization
    // -------------------------------------------------------------
    const analystLoginRes = await request('POST', '/api/auth/login', {
      email: 'analyst@ricoz.test',
      password: 'analyst123'
    });

    assert(
      analystLoginRes.statusCode === 200 &&
      analystLoginRes.body.user.role === 'analyst',
      'Analyst Login — Authenticates and returns verified "analyst" role'
    );

    const analystToken = analystLoginRes.body.token;

    const analystGenerateRes = await request('POST', '/api/forecasts/generate', {
      series: [
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-02', value: 20 },
        { date: '2026-01-03', value: 30 },
        { date: '2026-01-04', value: 40 },
        { date: '2026-01-05', value: 50 }
      ],
      horizon: 3,
      persist: false
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    assert(
      analystGenerateRes.statusCode === 200,
      'Analyst Authorization — Analyst permitted to generate ML forecasts'
    );

    // -------------------------------------------------------------
    // Test 11: Manager Authorization
    // -------------------------------------------------------------
    const managerLoginRes = await request('POST', '/api/auth/login', {
      email: 'manager@ricoz.test',
      password: 'manager123'
    });

    assert(
      managerLoginRes.statusCode === 200 &&
      managerLoginRes.body.user.role === 'manager',
      'Manager Login — Authenticates and returns verified "manager" role'
    );

    const managerToken = managerLoginRes.body.token;

    // Manager can access delete routes (even if target id does not exist, receives 404, NOT 403)
    const managerDeleteRes = await request('DELETE', '/api/forecasts/00000000-0000-0000-0000-000000000099', null, {
      'Authorization': `Bearer ${managerToken}`
    });

    assert(
      managerDeleteRes.statusCode !== 403,
      'Manager Authorization — Manager has deletion privileges (bypasses 403 Forbidden)'
    );

    // -------------------------------------------------------------
    // Test 12: Admin Authorization
    // -------------------------------------------------------------
    const adminAccessRes = await request('GET', '/api/admin/users', null, {
      'Authorization': `Bearer ${adminToken}`
    });

    assert(
      adminAccessRes.statusCode === 200,
      'Admin Authorization — Admin permitted to access enterprise user governance'
    );

    // -------------------------------------------------------------
    // Test 13: Role Escalation Prevention (CRITICAL)
    // -------------------------------------------------------------
    // Attacker crafts a token claiming user 4 (Viewer) has role: 'admin'
    const forgedEscalationToken = jwt.sign(
      { id: 4, email: 'viewer@ricoz.test', role: 'admin', organization_id: '00000000-0000-0000-0000-000000000001' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Attempt admin-only route with forged token
    const escalationAttemptRes = await request('GET', '/api/admin/users', null, {
      'Authorization': `Bearer ${forgedEscalationToken}`
    });

    assert(
      escalationAttemptRes.statusCode === 403,
      'Role Escalation Prevention — Server overrides forged token role with real DB role ("viewer"), returning 403'
    );

    // -------------------------------------------------------------
    // Test 14: Registration Role Injection Prevention
    // -------------------------------------------------------------
    const regEmail = `test_registrant_${Date.now()}@ricozanalytics.com`;
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Sneaky Attacker',
      email: regEmail,
      password: 'StrongPassword123!',
      role: 'admin' // Attempted role injection
    });

    assert(
      regRes.statusCode === 201 &&
      regRes.body.user.role === 'viewer',
      'Registration Role Injection — Server ignores client role and strictly provisions default "viewer" role'
    );

    // -------------------------------------------------------------
    // Test 15: Cross-Tenant Isolation
    // -------------------------------------------------------------
    const tenantBLoginRes = await request('POST', '/api/auth/login', {
      email: 'admin_b@other.test',
      password: 'admin123'
    });

    assert(
      tenantBLoginRes.statusCode === 200 &&
      tenantBLoginRes.body.user.organization_id === '00000000-0000-0000-0000-000000000002',
      'Tenant B Login — Correctly loads Org B tenant credentials'
    );

    const tenantBToken = tenantBLoginRes.body.token;

    // Tenant B attempts to read Tenant A report
    const crossTenantReportRes = await request('GET', '/api/reports/00000000-0000-0000-0000-000000000001', null, {
      'Authorization': `Bearer ${tenantBToken}`
    });

    assert(
      crossTenantReportRes.statusCode === 404 || crossTenantReportRes.statusCode === 403,
      'Cross-Tenant Isolation — Tenant B cannot view Tenant A resources (returns safe 404 or 403)'
    );

    // -------------------------------------------------------------
    // Test 16: Logout Endpoint
    // -------------------------------------------------------------
    const logoutRes = await request('POST', '/api/auth/logout', null, {
      'Authorization': `Bearer ${adminToken}`
    });

    assert(
      logoutRes.statusCode === 200 &&
      logoutRes.body.success === true,
      'Logout — POST /api/auth/logout cleanly records session termination'
    );

    // -------------------------------------------------------------
    // Test 17: Protected Endpoint Rejection Without Credentials
    // -------------------------------------------------------------
    const protectedRes = await request('GET', '/api/admin/stats');

    assert(
      protectedRes.statusCode === 401,
      'Protected Endpoints — Universal 401 rejection for unauthenticated calls'
    );

    // -------------------------------------------------------------
    // Test 18: Standard 401 JSON Error Envelope
    // -------------------------------------------------------------
    assert(
      protectedRes.body.success === false &&
      Boolean(protectedRes.body.error && protectedRes.body.error.code === 'UNAUTHORIZED'),
      '401 Format — Returns standard JSON error envelope with code UNAUTHORIZED'
    );

    // -------------------------------------------------------------
    // Test 19: Standard 403 JSON Error Envelope
    // -------------------------------------------------------------
    const viewerAdminRes = await request('GET', '/api/admin/users', null, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerAdminRes.statusCode === 403 &&
      viewerAdminRes.body.success === false,
      '403 Format — Rejection correctly returns 403 Forbidden with user-facing message'
    );

    // -------------------------------------------------------------
    // Test 20: Session Restoration (/api/auth/me)
    // -------------------------------------------------------------
    const meRes = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${adminToken}`
    });

    assert(
      meRes.statusCode === 200 &&
      meRes.body.success === true &&
      meRes.body.user.email === 'admin@ricoz.test' &&
      meRes.body.user.role === 'admin' &&
      meRes.body.user.organization_id === '00000000-0000-0000-0000-000000000001',
      'Session Restoration — GET /api/auth/me verifies token and hydrates server user state'
    );

    console.log(`\n===============================================================`);
    console.log(`  AUTH SECURITY TEST RESULTS: ${passedCount}/${testCount} PASSED`);
    console.log(`===============================================================\n`);

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

runAuthSecurityTests();
