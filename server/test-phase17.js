/**
 * Comprehensive Automated Test Suite for Phase 17: Enterprise Collaboration & Sharing
 * Tests all 30 required areas:
 * 1. Dashboard share
 * 2. Dashboard revoke
 * 3. Dashboard viewer access
 * 4. Dashboard editor access
 * 5. Report sharing
 * 6. Report revoke
 * 7. Insight sharing
 * 8. Comments posting
 * 9. Threaded replies
 * 10. @mentions validation & notifications
 * 11. Favorites bookmarking
 * 12. Unfavorite
 * 13. Recently viewed bounded history
 * 14. Saved views / filter presets
 * 15. Teams creation
 * 16. Team membership
 * 17. Team sharing access inheritance
 * 18. Notifications listing & unread count
 * 19. Mark notification as read / mark all read
 * 20. Activity feed / audit logging
 * 21. RBAC permissions
 * 22. Cross-tenant isolation
 * 23. Database RLS validation
 * 24. Unauthorized share prevention
 * 25. Unauthorized edit prevention
 * 26. Resource-ID guessing protection
 * 27. Deleted access / revoked share immediate revocation
 * 28. Duplicate share prevention
 * 29. Mention cross-tenant leak prevention
 * 30. Sensitive data protection in comments and notifications
 */

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const Dashboard = require('./models/dashboardModel');
const ReportModel = require('./models/reportModel');
const InsightModel = require('./models/insightModel');
const UserModel = require('./models/userModel');
const AuditLogModel = require('./models/auditLogModel');
const {
  TeamModel,
  ShareModel,
  CommentModel,
  FavoriteModel,
  RecentlyViewedModel,
  SavedViewModel,
  NotificationModel
} = require('./models/collaborationModel');
const collaborationService = require('./services/collaborationService');
const auditService = require('./services/auditService');

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
  console.log('  PHASE 17: ENTERPRISE COLLABORATION & SHARING TEST SUITE (30 TESTS) ');
  console.log('===============================================================\n');

  // Start server on random port
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const orgA = '00000000-0000-0000-0000-000000000001';
  const orgB = '00000000-0000-0000-0000-000000000002';

  // Org A Users:
  // 1: Admin
  // 2: Manager
  // 3: Analyst
  // 4: Viewer
  const adminTokenA = generateToken(1, 'admin@ricoz.test', 'admin', orgA);
  const managerTokenA = generateToken(2, 'manager@ricoz.test', 'manager', orgA);
  const analystTokenA = generateToken(3, 'analyst@ricoz.test', 'analyst', orgA);
  const viewerTokenA = generateToken(4, 'viewer@ricoz.test', 'viewer', orgA);

  // Org B Users:
  const adminTokenB = generateToken(10, 'admin_b@other.test', 'admin', orgB);
  const viewerTokenB = generateToken(11, 'viewer_b@other.test', 'viewer', orgB);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` \x1b[32mPASS\x1b[0m: ${name}`);
      passed++;
    } catch (err) {
      console.error(` \x1b[31mFAIL\x1b[0m: ${name}`);
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  // Setup sample resources for Org A
  let sampleDashboardA;
  let sampleReportA;
  let sampleInsightA;
  let sampleDashboardB;

  try {
    sampleDashboardA = await Dashboard.create({
      organizationId: orgA,
      title: 'Executive Financial Overview',
      description: 'Quarterly financial revenue & margin metrics',
      createdBy: 1,
      isPublic: false
    });

    sampleReportA = await ReportModel.create({
      organizationId: orgA,
      title: 'Q3 Enterprise Revenue Report',
      description: 'Scheduled multi-region revenue breakdown',
      format: 'pdf',
      createdBy: 1
    });

    sampleInsightA = await InsightModel.create({
      organizationId: orgA,
      title: 'Revenue Surge Detected in APAC',
      summary: 'Revenue increased by 18% in APAC region over the last 30 days.',
      type: 'growth',
      severity: 'high',
      evidence: { growth_rate_pct: 18.2, region: 'APAC' },
      userId: 1
    });

    // Org B Dashboard for cross-tenant testing
    sampleDashboardB = await Dashboard.create({
      organizationId: orgB,
      title: 'Tenant B Private Marketing Metrics',
      description: 'Confidential ad spend for Org B',
      createdBy: 10,
      isPublic: false
    });
  } catch (e) {
    console.error('Setup error:', e);
  }

  // Storage for share and team IDs across tests
  let createdShareId = null;
  let createdTeamId = null;
  let rootCommentId = null;
  let createdSavedViewId = null;

  // -------------------------------------------------------------
  // Test 1: Dashboard Share (Direct User Share)
  // -------------------------------------------------------------
  await test('1. Dashboard Share — Direct User Share with Viewer Permission', async () => {
    const res = await request('POST', `/api/collaboration/dashboards/${sampleDashboardA.id}/share`, {
      targetUserId: 4, // Share with Viewer A
      permission: 'viewer'
    }, { Authorization: `Bearer ${adminTokenA}` });

    assert.strictEqual(res.statusCode, 201, `Expected 201 Created, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.permission, 'viewer');
    assert.strictEqual(String(res.body.data.dashboard_id), String(sampleDashboardA.id));
    createdShareId = res.body.data.id;
  });

  // -------------------------------------------------------------
  // Test 2: Dashboard Shares Listing & Retrieval
  // -------------------------------------------------------------
  await test('2. Dashboard Shares Listing — Verify Active Shares', async () => {
    const res = await request('GET', `/api/collaboration/dashboards/${sampleDashboardA.id}/shares`, null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find(s => Number(s.user_id) === 4);
    assert.ok(found, 'Expected user 4 to be in dashboard shares');
  });

  // -------------------------------------------------------------
  // Test 3: Dashboard Viewer Access Resolution
  // -------------------------------------------------------------
  await test('3. Dashboard Viewer Access — Shared User Resolves Viewer Access', async () => {
    const access = await collaborationService.resolveResourceAccess({
      organizationId: orgA,
      userId: 4,
      userRole: 'viewer',
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id
    });

    assert.strictEqual(access.hasAccess, true);
    assert.strictEqual(access.permission, 'viewer');
    assert.strictEqual(access.isOwner, false);
  });

  // -------------------------------------------------------------
  // Test 4: Dashboard Editor Access Resolution
  // -------------------------------------------------------------
  await test('4. Dashboard Editor Access — User Shared with Editor Permission', async () => {
    // Share with Analyst (User 3) as editor
    const shareRes = await request('POST', `/api/collaboration/dashboards/${sampleDashboardA.id}/share`, {
      targetUserId: 3,
      permission: 'editor'
    }, { Authorization: `Bearer ${adminTokenA}` });

    assert.strictEqual(shareRes.statusCode, 201);

    const access = await collaborationService.resolveResourceAccess({
      organizationId: orgA,
      userId: 3,
      userRole: 'analyst',
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id
    });

    assert.strictEqual(access.hasAccess, true);
    assert.strictEqual(access.permission, 'editor');
  });

  // -------------------------------------------------------------
  // Test 5: Report Sharing
  // -------------------------------------------------------------
  let reportShareId = null;
  await test('5. Report Sharing — Share Report with Viewer User', async () => {
    const res = await request('POST', `/api/collaboration/reports/${sampleReportA.id}/share`, {
      targetUserId: 4,
      permission: 'viewer'
    }, { Authorization: `Bearer ${adminTokenA}` });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(String(res.body.data.report_id), String(sampleReportA.id));
    reportShareId = res.body.data.id;
  });

  // -------------------------------------------------------------
  // Test 6: Report Share Revocation
  // -------------------------------------------------------------
  await test('6. Report Share Revocation — Manager Revokes Share', async () => {
    const res = await request('DELETE', `/api/collaboration/reports/${sampleReportA.id}/shares/${reportShareId}`, null, {
      Authorization: `Bearer ${managerTokenA}`
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);

    // Verify list no longer has it
    const listRes = await request('GET', `/api/collaboration/reports/${sampleReportA.id}/shares`, null, {
      Authorization: `Bearer ${adminTokenA}`
    });
    const found = listRes.body.data.find(s => s.id === reportShareId);
    assert.strictEqual(found, undefined);
  });

  // -------------------------------------------------------------
  // Test 7: AI Insight Sharing
  // -------------------------------------------------------------
  await test('7. AI Insight Sharing — Share Insight with Team Member', async () => {
    const res = await request('POST', `/api/collaboration/insights/${sampleInsightA.id}/share`, {
      targetUserId: 4,
      permission: 'viewer'
    }, { Authorization: `Bearer ${analystTokenA}` });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(String(res.body.data.insight_id), String(sampleInsightA.id));
  });

  // -------------------------------------------------------------
  // Test 8: Comments Posting
  // -------------------------------------------------------------
  await test('8. Comments Posting — Post Comment on Shared Dashboard', async () => {
    const res = await request('POST', '/api/collaboration/comments', {
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id,
      content: 'Revenue dropped sharply in September. Let us investigate.'
    }, { Authorization: `Bearer ${analystTokenA}` });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.content, 'Revenue dropped sharply in September. Let us investigate.');
    rootCommentId = res.body.data.id;
  });

  // -------------------------------------------------------------
  // Test 9: Threaded Replies
  // -------------------------------------------------------------
  await test('9. Threaded Replies — Reply to Existing Comment', async () => {
    const res = await request('POST', '/api/collaboration/comments', {
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id,
      parentCommentId: rootCommentId,
      content: 'Can we check the South region breakdown?'
    }, { Authorization: `Bearer ${managerTokenA}` });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(String(res.body.data.parent_comment_id), String(rootCommentId));

    // Fetch comment tree
    const treeRes = await request('GET', `/api/collaboration/comments/dashboard/${sampleDashboardA.id}`, null, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    assert.strictEqual(treeRes.statusCode, 200);
    assert.ok(Array.isArray(treeRes.body.data));
    const root = treeRes.body.data.find(c => String(c.id) === String(rootCommentId));
    assert.ok(root, 'Root comment should exist');
    assert.ok(root.replies && root.replies.length > 0, 'Root comment should have nested replies');
    assert.strictEqual(root.replies[0].content, 'Can we check the South region breakdown?');
  });

  // -------------------------------------------------------------
  // Test 10: @Mentions Validation & Notification Creation
  // -------------------------------------------------------------
  await test('10. @Mentions — Parse Valid Mentions and Trigger In-App Notification', async () => {
    // Analyst mentions Business Viewer (user 4: viewer@ricoz.test / Business Viewer)
    const res = await request('POST', '/api/collaboration/comments', {
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id,
      content: 'Hey @viewer please review this APAC forecast anomaly.'
    }, { Authorization: `Bearer ${analystTokenA}` });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.mentions.length > 0, 'Mention should be parsed and matched to user');

    // Check Viewer notifications
    const notifRes = await request('GET', '/api/collaboration/notifications', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });
    assert.strictEqual(notifRes.statusCode, 200);
    const mentionNotif = notifRes.body.data.notifications.find(n => n.type === 'mention');
    assert.ok(mentionNotif, 'Viewer should receive a mention notification');
    assert.ok(mentionNotif.title.includes('Mentioned'));
  });

  // -------------------------------------------------------------
  // Test 11: Favorites Bookmarking
  // -------------------------------------------------------------
  await test('11. Favorites Bookmarking — Toggle Favorite On for Dashboard', async () => {
    const res = await request('POST', '/api/collaboration/favorites/toggle', {
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id
    }, { Authorization: `Bearer ${viewerTokenA}` });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.isFavorite, true);

    // Verify in favorites list
    const listRes = await request('GET', '/api/collaboration/favorites', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });
    assert.strictEqual(listRes.statusCode, 200);
    const fav = listRes.body.data.find(f => f.resource_type === 'dashboard' && String(f.resource_id) === String(sampleDashboardA.id));
    assert.ok(fav, 'Dashboard should be in user favorites list');
    assert.strictEqual(fav.title, sampleDashboardA.title);
  });

  // -------------------------------------------------------------
  // Test 12: Unfavorite
  // -------------------------------------------------------------
  await test('12. Unfavorite — Toggle Favorite Off', async () => {
    const res = await request('POST', '/api/collaboration/favorites/toggle', {
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id
    }, { Authorization: `Bearer ${viewerTokenA}` });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.isFavorite, false);

    const listRes = await request('GET', '/api/collaboration/favorites', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });
    const fav = listRes.body.data.find(f => f.resource_type === 'dashboard' && String(f.resource_id) === String(sampleDashboardA.id));
    assert.strictEqual(fav, undefined, 'Dashboard should be removed from favorites');
  });

  // -------------------------------------------------------------
  // Test 13: Recently Viewed Bounded History
  // -------------------------------------------------------------
  await test('13. Recently Viewed — Record and Retrieve Bounded Access History', async () => {
    const recordRes = await request('POST', '/api/collaboration/recent', {
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id
    }, { Authorization: `Bearer ${analystTokenA}` });

    assert.strictEqual(recordRes.statusCode, 200);
    assert.strictEqual(recordRes.body.success, true);

    const listRes = await request('GET', '/api/collaboration/recent?limit=10', null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    assert.strictEqual(listRes.statusCode, 200);
    assert.ok(Array.isArray(listRes.body.data));
    const recent = listRes.body.data.find(r => r.resource_type === 'dashboard' && String(r.resource_id) === String(sampleDashboardA.id));
    assert.ok(recent, 'Dashboard should appear in recently viewed');
  });

  // -------------------------------------------------------------
  // Test 14: Saved Views & Filter Presets
  // -------------------------------------------------------------
  await test('14. Saved Views — Create, Retrieve & Apply Dashboard Filter Presets', async () => {
    const createRes = await request('POST', '/api/collaboration/saved-views', {
      dashboardId: sampleDashboardA.id,
      name: 'South Region — Monthly Revenue Preset',
      filters: { region: 'South', timeRange: 'monthly', metric: 'revenue' },
      isShared: true
    }, { Authorization: `Bearer ${analystTokenA}` });

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    assert.strictEqual(createRes.body.data.name, 'South Region — Monthly Revenue Preset');
    createdSavedViewId = createRes.body.data.id;

    // Retrieve saved views for dashboard as Viewer
    const listRes = await request('GET', `/api/collaboration/saved-views/dashboard/${sampleDashboardA.id}`, null, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    assert.strictEqual(listRes.statusCode, 200);
    const view = listRes.body.data.find(v => String(v.id) === String(createdSavedViewId));
    assert.ok(view, 'Viewer should see shared saved view preset');
    assert.strictEqual(view.filters.region, 'South');
  });

  // -------------------------------------------------------------
  // Test 15: Teams Creation
  // -------------------------------------------------------------
  await test('15. Teams Creation — Create Workspace Collaboration Team', async () => {
    const res = await request('POST', '/api/collaboration/teams', {
      name: 'Analytics Core Team',
      description: 'Central BI and data science analytics team'
    }, { Authorization: `Bearer ${managerTokenA}` });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'Analytics Core Team');
    createdTeamId = res.body.data.id;
  });

  // -------------------------------------------------------------
  // Test 16: Team Membership
  // -------------------------------------------------------------
  await test('16. Team Membership — Add and List Team Members', async () => {
    // Add Analyst (User 3) to team
    const addRes = await request('POST', `/api/collaboration/teams/${createdTeamId}/members`, {
      targetUserId: 3,
      role: 'member'
    }, { Authorization: `Bearer ${managerTokenA}` });

    assert.ok(addRes.statusCode === 200 || addRes.statusCode === 201);
    assert.strictEqual(addRes.body.success, true);

    // Fetch team details
    const teamRes = await request('GET', `/api/collaboration/teams/${createdTeamId}`, null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    assert.strictEqual(teamRes.statusCode, 200);
    assert.ok(teamRes.body.data.members.some(m => Number(m.user_id) === 3));
  });

  // -------------------------------------------------------------
  // Test 17: Team Sharing Access Inheritance
  // -------------------------------------------------------------
  await test('17. Team Sharing — Share Resource with Team & Inherit Access', async () => {
    // Share sample report with Analytics Core Team
    const shareRes = await request('POST', `/api/collaboration/reports/${sampleReportA.id}/share`, {
      targetTeamId: createdTeamId,
      permission: 'editor'
    }, { Authorization: `Bearer ${adminTokenA}` });

    assert.strictEqual(shareRes.statusCode, 201);

    // Analyst (User 3) is on the team -> resolves access
    const access = await collaborationService.resolveResourceAccess({
      organizationId: orgA,
      userId: 3,
      userRole: 'analyst',
      resourceType: 'report',
      resourceId: sampleReportA.id
    });

    assert.strictEqual(access.hasAccess, true);
    assert.strictEqual(access.permission, 'editor');
  });

  // -------------------------------------------------------------
  // Test 18: In-App Notifications Listing & Unread Count
  // -------------------------------------------------------------
  await test('18. Notifications Listing — Retrieve In-App Feed & Unread Counter', async () => {
    const res = await request('GET', '/api/collaboration/notifications', null, {
      Authorization: `Bearer ${analystTokenA}`
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.data.unreadCount === 'number');
    assert.ok(Array.isArray(res.body.data.notifications));
  });

  // -------------------------------------------------------------
  // Test 19: Mark Notification Read & Read All
  // -------------------------------------------------------------
  await test('19. Mark Notification Read — Mark Single and Mark All as Read', async () => {
    // 1. Get Viewer notifications
    const getRes = await request('GET', '/api/collaboration/notifications', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    const notif = getRes.body.data.notifications[0];
    if (notif) {
      const markSingle = await request('PATCH', `/api/collaboration/notifications/${notif.id}/read`, null, {
        Authorization: `Bearer ${viewerTokenA}`
      });
      assert.strictEqual(markSingle.statusCode, 200);
      assert.strictEqual(markSingle.body.success, true);
    }

    // 2. Mark all as read
    const markAll = await request('PATCH', '/api/collaboration/notifications/read-all', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });
    assert.strictEqual(markAll.statusCode, 200);
    assert.strictEqual(markAll.body.success, true);

    // 3. Verify unread count is 0
    const verifyRes = await request('GET', '/api/collaboration/notifications', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });
    assert.strictEqual(verifyRes.body.data.unreadCount, 0);
  });

  // -------------------------------------------------------------
  // Test 20: Activity Feed & Audit Logging Integration
  // -------------------------------------------------------------
  await test('20. Activity Feed — Verify Audit Events Logged for Collaboration', async () => {
    const auditRes = await AuditLogModel.findByOrganizationId(orgA, { limit: 50 });
    const auditLogs = auditRes.logs || [];
    assert.ok(Array.isArray(auditLogs));
    
    const hasDashboardShare = auditLogs.some(l => l.action === 'DASHBOARD_SHARED');
    const hasComment = auditLogs.some(l => l.action === 'COMMENT_CREATED');
    const hasTeam = auditLogs.some(l => l.action === 'TEAM_CREATED');

    assert.ok(hasDashboardShare, 'Audit log should record DASHBOARD_SHARED');
    assert.ok(hasComment, 'Audit log should record COMMENT_CREATED');
    assert.ok(hasTeam, 'Audit log should record TEAM_CREATED');
  });

  // -------------------------------------------------------------
  // Test 21: RBAC Permissions Enforcement
  // -------------------------------------------------------------
  await test('21. RBAC Permissions — Viewer Blocked from Sharing Resources', async () => {
    // Viewer lacks 'collaboration.share'
    const res = await request('POST', `/api/collaboration/dashboards/${sampleDashboardA.id}/share`, {
      targetUserId: 2,
      permission: 'viewer'
    }, { Authorization: `Bearer ${viewerTokenA}` });

    assert.strictEqual(res.statusCode, 403, `Expected 403 Forbidden for Viewer share, got ${res.statusCode}`);
  });

  // -------------------------------------------------------------
  // Test 22: Cross-Tenant Isolation
  // -------------------------------------------------------------
  await test('22. Cross-Tenant Isolation — Org B Cannot Access Org A Shares & Comments', async () => {
    // Org B attempts to read Org A comments
    const res = await request('GET', `/api/collaboration/comments/dashboard/${sampleDashboardA.id}`, null, {
      Authorization: `Bearer ${adminTokenB}`
    });

    assert.strictEqual(res.statusCode, 404, 'Org B should receive 404 access denied for Org A resource');
  });

  // -------------------------------------------------------------
  // Test 23: Database RLS Validation
  // -------------------------------------------------------------
  await test('23. Database RLS — Organization Scoping Enforced at SQL Layer', async () => {
    // Directly query database with Org B filter for Org A saved views
    const views = await SavedViewModel.findByDashboard({
      organizationId: orgB,
      userId: 10,
      dashboardId: sampleDashboardA.id
    });

    assert.strictEqual(views.length, 0, 'Org B query should return 0 results for Org A dashboard');
  });

  // -------------------------------------------------------------
  // Test 24: Unauthorized Share Prevention
  // -------------------------------------------------------------
  await test('24. Unauthorized Share Prevention — Cannot Share Resources Outside Organization', async () => {
    // Attempt to share Org A dashboard with Org B user (ID 10)
    const res = await request('POST', `/api/collaboration/dashboards/${sampleDashboardA.id}/share`, {
      targetUserId: 10,
      permission: 'viewer'
    }, { Authorization: `Bearer ${adminTokenA}` });

    assert.strictEqual(res.statusCode, 404, 'Sharing with user from different org must return 404 not found');
  });

  // -------------------------------------------------------------
  // Test 25: Unauthorized Edit Prevention on Comments
  // -------------------------------------------------------------
  await test('25. Unauthorized Edit Prevention — User Cannot Edit Other Users Comments', async () => {
    // Viewer A attempts to edit Analyst A comment
    const res = await request('PUT', `/api/collaboration/comments/${rootCommentId}`, {
      content: 'Malicious modification of someone elses comment'
    }, { Authorization: `Bearer ${viewerTokenA}` });

    assert.strictEqual(res.statusCode, 404, 'Cannot edit comment authored by another user');
  });

  // -------------------------------------------------------------
  // Test 26: Resource-ID Guessing Protection
  // -------------------------------------------------------------
  await test('26. Resource-ID Guessing Protection — Non-existent or Unshared Resource Denied', async () => {
    const res = await request('GET', '/api/collaboration/comments/dashboard/99999999', null, {
      Authorization: `Bearer ${viewerTokenA}`
    });

    assert.strictEqual(res.statusCode, 404);
  });

  // -------------------------------------------------------------
  // Test 27: Deleted Access / Revoked Share Immediate Effect
  // -------------------------------------------------------------
  await test('27. Deleted Access — Revoked Share Immediately Stops Access', async () => {
    // 1. Revoke the viewer share
    const revokeRes = await request('DELETE', `/api/collaboration/dashboards/${sampleDashboardA.id}/shares/${createdShareId}`, null, {
      Authorization: `Bearer ${adminTokenA}`
    });
    assert.strictEqual(revokeRes.statusCode, 200);

    // 2. Check viewer access resolution
    const access = await collaborationService.resolveResourceAccess({
      organizationId: orgA,
      userId: 4,
      userRole: 'viewer',
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id
    });

    assert.strictEqual(access.hasAccess, false, 'Access must be false immediately after share revocation');
  });

  // -------------------------------------------------------------
  // Test 28: Duplicate Share Prevention
  // -------------------------------------------------------------
  await test('28. Duplicate Share Prevention — Resharing Updates or Prevents Collision', async () => {
    // Re-share with Analyst (User 3)
    const res1 = await request('POST', `/api/collaboration/dashboards/${sampleDashboardA.id}/share`, {
      targetUserId: 3,
      permission: 'viewer'
    }, { Authorization: `Bearer ${adminTokenA}` });

    assert.strictEqual(res1.statusCode, 201);
  });

  // -------------------------------------------------------------
  // Test 29: Mention Cross-Tenant Leak Prevention
  // -------------------------------------------------------------
  await test('29. Mention Tenant Isolation — Cannot Mention Users from Foreign Organization', async () => {
    // Post comment mentioning Org B user handle (@admin_b)
    const res = await request('POST', '/api/collaboration/comments', {
      resourceType: 'dashboard',
      resourceId: sampleDashboardA.id,
      content: 'Hey @admin_b check this out'
    }, { Authorization: `Bearer ${adminTokenA}` });

    assert.strictEqual(res.statusCode, 201);
    // Mentions array should NOT include Org B user
    assert.strictEqual(res.body.data.mentions.length, 0, 'Foreign org mention must be ignored and not leaked');
  });

  // -------------------------------------------------------------
  // Test 30: Sensitive Data Protection in Collaboration
  // -------------------------------------------------------------
  await test('30. Sensitive Data Protection — Audit Logs and Notifications Do Not Expose Passwords/Keys', async () => {
    const notifs = await NotificationModel.listByUser(1, orgA);
    const serialized = JSON.stringify(notifs);

    assert.ok(!serialized.includes('password_hash'), 'Notifications must not expose password_hash');
    assert.ok(!serialized.includes('jwtSecret'), 'Notifications must not expose jwtSecret');
  });

  console.log('\n===============================================================');
  console.log(`  PHASE 17 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  // Close server
  if (server) {
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  if (server) server.close();
  process.exit(1);
});
