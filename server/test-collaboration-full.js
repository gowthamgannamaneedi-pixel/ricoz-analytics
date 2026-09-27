const assert = require('assert');
const jwt = require('jsonwebtoken');
const config = require('./config');

const baseUrl = 'http://localhost:5000/api';

// Generate test JWT tokens
const adminToken = jwt.sign(
  {
    id: 1,
    email: 'admin@ricoz.test',
    role: 'admin',
    organization_id: '00000000-0000-0000-0000-000000000001'
  },
  config.jwtSecret,
  { expiresIn: '1h' }
);

const managerToken = jwt.sign(
  {
    id: 2,
    email: 'manager@ricoz.test',
    role: 'manager',
    organization_id: '00000000-0000-0000-0000-000000000001'
  },
  config.jwtSecret,
  { expiresIn: '1h' }
);

const viewerToken = jwt.sign(
  {
    id: 4,
    email: 'viewer@ricoz.test',
    role: 'viewer',
    organization_id: '00000000-0000-0000-0000-000000000001'
  },
  config.jwtSecret,
  { expiresIn: '1h' }
);

const tenantBToken = jwt.sign(
  {
    id: 10,
    email: 'admin_b@other.test',
    role: 'admin',
    organization_id: '00000000-0000-0000-0000-000000000002'
  },
  config.jwtSecret,
  { expiresIn: '1h' }
);

