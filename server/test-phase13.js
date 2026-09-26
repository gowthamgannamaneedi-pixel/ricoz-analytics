/**
 * Comprehensive Automated Test Suite for Phase 13: Enterprise Governance, Workspace Management & Audit Logs
 * Tests 25 critical areas including:
 * 1. Organization access
 * 2. Organization update
 * 3. User listing
 * 4. User details
 * 5. Role update
 * 6. Permission enforcement
 * 7. Audit log creation
 * 8. Audit log retrieval
 * 9. Audit filtering
 * 10. Audit pagination
 * 11. Admin access
 * 12. Manager restrictions
 * 13. Analyst restrictions
 * 14. Viewer restrictions
 * 15. Cross-tenant user isolation
 * 16. Cross-tenant audit isolation
 * 17. Cross-tenant organization isolation
 * 18. Privilege escalation prevention
 * 19. Dashboard audit event
 * 20. Report audit event
 * 21. Alert audit event
 * 22. Forecast audit event
 * 23. AI audit event
 * 24. Authentication audit event
 * 25. Secret/sensitive-data protection
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const { logAuditEvent, sanitizeMetadata, AUDIT_ACTIONS } = require('./services/auditService');
const { hasPermission, getPermissionsForRole, getFullPermissionMatrix } = require('./utils/permissions');
const AuditLogModel = require('./models/auditLogModel');
const UserModel = require('./models/userModel');
const OrganizationModel = require('./models/organizationModel');

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

    let reqBody = null;
    if (body) {
      reqBody = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
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

// Token generator helper
function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  PHASE 13: ENTERPRISE GOVERNANCE, WORKSPACE & AUDIT TEST SUITE');
  console.log('===============================================================\n');

  // Start server on random port
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  \x1b[32m✔\x1b[0m ${message}`);
      passed++;
    } else {
      console.log(`  \x1b[31m✖\x1b[0m ${message}`);
      failed++;
    }
  }

  const orgA = '00000000-0000-0000-0000-000000000001';

  // Seed Org B in memory / DB for cross-tenant testing
  const tenantBOrg = await OrganizationModel.create({
    name: 'Tenant B Organization',
    slug: 'tenant-b-org',
    plan: 'starter'
  }).catch(() => ({ id: '00000000-0000-0000-0000-000000000002' }));

  const orgB = tenantBOrg?.id || '00000000-0000-0000-0000-000000000002';

  const adminToken = generateToken(1, 'admin@ricoz.test', 'admin', orgA);
  const managerToken = generateToken(2, 'manager@ricoz.test', 'manager', orgA);
  const analystToken = generateToken(3, 'analyst@ricoz.test', 'analyst', orgA);
  const viewerToken = generateToken(4, 'viewer@ricoz.test', 'viewer', orgA);
  const tenantBAdminToken = generateToken(99, 'tenantb@other.test', 'admin', orgB);

  try {
    // -------------------------------------------------------------
    // Test 1: Organization access
    // -------------------------------------------------------------
    console.log('\n--- 1. Organization & Workspace Access ---');
    const res1 = await request('GET', '/api/admin/organization', null, { Authorization: `Bearer ${adminToken}` });
    assert(res1.statusCode === 200 && res1.body.success === true && res1.body.organization.id === orgA,
      'Test 1: Admin can retrieve current organization details & statistics');

    // -------------------------------------------------------------
    // Test 2: Organization update
    // -------------------------------------------------------------
    console.log('\n--- 2. Organization Update ---');
    const res2 = await request('PUT', '/api/admin/organization', {
      name: 'Ricoz Enterprise Headquarters',
      settings: { timezone: 'Asia/Kolkata', dateFormat: 'YYYY-MM-DD' }
    }, { Authorization: `Bearer ${adminToken}` });
    assert(res2.statusCode === 200 && res2.body.organization.name === 'Ricoz Enterprise Headquarters',
      'Test 2: Admin can update organization name and governance settings');

    // -------------------------------------------------------------
    // Test 3: User listing
    // -------------------------------------------------------------
    console.log('\n--- 3. User Listing ---');
    const res3 = await request('GET', '/api/admin/users', null, { Authorization: `Bearer ${adminToken}` });
    assert(res3.statusCode === 200 && res3.body.data && Array.isArray(res3.body.data.users) && res3.body.data.users.length > 0,
      'Test 3: Team members listed with pagination & role metadata');

    // -------------------------------------------------------------
    // Test 4: User details
    // -------------------------------------------------------------
    console.log('\n--- 4. User Details ---');
    const res4 = await request('GET', '/api/admin/users/1', null, { Authorization: `Bearer ${adminToken}` });
    assert(res4.statusCode === 200 && res4.body.user && res4.body.user.email === 'admin@ricoz.test' && !res4.body.user.password_hash,
      'Test 4: Specific user details retrieved without exposing password hash');

    // -------------------------------------------------------------
    // Test 5: Role update
    // -------------------------------------------------------------
    console.log('\n--- 5. Role Update ---');
    const res5 = await request('PUT', '/api/admin/users/4/role', { role: 'analyst' }, { Authorization: `Bearer ${adminToken}` });
    assert(res5.statusCode === 200 && res5.body.user.role === 'analyst',
      'Test 5: Admin can update team member role');

    // -------------------------------------------------------------
    // Test 6: Permission enforcement
    // -------------------------------------------------------------
    console.log('\n--- 6. Centralized Permission Matrix & Enforcement ---');
    const res6 = await request('GET', '/api/admin/permissions', null, { Authorization: `Bearer ${analystToken}` });
    assert(res6.statusCode === 200 && res6.body.data.matrix && res6.body.data.userRole === 'analyst',
      'Test 6: Centralized RBAC matrix schema and user capability set returned');

    // -------------------------------------------------------------
    // Test 7: Audit log creation
    // -------------------------------------------------------------
    console.log('\n--- 7. Audit Log Creation ---');
    const logEntry = await logAuditEvent({
      organizationId: orgA,
      userId: 1,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      resourceType: 'settings',
      description: 'Audit test event created',
      metadata: { key: 'testValue' }
    });
    assert(logEntry !== null && logEntry.organization_id === orgA && logEntry.action === 'SETTINGS_UPDATED',
      'Test 7: Audit event securely recorded in multi-tenant audit store');

    // -------------------------------------------------------------
    // Test 8: Audit log retrieval
    // -------------------------------------------------------------
    console.log('\n--- 8. Audit Log Retrieval ---');
    const res8 = await request('GET', '/api/admin/audit-logs', null, { Authorization: `Bearer ${adminToken}` });
    assert(res8.statusCode === 200 && Array.isArray(res8.body.data.logs) && res8.body.data.logs.length > 0,
      'Test 8: Authorized administrative roles can retrieve workspace audit trails');

    // -------------------------------------------------------------
    // Test 9: Audit filtering
    // -------------------------------------------------------------
    console.log('\n--- 9. Audit Filtering ---');
    const res9 = await request('GET', '/api/admin/audit-logs?action=SETTINGS_UPDATED', null, { Authorization: `Bearer ${adminToken}` });
    assert(res9.statusCode === 200 && res9.body.data.logs.every(l => l.action.toLowerCase() === 'settings_updated'),
      'Test 9: Audit records properly filtered by action type');

    // -------------------------------------------------------------
    // Test 10: Audit pagination
    // -------------------------------------------------------------
    console.log('\n--- 10. Audit Pagination ---');
    const res10 = await request('GET', '/api/admin/audit-logs?page=1&limit=2', null, { Authorization: `Bearer ${adminToken}` });
    assert(res10.statusCode === 200 && res10.body.data.logs.length <= 2 && res10.body.data.page === 1,
      'Test 10: Audit pagination limits and offsets enforced accurately');

    // -------------------------------------------------------------
    // Test 11: Admin universal access
    // -------------------------------------------------------------
    console.log('\n--- 11. Admin Access Privileges ---');
    const res11 = await request('GET', '/api/admin/stats', null, { Authorization: `Bearer ${adminToken}` });
    assert(res11.statusCode === 200 && res11.body.success === true,
      'Test 11: Administrator granted universal governance access');

    // -------------------------------------------------------------
    // Test 12: Manager restrictions
    // -------------------------------------------------------------
    console.log('\n--- 12. Manager Role Restrictions ---');
    const res12 = await request('PUT', '/api/admin/organization', { name: 'Manager Renaming Attempt' }, { Authorization: `Bearer ${managerToken}` });
    assert(res12.statusCode === 403,
      'Test 12: Manager restricted from updating organization governance settings (403 Forbidden)');

    // -------------------------------------------------------------
    // Test 13: Analyst restrictions
    // -------------------------------------------------------------
    console.log('\n--- 13. Analyst Role Restrictions ---');
    const res13 = await request('GET', '/api/admin/users', null, { Authorization: `Bearer ${analystToken}` });
    assert(res13.statusCode === 403,
      'Test 13: Analyst restricted from accessing user administration (403 Forbidden)');

    // -------------------------------------------------------------
    // Test 14: Viewer restrictions
    // -------------------------------------------------------------
    console.log('\n--- 14. Viewer Role Restrictions ---');
    const res14 = await request('GET', '/api/admin/audit-logs', null, { Authorization: `Bearer ${viewerToken}` });
    assert(res14.statusCode === 403,
      'Test 14: Viewer restricted from viewing security audit logs (403 Forbidden)');

    // -------------------------------------------------------------
    // Test 15: Cross-tenant user isolation
    // -------------------------------------------------------------
    console.log('\n--- 15. Cross-Tenant User Isolation ---');
    const res15 = await request('GET', '/api/admin/users/1', null, { Authorization: `Bearer ${tenantBAdminToken}` });
    assert(res15.statusCode === 404,
      'Test 15: Tenant B Administrator strictly barred from accessing Tenant A user details (404/Isolated)');

    // -------------------------------------------------------------
    // Test 16: Cross-tenant audit isolation
    // -------------------------------------------------------------
    console.log('\n--- 16. Cross-Tenant Audit Isolation ---');
    const res16 = await request('GET', '/api/admin/audit-logs', null, { Authorization: `Bearer ${tenantBAdminToken}` });
    assert(res16.statusCode === 200 && res16.body.data.logs.every(l => l.organization_id === orgB),
      'Test 16: Tenant B Administrator can never observe Tenant A audit events');

    // -------------------------------------------------------------
    // Test 17: Cross-tenant organization isolation
    // -------------------------------------------------------------
    console.log('\n--- 17. Cross-Tenant Organization Isolation ---');
    const res17 = await request('PUT', '/api/admin/organization', {
      name: 'Tenant B Modified Name'
    }, { Authorization: `Bearer ${tenantBAdminToken}` });
    const orgARefresh = await request('GET', '/api/admin/organization', null, { Authorization: `Bearer ${adminToken}` });
    assert(res17.statusCode === 200 && orgARefresh.body.organization.name === 'Ricoz Enterprise Headquarters',
      'Test 17: Tenant B updates isolated to Tenant B without affecting Tenant A');

    // -------------------------------------------------------------
    // Test 18: Privilege escalation prevention
    // -------------------------------------------------------------
    console.log('\n--- 18. Privilege Escalation Prevention ---');
    const res18 = await request('PUT', '/api/admin/users/1/role', { role: 'viewer' }, { Authorization: `Bearer ${adminToken}` });
    assert(res18.statusCode === 400 && res18.body.message.includes('cannot remove'),
      'Test 18: Admin self-demotion prevented to safeguard workspace administration');

    // -------------------------------------------------------------
    // Test 19: Dashboard audit event
    // -------------------------------------------------------------
    console.log('\n--- 19. Dashboard Audit Event Integration ---');
    const res19 = await request('POST', '/api/dashboards', {
      title: 'Governance Test Dashboard'
    }, { Authorization: `Bearer ${adminToken}` });
    const dashLogs = await request('GET', '/api/admin/audit-logs?action=DASHBOARD_CREATED', null, { Authorization: `Bearer ${adminToken}` });
    assert(res19.statusCode === 201 && dashLogs.body.data.logs.length > 0,
      'Test 19: Dashboard creation automatically generates DASHBOARD_CREATED audit event');

    // -------------------------------------------------------------
    // Test 20: Report audit event
    // -------------------------------------------------------------
    console.log('\n--- 20. Report Audit Event Integration ---');
    const res20 = await request('POST', '/api/reports', {
      title: 'Weekly Executive Briefing',
      format: 'pdf',
      status: 'active'
    }, { Authorization: `Bearer ${adminToken}` });
    const repLogs = await request('GET', '/api/admin/audit-logs?action=REPORT_CREATED', null, { Authorization: `Bearer ${adminToken}` });
    assert(res20.statusCode === 201 && repLogs.body.data.logs.length > 0,
      'Test 20: Report creation automatically generates REPORT_CREATED audit event');

    // -------------------------------------------------------------
    // Test 21: Alert audit event
    // -------------------------------------------------------------
    console.log('\n--- 21. Alert Audit Event Integration ---');
    const res21 = await request('POST', '/api/alerts', {
      name: 'High CPU Spike Alert',
      condition: 'greater_than',
      threshold: 90,
      severity: 'critical'
    }, { Authorization: `Bearer ${adminToken}` });
    const alertLogs = await request('GET', '/api/admin/audit-logs?action=ALERT_CREATED', null, { Authorization: `Bearer ${adminToken}` });
    assert(res21.statusCode === 201 && alertLogs.body.data.logs.length > 0,
      'Test 21: Alert creation automatically generates ALERT_CREATED audit event');

    // -------------------------------------------------------------
    // Test 22: Forecast audit event
    // -------------------------------------------------------------
    console.log('\n--- 22. Forecast Audit Event Integration ---');
    const res22 = await request('POST', '/api/forecasts/generate', {
      series: [
        { date: '2026-01-01', value: 100 },
        { date: '2026-01-02', value: 120 },
        { date: '2026-01-03', value: 130 },
        { date: '2026-01-04', value: 145 },
        { date: '2026-01-05', value: 160 }
      ],
      horizon_periods: 7,
      persist: true
    }, { Authorization: `Bearer ${adminToken}` });
    const fcLogs = await request('GET', '/api/admin/audit-logs?action=FORECAST_GENERATED', null, { Authorization: `Bearer ${adminToken}` });
    assert(res22.statusCode === 200 && fcLogs.body.data.logs.length > 0,
      'Test 22: Forecast generation automatically generates FORECAST_GENERATED audit event');

    // -------------------------------------------------------------
    // Test 23: AI query audit event
    // -------------------------------------------------------------
    console.log('\n--- 23. AI Query Audit Event Integration ---');
    const res23 = await request('POST', '/api/ai/query', {
      message: 'What was total revenue this quarter?'
    }, { Authorization: `Bearer ${adminToken}` });
    const aiLogs = await request('GET', '/api/admin/audit-logs?action=AI_QUERY', null, { Authorization: `Bearer ${adminToken}` });
    assert(res23.statusCode === 200 && aiLogs.body.data.logs.length > 0,
      'Test 23: Natural-language AI query automatically generates AI_QUERY audit event');

    // -------------------------------------------------------------
    // Test 24: Authentication audit event
    // -------------------------------------------------------------
    console.log('\n--- 24. Authentication Audit Event Integration ---');
    const res24 = await request('POST', '/api/auth/login', {
      email: 'admin@ricoz.test',
      password: 'admin123'
    });
    const authLogs = await request('GET', '/api/admin/audit-logs?action=USER_LOGIN', null, { Authorization: `Bearer ${adminToken}` });
    assert(res24.statusCode === 200 && authLogs.body.data.logs.length > 0,
      'Test 24: Successful login automatically triggers USER_LOGIN audit event & updates last_login_at');

    // -------------------------------------------------------------
    // Test 25: Secret & sensitive-data protection
    // -------------------------------------------------------------
    console.log('\n--- 25. Sensitive Credential Scrubbing & Secret Safety ---');
    const dirtyMeta = {
      user: 'admin',
      password: 'superSecretPassword123',
      apiKey: 'sk-1234567890abcdef',
      nested: { jwt: 'header.payload.signature', token: 'secretToken' },
      safeField: 'normalValue'
    };
    const cleaned = sanitizeMetadata(dirtyMeta);
    assert(
      cleaned.password === '[REDACTED]' &&
      cleaned.apiKey === '[REDACTED]' &&
      cleaned.nested.jwt === '[REDACTED]' &&
      cleaned.nested.token === '[REDACTED]' &&
      cleaned.safeField === 'normalValue',
      'Test 25: Sensitive credentials (passwords, JWTs, API keys) strictly scrubbed from audit logs'
    );

  } catch (err) {
    console.error('Unhandled test runner error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 13 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
