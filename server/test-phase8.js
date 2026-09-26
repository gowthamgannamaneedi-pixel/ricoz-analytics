/**
 * Comprehensive Automated Test Suite for Phase 8: Interactive Dashboard Builder & Multi-Dashboard Management
 * Tests 18 critical functional, security, RBAC, and multi-tenant isolation requirements:
 * 
 * 1. Unauthenticated request to /api/dashboards returns 401 Unauthorized
 * 2. Authenticated user can list dashboards (GET /api/dashboards)
 * 3. Authorized user (analyst) can create dashboard (POST /api/dashboards)
 * 4. Viewer role cannot create dashboard (403 Forbidden)
 * 5. Authorized user (manager) can update dashboard (PUT /api/dashboards/:id)
 * 6. Viewer role cannot update dashboard (403 Forbidden)
 * 7. Authorized user (admin) can delete dashboard (DELETE /api/dashboards/:id)
 * 8. Viewer role cannot delete dashboard (403 Forbidden)
 * 9. Authorized user can add widget to dashboard (POST /api/dashboards/:id/widgets)
 * 10. Viewer role cannot add widget to dashboard (403 Forbidden)
 * 11. Authorized user can update widget configuration (PUT /api/dashboards/:id/widgets/:widgetId)
 * 12. Authorized user can delete widget from dashboard (DELETE /api/dashboards/:id/widgets/:widgetId)
 * 13. Multi-tenancy isolation: Foreign organization cannot access dashboard (404 Isolated)
 * 14. Multi-tenancy isolation: Foreign organization cannot modify dashboard (404 Isolated)
 * 15. Multi-tenancy isolation: Foreign organization cannot add widget to another org's dashboard (404 Isolated)
 * 16. Default dashboard handling: Setting is_default updates existing default flags
 * 17. Single dashboard retrieval (GET /api/dashboards/:id) includes populated widgets list with enrichment
 * 18. Validation: Missing title or invalid widget type rejected with 400 Bad Request
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const UserModel = require('./models/userModel');
const DashboardModel = require('./models/dashboardModel');

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

async function runPhase8Tests() {
  console.log('====================================================');
  console.log('  RicozAnalytics Phase 8: Dashboard System Test     ');
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
    // Test 1: Unauthenticated request to /api/dashboards returns 401
    // ------------------------------------------------------------------------
    const unauthRes = await request('GET', '/api/dashboards');
    assert(
      unauthRes.status === 401 && unauthRes.data.success === false,
      'Unauthenticated request to /api/dashboards returns 401 Unauthorized'
    );

    // ------------------------------------------------------------------------
    // Setup Organizations & Users with distinct RBAC roles
    // ------------------------------------------------------------------------
    const orgARes = await request('POST', '/api/auth/register', {
      name: 'Darren Director',
      email: `darren_director_${Date.now()}@delta-corp.test`,
      password: 'Password123!',
      organization_name: 'Delta Corp Global'
    });
    const orgAId = orgARes.data.user.organization_id;
    const analystUserId = orgARes.data.user.id;

    // Promote Darren to Analyst
    await UserModel.updateRole(analystUserId, 'analyst');
    const analystToken = jwt.sign(
      { id: analystUserId, email: orgARes.data.user.email, role: 'analyst', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Create a Viewer in Org A
    const viewerEmail = `vanessa_viewer_${Date.now()}@delta-corp.test`;
    const viewerUser = await UserModel.create({
      email: viewerEmail,
      password_hash: 'hashed_pw_test',
      name: 'Vanessa Viewer',
      role: 'viewer',
      organization_id: orgAId
    });
    const viewerToken = jwt.sign(
      { id: viewerUser.id, email: viewerEmail, role: 'viewer', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Create a Manager in Org A
    const managerEmail = `marcus_manager_${Date.now()}@delta-corp.test`;
    const managerUser = await UserModel.create({
      email: managerEmail,
      password_hash: 'hashed_pw_test',
      name: 'Marcus Manager',
      role: 'manager',
      organization_id: orgAId
    });
    const managerToken = jwt.sign(
      { id: managerUser.id, email: managerEmail, role: 'manager', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Create an Admin in Org A
    const adminEmail = `arthur_admin_${Date.now()}@delta-corp.test`;
    const adminUser = await UserModel.create({
      email: adminEmail,
      password_hash: 'hashed_pw_test',
      name: 'Arthur Admin',
      role: 'admin',
      organization_id: orgAId
    });
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminEmail, role: 'admin', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Create Org B for Multi-Tenancy barrier testing
    const orgBRes = await request('POST', '/api/auth/register', {
      name: 'Fiona Foreign',
      email: `fiona_foreign_${Date.now()}@foreign-org.test`,
      password: 'Password123!',
      organization_name: 'Foreign Org Ltd'
    });
    const orgBId = orgBRes.data.user.organization_id;
    const userBId = orgBRes.data.user.id;
    await UserModel.updateRole(userBId, 'admin');
    const userBToken = jwt.sign(
      { id: userBId, email: orgBRes.data.user.email, role: 'admin', organization_id: orgBId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // ------------------------------------------------------------------------
    // Test 2: Authenticated user can list dashboards (GET /api/dashboards)
    // ------------------------------------------------------------------------
    const listRes = await request('GET', '/api/dashboards', null, {
      'Authorization': `Bearer ${viewerToken}`
    });
    assert(
      listRes.status === 200 &&
      listRes.data.success === true &&
      Array.isArray(listRes.data.dashboards),
      'Authenticated user (viewer) can list organization dashboards with 200 OK'
    );

    // ------------------------------------------------------------------------
    // Test 3: Authorized user (analyst) can create dashboard (POST /api/dashboards)
    // ------------------------------------------------------------------------
    const createRes = await request('POST', '/api/dashboards', {
      title: 'Executive Sales Overview',
      description: 'C-suite revenue and channel commercial telemetry',
      is_default: true,
      layout: [{ i: 'w1', x: 0, y: 0, w: 6, h: 4 }]
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    assert(
      createRes.status === 201 &&
      createRes.data.success === true &&
      createRes.data.dashboard.title === 'Executive Sales Overview' &&
      createRes.data.dashboard.is_default === true &&
      createRes.data.dashboard.organization_id === orgAId,
      'Authorized user (analyst) creates dashboard with 201 Created and org binding'
    );

    const dashboard1Id = createRes.data.dashboard.id;

    // ------------------------------------------------------------------------
    // Test 4: Viewer role cannot create dashboard (403 Forbidden)
    // ------------------------------------------------------------------------
    const viewerCreateRes = await request('POST', '/api/dashboards', {
      title: 'Unauthorized Viewer Dashboard'
    }, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerCreateRes.status === 403 &&
      viewerCreateRes.data.success === false,
      'RBAC: Viewer role is blocked from creating dashboards (403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // Test 5: Authorized user (manager) can update dashboard (PUT /api/dashboards/:id)
    // ------------------------------------------------------------------------
    const managerUpdateRes = await request('PUT', `/api/dashboards/${dashboard1Id}`, {
      title: 'Executive Sales & Operations Overview',
      description: 'Updated C-suite telemetry and operations tracking'
    }, {
      'Authorization': `Bearer ${managerToken}`
    });

    assert(
      managerUpdateRes.status === 200 &&
      managerUpdateRes.data.success === true &&
      managerUpdateRes.data.dashboard.title === 'Executive Sales & Operations Overview',
      'Authorized user (manager) updates dashboard title and description with 200 OK'
    );

    // ------------------------------------------------------------------------
    // Test 6: Viewer role cannot update dashboard (403 Forbidden)
    // ------------------------------------------------------------------------
    const viewerUpdateRes = await request('PUT', `/api/dashboards/${dashboard1Id}`, {
      title: 'Hacked Title'
    }, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerUpdateRes.status === 403 &&
      viewerUpdateRes.data.success === false,
      'RBAC: Viewer role is blocked from updating dashboards (403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // Test 7: Authorized user can add widget to dashboard (POST /api/dashboards/:id/widgets)
    // ------------------------------------------------------------------------
    const addWidgetRes1 = await request('POST', `/api/dashboards/${dashboard1Id}/widgets`, {
      title: 'Total Sales Revenue KPI',
      type: 'kpi_card',
      configuration: { aggregation: 'SUM', targetValue: 500000 },
      position: { x: 0, y: 0, w: 6, h: 4 }
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    const addWidgetRes2 = await request('POST', `/api/dashboards/${dashboard1Id}/widgets`, {
      title: 'Monthly Realization Trendline',
      type: 'line_chart',
      configuration: { dateColumn: 'order_date', valueColumn: 'sales_amount' },
      position: { x: 6, y: 0, w: 6, h: 4 }
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    assert(
      addWidgetRes1.status === 201 &&
      addWidgetRes1.data.success === true &&
      addWidgetRes1.data.widget.type === 'kpi_card' &&
      addWidgetRes2.status === 201 &&
      addWidgetRes2.data.widget.type === 'line_chart',
      'Authorized user adds KPI Card and Line Chart widgets to dashboard with 201 Created'
    );

    const widget1Id = addWidgetRes1.data.widget.id;
    const widget2Id = addWidgetRes2.data.widget.id;

    // ------------------------------------------------------------------------
    // Test 8: Viewer role cannot add widget to dashboard (403 Forbidden)
    // ------------------------------------------------------------------------
    const viewerAddWidgetRes = await request('POST', `/api/dashboards/${dashboard1Id}/widgets`, {
      title: 'Unauthorized Widget',
      type: 'table'
    }, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerAddWidgetRes.status === 403 &&
      viewerAddWidgetRes.data.success === false,
      'RBAC: Viewer role is blocked from adding widgets to dashboards (403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // Test 9: Authorized user can update widget configuration (PUT /api/dashboards/:id/widgets/:widgetId)
    // ------------------------------------------------------------------------
    const updateWidgetRes = await request('PUT', `/api/dashboards/${dashboard1Id}/widgets/${widget1Id}`, {
      title: 'Q4 Gross Sales Revenue (Updated)',
      configuration: { aggregation: 'SUM', targetValue: 750000 },
      position: { x: 0, y: 0, w: 12, h: 4 }
    }, {
      'Authorization': `Bearer ${managerToken}`
    });

    assert(
      updateWidgetRes.status === 200 &&
      updateWidgetRes.data.success === true &&
      updateWidgetRes.data.widget.title === 'Q4 Gross Sales Revenue (Updated)',
      'Authorized user (manager) updates widget configuration and width position with 200 OK'
    );

    // ------------------------------------------------------------------------
    // Test 10: Viewer role cannot update or delete widget (403 Forbidden)
    // ------------------------------------------------------------------------
    const viewerUpdateWRes = await request('PUT', `/api/dashboards/${dashboard1Id}/widgets/${widget1Id}`, {
      title: 'Hacked Widget'
    }, {
      'Authorization': `Bearer ${viewerToken}`
    });

    const viewerDeleteWRes = await request('DELETE', `/api/dashboards/${dashboard1Id}/widgets/${widget1Id}`, null, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerUpdateWRes.status === 403 &&
      viewerDeleteWRes.status === 403,
      'RBAC: Viewer role is blocked from updating or deleting widgets (403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // Test 11: Single dashboard retrieval (GET /api/dashboards/:id) includes populated widgets
    // ------------------------------------------------------------------------
    const getSingleRes = await request('GET', `/api/dashboards/${dashboard1Id}`, null, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      getSingleRes.status === 200 &&
      getSingleRes.data.success === true &&
      getSingleRes.data.dashboard.id === dashboard1Id &&
      Array.isArray(getSingleRes.data.dashboard.widgets) &&
      getSingleRes.data.dashboard.widgets.length === 2,
      'GET /api/dashboards/:id returns dashboard populated with 2 active widgets'
    );

    // ------------------------------------------------------------------------
    // Test 12: Authorized user can delete a widget (DELETE /api/dashboards/:id/widgets/:widgetId)
    // ------------------------------------------------------------------------
    const deleteWidgetRes = await request('DELETE', `/api/dashboards/${dashboard1Id}/widgets/${widget2Id}`, null, {
      'Authorization': `Bearer ${analystToken}`
    });

    const verifyWidgetDeletedRes = await request('GET', `/api/dashboards/${dashboard1Id}`, null, {
      'Authorization': `Bearer ${analystToken}`
    });

    assert(
      deleteWidgetRes.status === 200 &&
      deleteWidgetRes.data.success === true &&
      verifyWidgetDeletedRes.data.dashboard.widgets.length === 1,
      'Authorized user deletes widget from dashboard with 200 OK and confirms removal'
    );

    // ------------------------------------------------------------------------
    // Test 13: Multi-tenancy isolation: Foreign organization cannot access dashboard (404)
    // ------------------------------------------------------------------------
    const crossOrgGetRes = await request('GET', `/api/dashboards/${dashboard1Id}`, null, {
      'Authorization': `Bearer ${userBToken}`
    });

    assert(
      crossOrgGetRes.status === 404,
      'Multi-Tenancy: Foreign organization (Org B) cannot view Org A dashboard (404 Isolated)'
    );

    // ------------------------------------------------------------------------
    // Test 14: Multi-tenancy isolation: Foreign organization cannot modify dashboard (404)
    // ------------------------------------------------------------------------
    const crossOrgUpdateRes = await request('PUT', `/api/dashboards/${dashboard1Id}`, {
      title: 'Infiltrated Dashboard'
    }, {
      'Authorization': `Bearer ${userBToken}`
    });

    assert(
      crossOrgUpdateRes.status === 404,
      'Multi-Tenancy: Foreign organization (Org B) cannot update Org A dashboard (404 Isolated)'
    );

    // ------------------------------------------------------------------------
    // Test 15: Multi-tenancy isolation: Foreign organization cannot add widget (404)
    // ------------------------------------------------------------------------
    const crossOrgAddWidgetRes = await request('POST', `/api/dashboards/${dashboard1Id}/widgets`, {
      title: 'Infiltrated Widget',
      type: 'table'
    }, {
      'Authorization': `Bearer ${userBToken}`
    });

    assert(
      crossOrgAddWidgetRes.status === 404,
      'Multi-Tenancy: Foreign organization (Org B) cannot add widget to Org A dashboard (404 Isolated)'
    );

    // ------------------------------------------------------------------------
    // Test 16: Default dashboard handling: Setting is_default updates existing default flags
    // ------------------------------------------------------------------------
    const createDash2Res = await request('POST', '/api/dashboards', {
      title: 'Regional Operations Center',
      description: 'Operations and logistics throughput',
      is_default: true
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    const listDashboardsRes = await request('GET', '/api/dashboards', null, {
      'Authorization': `Bearer ${analystToken}`
    });

    const dash1After = listDashboardsRes.data.dashboards.find(d => d.id === dashboard1Id);
    const dash2After = listDashboardsRes.data.dashboards.find(d => d.id === createDash2Res.data.dashboard.id);

    assert(
      dash2After.is_default === true &&
      dash1After.is_default === false,
      'Default Dashboard: Setting new default dashboard cleanly unsets previous organization default'
    );

    const dashboard2Id = createDash2Res.data.dashboard.id;

    // ------------------------------------------------------------------------
    // Test 17: Validation: Missing title or invalid widget type rejected with 400 Bad Request
    // ------------------------------------------------------------------------
    const invalidDashRes = await request('POST', '/api/dashboards', {
      description: 'Missing title'
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    const invalidWidgetRes = await request('POST', `/api/dashboards/${dashboard2Id}/widgets`, {
      title: 'Bad Widget Type',
      type: 'unknown_chart_xyz'
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    assert(
      invalidDashRes.status === 400 &&
      invalidWidgetRes.status === 400 &&
      invalidDashRes.data.success === false &&
      invalidWidgetRes.data.success === false,
      'Validation: Missing dashboard title and unsupported widget types return 400 Bad Request'
    );

    // ------------------------------------------------------------------------
    // Test 18: Authorized user (admin) can delete dashboard (DELETE /api/dashboards/:id)
    // ------------------------------------------------------------------------
    const viewerDeleteDashRes = await request('DELETE', `/api/dashboards/${dashboard2Id}`, null, {
      'Authorization': `Bearer ${viewerToken}`
    });

    const adminDeleteDashRes = await request('DELETE', `/api/dashboards/${dashboard2Id}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });

    const verifyDeletedDashRes = await request('GET', `/api/dashboards/${dashboard2Id}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });

    assert(
      viewerDeleteDashRes.status === 403 &&
      adminDeleteDashRes.status === 200 &&
      verifyDeletedDashRes.status === 404,
      'Authorized user (admin) deletes custom dashboard with 200 OK (and confirms viewer 403 & 404 removal)'
    );

  } catch (err) {
    console.error('Unexpected test exception:', err);
  } finally {
    console.log('\n====================================================');
    console.log(`  Phase 8 Test Results: ${passed}/${total} Passed`);
    console.log('====================================================\n');

    server.close(() => {
      process.exit(passed === total ? 0 : 1);
    });
  }
}

runPhase8Tests();