async function request(method, path, body = null, token = adminToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  let json = null;
  if (contentType.includes('application/json')) {
    json = await res.json();
  }
  return { status: res.status, data: json };
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  ENTERPRISE COLLABORATION END-TO-END VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(` FAIL: ${name}`);
      console.error(`   -> ${err.message}`);
      failed++;
    }
  }

  const dashId = '00000000-0000-0000-0000-000000000001';
  const reportId = '00000000-0000-0000-0000-000000000001';
  const insightId = '20b03e6d-14ec-49b3-b9e4-a33476b437fe';

  // Ensure idempotent starting state for manager and viewer
  const initFavs = await request('GET', '/collaboration/favorites', null, managerToken);
  for (const f of (initFavs.data?.data || [])) {
    await request('POST', '/collaboration/favorites/toggle', { resourceType: f.resource_type, resourceId: f.resource_id }, managerToken);
  }
  const initShared = await request('GET', '/collaboration/shared-with-me', null, viewerToken);
  for (const d of (initShared.data?.data?.dashboards || [])) {
    await request('DELETE', `/collaboration/dashboards/${d.resource_id}/shares/${d.share_id}`, null, adminToken);
  }
  for (const r of (initShared.data?.data?.reports || [])) {
    await request('DELETE', `/collaboration/reports/${r.resource_id}/shares/${r.share_id}`, null, adminToken);
  }
  for (const i of (initShared.data?.data?.insights || [])) {
    await request('DELETE', `/collaboration/insights/${i.resource_id}/shares/${i.share_id}`, null, adminToken);
  }

  // -------------------------------------------------------------------------
  // 1. FAVORITES END-TO-END
  // -------------------------------------------------------------------------
  await test('1.1 Favorite a Dashboard', async () => {
    const res = await request('POST', '/collaboration/favorites/toggle', {
      resourceType: 'dashboard',
      resourceId: dashId
    }, managerToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.isFavorite, true);
  });

  await test('1.2 Favorite a Report', async () => {
    const res = await request('POST', '/collaboration/favorites/toggle', {
      resourceType: 'report',
      resourceId: reportId
    }, managerToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.isFavorite, true);
  });

  await test('1.3 Favorite an AI Insight', async () => {
    const res = await request('POST', '/collaboration/favorites/toggle', {
      resourceType: 'ai_insight',
      resourceId: insightId
    }, managerToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.isFavorite, true);
  });

  await test('1.4 Get Favorites — Verify Persistence & Resource Title Enrichment', async () => {
    const res = await request('GET', '/collaboration/favorites', null, managerToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const favs = res.data.data;
    assert.strictEqual(favs.length, 3, 'Should have 3 favorites');

    const dashFav = favs.find(f => f.resource_type === 'dashboard');
    assert.ok(dashFav, 'Dashboard favorite exists');
    assert.strictEqual(dashFav.title, 'Executive Sales Command');

    const reportFav = favs.find(f => f.resource_type === 'report');
    assert.ok(reportFav, 'Report favorite exists');
    assert.strictEqual(reportFav.title, 'Q4 Indian Enterprise Revenue Digest');

    const insightFav = favs.find(f => f.resource_type === 'ai_insight' || f.resource_type === 'insight');
    assert.ok(insightFav, 'AI Insight favorite exists');
    assert.strictEqual(insightFav.title, 'Revenue Surge Detected in APAC Telemetry');
  });

  await test('1.5 Remove a Favorite (Unfavorite)', async () => {
    const res = await request('POST', '/collaboration/favorites/toggle', {
      resourceType: 'report',
      resourceId: reportId
    }, managerToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.isFavorite, false);

    const listRes = await request('GET', '/collaboration/favorites', null, managerToken);
    assert.strictEqual(listRes.data.data.length, 2);
    assert.ok(!listRes.data.data.some(f => f.resource_type === 'report'));
  });

  // -------------------------------------------------------------------------
  // 2. RECENTLY VIEWED END-TO-END
  // -------------------------------------------------------------------------
  await test('2.1 Record Recently Viewed for Dashboard, Report, and AI Insight', async () => {
    const r1 = await request('POST', '/collaboration/recent', { resourceType: 'dashboard', resourceId: dashId }, managerToken);
    assert.strictEqual(r1.status, 200);

    const r2 = await request('POST', '/collaboration/recent', { resourceType: 'report', resourceId: reportId }, managerToken);
    assert.strictEqual(r2.status, 200);

    const r3 = await request('POST', '/collaboration/recent', { resourceType: 'ai_insight', resourceId: insightId }, managerToken);
    assert.strictEqual(r3.status, 200);
  });

  await test('2.2 Verify Recently Viewed List Ordering & Title Enrichment', async () => {
    const res = await request('GET', '/collaboration/recent?limit=10', null, managerToken);
    assert.strictEqual(res.status, 200);
    const recents = res.data.data;
    assert.strictEqual(recents.length, 3);
    // Most recent was AI Insight
    assert.strictEqual(recents[0].resource_type, 'ai_insight');
    assert.strictEqual(recents[0].title, 'Revenue Surge Detected in APAC Telemetry');
    assert.strictEqual(recents[1].resource_type, 'report');
    assert.strictEqual(recents[1].title, 'Q4 Indian Enterprise Revenue Digest');
    assert.strictEqual(recents[2].resource_type, 'dashboard');
    assert.strictEqual(recents[2].title, 'Executive Sales Command');
  });

  await test('2.3 De-duplication — Re-viewing Dashboard Moves it to Top without Duplicates', async () => {
    // Wait a brief ms to ensure distinct timestamp
    await new Promise(r => setTimeout(r, 10));
    await request('POST', '/collaboration/recent', { resourceType: 'dashboard', resourceId: dashId }, managerToken);

    const res = await request('GET', '/collaboration/recent?limit=10', null, managerToken);
    const recents = res.data.data;
    assert.strictEqual(recents.length, 3, 'Must not create duplicate row');
    assert.strictEqual(recents[0].resource_type, 'dashboard', 'Dashboard must now be on top');
  });

  // -------------------------------------------------------------------------
  // 3. SHARED WITH ME & SHARING
  // -------------------------------------------------------------------------
  let insightShareId = null;
  let reportShareId = null;
  let dashShareId = null;

  await test('3.1 Share Dashboard with User 4 (Viewer)', async () => {
    const res = await request('POST', `/collaboration/dashboards/${dashId}/share`, {
      targetUserId: 4,
      permission: 'viewer'
    }, adminToken);
    assert.strictEqual(res.status, 201);
    dashShareId = res.data.data.id;
    assert.ok(dashShareId);
  });

  await test('3.2 Share Report with User 4 (Viewer)', async () => {
    const res = await request('POST', `/collaboration/reports/${reportId}/share`, {
      targetUserId: 4,
      permission: 'viewer'
    }, adminToken);
    assert.strictEqual(res.status, 201);
    reportShareId = res.data.data.id;
    assert.ok(reportShareId);
  });

  await test('3.3 Share AI Insight with User 4 (Viewer)', async () => {
    const res = await request('POST', `/collaboration/insights/${insightId}/share`, {
      targetUserId: 4,
      permission: 'viewer'
    }, adminToken);
    assert.strictEqual(res.status, 201);
    insightShareId = res.data.data.id;
    assert.ok(insightShareId);
  });

  await test('3.4 Recipient Checks "Shared with Me" — Returns Dashboards, Reports, and Insights', async () => {
    const res = await request('GET', '/collaboration/shared-with-me', null, viewerToken);
    assert.strictEqual(res.status, 200);
    const { dashboards, reports, insights } = res.data.data;

    assert.ok(Array.isArray(dashboards), 'dashboards is array');
    assert.ok(Array.isArray(reports), 'reports is array');
    assert.ok(Array.isArray(insights), 'insights is array');

    assert.strictEqual(dashboards.length, 1, 'Recipient has 1 shared dashboard');
    assert.strictEqual(dashboards[0].title, 'Executive Sales Command');
    assert.strictEqual(dashboards[0].permission, 'viewer');

    assert.strictEqual(reports.length, 1, 'Recipient has 1 shared report');
    assert.strictEqual(reports[0].title, 'Q4 Indian Enterprise Revenue Digest');

    assert.strictEqual(insights.length, 1, 'Recipient has 1 shared AI insight');
    assert.strictEqual(insights[0].title, 'Revenue Surge Detected in APAC Telemetry');
  });

  await test('3.5 Revoke AI Insight Share & Confirm Immediate Access Revocation', async () => {
    const res = await request('DELETE', `/collaboration/insights/${insightId}/shares/${insightShareId}`, null, adminToken);
    assert.strictEqual(res.status, 200);

    const checkRes = await request('GET', '/collaboration/shared-with-me', null, viewerToken);
    assert.strictEqual(checkRes.data.data.insights.length, 0, 'Insight must be removed from Shared with Me');
    assert.strictEqual(checkRes.data.data.dashboards.length, 1, 'Dashboard remains shared');
  });

  // -------------------------------------------------------------------------
  // 4. TEAMS & GROUPS REGRESSION
  // -------------------------------------------------------------------------
  let newTeamId = null;

  await test('4.1 List Workspace Teams', async () => {
    const res = await request('GET', '/collaboration/teams', null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.data));
  });

  await test('4.2 Create New Team', async () => {
    const res = await request('POST', '/collaboration/teams', {
      name: 'Revenue Operations Team',
      description: 'Cross-functional sales ops and financial telemetry team'
    }, adminToken);
    assert.strictEqual(res.status, 201);
    newTeamId = res.data.data.id;
    assert.ok(newTeamId);
  });

  await test('4.3 Add Member to Team', async () => {
    const res = await request('POST', `/collaboration/teams/${newTeamId}/members`, {
      targetUserId: 2,
      role: 'member'
    }, adminToken);
    assert.strictEqual(res.status, 201);
  });

  await test('4.4 Get Team Details & Roster', async () => {
    const res = await request('GET', `/collaboration/teams/${newTeamId}`, null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.name, 'Revenue Operations Team');
    assert.ok(res.data.data.members.length >= 2, 'Should include creator and added member');
  });

  await test('4.5 Remove Member from Team', async () => {
    const res = await request('DELETE', `/collaboration/teams/${newTeamId}/members/2`, null, adminToken);
    assert.strictEqual(res.status, 200);

    const checkRes = await request('GET', `/collaboration/teams/${newTeamId}`, null, adminToken);
    assert.ok(!checkRes.data.data.members.some(m => Number(m.user_id) === 2));
  });

  // -------------------------------------------------------------------------
  // 5. SECURITY & TENANT ISOLATION
  // -------------------------------------------------------------------------
  await test('5.1 Cross-Tenant Isolation — Org B cannot see Org A Shared Items', async () => {
    const res = await request('GET', '/collaboration/shared-with-me', null, tenantBToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.dashboards.length, 0);
    assert.strictEqual(res.data.data.reports.length, 0);
    assert.strictEqual(res.data.data.insights.length, 0);
  });

  await test('5.2 Cross-Tenant Isolation — Org B cannot see Org A Favorites', async () => {
    const res = await request('GET', '/collaboration/favorites', null, tenantBToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.length, 0);
  });

  await test('5.3 Cross-Tenant Share Prevention — Sharing with Foreign User Fails (404)', async () => {
    const res = await request('POST', `/collaboration/dashboards/${dashId}/share`, {
      targetUserId: 10, // Org B user
      permission: 'viewer'
    }, adminToken);
    assert.strictEqual(res.status, 404);
  });

  await test('5.4 RBAC — Viewer cannot share or manage teams', async () => {
    const r1 = await request('POST', `/collaboration/dashboards/${dashId}/share`, {
      targetUserId: 2,
      permission: 'viewer'
    }, viewerToken);
    assert.strictEqual(r1.status, 403);

    const r2 = await request('POST', '/collaboration/teams', {
      name: 'Unauthorized Team'
    }, viewerToken);
    assert.strictEqual(r2.status, 403);
  });

  // -------------------------------------------------------------------------
  // RESULTS SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  COLLABORATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
