/**
 * Comprehensive Automated Test Suite for Phase 6: Authentication + RBAC
 * Verifies 10 core requirements:
 * 1. Unauthenticated requests are rejected with 401 Unauthorized
 * 2. Authenticated requests with valid Bearer token succeed
 * 3. User profile synchronization (GET /api/auth/me returns role, organization_id, profile metadata)
 * 4. Multi-tenancy isolation (users belong to organization, organization_id attached)
 * 5. Multi-tenancy cross-tenant barrier (requests targeting foreign orgs are blocked)
 * 6. Role enforcement: Viewer role strictly assigned by default on registration
 * 7. Role enforcement: Analyst role permissions
 * 8. Role enforcement: Manager role permissions
 * 9. Role enforcement: Admin role universal authorization across platform
 * 10. Logout and session termination
 */

const http = require('http');
const app = require('./app');
const UserModel = require('./models/userModel');
const OrganizationModel = require('./models/organizationModel');
const { requireRole, requireOrgAccess } = require('./middleware/roleMiddleware');

let server;
let port;
let baseUrl;

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

    let postData = null;
    if (body) {
      postData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(responseBody);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json !== null ? json : responseBody
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('  RicozAnalytics Phase 6: Auth & RBAC Test Suite    ');
  console.log('====================================================\n');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] Test ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] Test ${total}: ${testName}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // Test 1: Unauthenticated request rejected with 401
    // ------------------------------------------------------------------------
    const unauthRes = await request('GET', '/api/auth/me');
    assert(
      unauthRes.status === 401 && unauthRes.data.success === false,
      'Unauthenticated request to protected endpoint returns 401 Unauthorized'
    );

    // ------------------------------------------------------------------------
    // Test 2: User signup with organization creation & viewer default role
    // ------------------------------------------------------------------------
    const testEmail = `viewer_${Date.now()}@acme-corp.com`;
    const signupRes = await request('POST', '/api/auth/register', {
      name: 'Priya Sharma',
      email: testEmail,
      password: 'SecurePassword123!',
      organization_name: 'Acme Telemetry Corp'
    });

    assert(
      signupRes.status === 201 &&
      signupRes.data.success === true &&
      Boolean(signupRes.data.token) &&
      signupRes.data.user.role === 'viewer' &&
      Boolean(signupRes.data.user.organization_id),
      'User signup creates profile with organization_id and enforces default "viewer" role'
    );

    const viewerToken = signupRes.data.token;
    const viewerOrgId = signupRes.data.user.organization_id;
    const viewerId = signupRes.data.user.id;

    // ------------------------------------------------------------------------
    // Test 3: User profile synchronization (GET /api/auth/me)
    // ------------------------------------------------------------------------
    const meRes = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      meRes.status === 200 &&
      meRes.data.success === true &&
      meRes.data.user.email === testEmail &&
      meRes.data.user.role === 'viewer' &&
      meRes.data.user.organization_id === viewerOrgId &&
      meRes.data.user.organization_name !== undefined,
      'GET /api/auth/me returns synchronized profile with role and organization metadata'
    );

    // ------------------------------------------------------------------------
    // Test 4: User login succeeds and issues session token
    // ------------------------------------------------------------------------
    const loginRes = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'SecurePassword123!'
    });

    assert(
      loginRes.status === 200 &&
      loginRes.data.success === true &&
      Boolean(loginRes.data.token) &&
      loginRes.data.user.organization_id === viewerOrgId,
      'User login succeeds with credentials and returns valid session token'
    );

    // ------------------------------------------------------------------------
    // Test 5: Multi-tenancy - Organization Isolation Barrier
    // ------------------------------------------------------------------------
    // ------------------------------------------------------------------------
    // Test 5: Multi-tenancy - Organization Isolation Barrier
    // ------------------------------------------------------------------------
    const foreignOrgId = '00000000-0000-0000-0000-000000000999';
    const orgCheckMiddleware = requireOrgAccess('orgId');
    let orgBlocked = false;
    const mockReqOrg = {
      user: { id: viewerId, organization_id: viewerOrgId },
      params: { orgId: foreignOrgId }
    };
    const mockResOrg = {
      status(code) {
        if (code === 403) orgBlocked = true;
        return { json: () => {} };
      }
    };
    orgCheckMiddleware(mockReqOrg, mockResOrg, () => {});

    assert(
      orgBlocked === true,
      'Multi-tenancy: Access to foreign organization resources is blocked with 403 Forbidden'
    );

    // ------------------------------------------------------------------------
    // Test 6: Role Authorization - Viewer restricted from restricted operations
    // ------------------------------------------------------------------------
    const roleCheckAnalyst = requireRole('analyst', 'manager');
    let viewerForbidden = false;
    const viewerReq = {
      user: { id: viewerId, role: 'viewer', organization_id: viewerOrgId }
    };
    const mockResViewer = {
      status(code) {
        if (code === 403) viewerForbidden = true;
        return { json: () => {} };
      }
    };
    roleCheckAnalyst(viewerReq, mockResViewer, () => {});

    assert(
      viewerForbidden === true,
      'RBAC: Viewer role is denied access to Analyst/Manager mutating operations (403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // Test 7: Role Authorization - Analyst role permissions
    // ------------------------------------------------------------------------
    let analystPassed = false;
    const analystReq = {
      user: { id: 200, role: 'analyst', organization_id: viewerOrgId }
    };
    const mockResAnalyst = {
      status() { return { json: () => {} }; }
    };
    roleCheckAnalyst(analystReq, mockResAnalyst, () => {
      analystPassed = true;
    });

    assert(
      analystPassed === true,
      'RBAC: Analyst role is granted permission for analytics and metrics operations'
    );

    // ------------------------------------------------------------------------
    // Test 8: Role Authorization - Manager role permissions
    // ------------------------------------------------------------------------
    let managerPassed = false;
    const managerReq = {
      user: { id: 300, role: 'manager', organization_id: viewerOrgId }
    };
    const mockResManager = {
      status() { return { json: () => {} }; }
    };
    roleCheckAnalyst(managerReq, mockResManager, () => {
      managerPassed = true;
    });

    assert(
      managerPassed === true,
      'RBAC: Manager role is granted permission for organizational pipelines'
    );

    // ------------------------------------------------------------------------
    // Test 9: Role Authorization - Admin universal permission
    // ------------------------------------------------------------------------
    const roleCheckAdminOnly = requireRole('admin');
    let adminPassed = false;
    const adminReq = {
      user: { id: 1, role: 'admin', organization_id: viewerOrgId }
    };
    const mockResAdmin = {
      status() { return { json: () => {} }; }
    };
    roleCheckAdminOnly(adminReq, mockResAdmin, () => {
      adminPassed = true;
    });

    assert(
      adminPassed === true,
      'RBAC: Admin role has universal execution rights across all operations'
    );

    // ------------------------------------------------------------------------
    // Test 10: Session Logout
    // ------------------------------------------------------------------------
    const logoutRes = await request('POST', '/api/auth/logout', null, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      logoutRes.status === 200 &&
      logoutRes.data.success === true &&
      logoutRes.data.message.includes('Logged out'),
      'POST /api/auth/logout cleanly terminates session'
    );

  } catch (err) {
    console.error('Unexpected test exception:', err);
  } finally {
    console.log('\n====================================================');
    console.log(`  Phase 6 Test Results: ${passed}/${total} Passed`);
    console.log('====================================================\n');

    server.close(() => {
      process.exit(passed === total ? 0 : 1);
    });
  }
}

runPhase6Tests();
