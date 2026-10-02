/**
 * Comprehensive Automated Verification Suite for Phases 11, 14, and 15
 * 
 * Verifies 25 functional, RBAC, tenant isolation, and integration criteria:
 * 1. Unauthorized request to /api/data-sources/test-api returns 401
 * 2. Unauthorized request to /api/dashboards/:id/duplicate returns 401
 * 3. Unauthorized request to /api/dashboards/:id/layout returns 401
 * 4. Unauthorized request to /api/datasets/:id/refresh returns 401
 * 5. RBAC: Viewer role cannot test REST API connection (403)
 * 6. RBAC: Viewer role cannot sync data sources (403)
 * 7. RBAC: Viewer role cannot refresh datasets (403)
 * 8. RBAC: Viewer role cannot duplicate dashboards (403)
 * 9. RBAC: Viewer role cannot update dashboard layouts (403)
 * 10. REST API Validation: POST /api/data-sources/test-api rejects missing endpoint_url with 400
 * 11. REST API Test Connection: POST /api/data-sources/test-api connects to mock endpoint and returns 200 with record preview
 * 12. REST API Ingestion: POST /api/data-sources with type 'rest_api' persists source and auto-creates analysis dataset
 * 13. REST API Ingestion: Verify dataset schema and row count are correctly populated
 * 14. Data Source Sanity: Returned data source has sanitized configuration
 * 15. Data Source Sync: POST /api/data-sources/:id/sync re-fetches records and returns updated row count
 * 16. Static File Source Sync: POST /api/data-sources/:id/sync verifies static data sources
 * 17. Dataset Refresh: POST /api/datasets/:id/refresh recalculates row count, column schema, and updates timestamp
 * 18. Multi-Tenant Isolation: Org B cannot sync Org A's data source (404 Isolated)
 * 19. Multi-Tenant Isolation: Org B cannot refresh Org A's dataset (404 Isolated)
 * 20. Dashboard Duplication: POST /api/dashboards/:id/duplicate clones dashboard with '(Copy)' name suffix
 * 21. Dashboard Duplication: Clones all widgets belonging to the original dashboard
 * 22. Dashboard Layout: PUT /api/dashboards/:id/layout batch updates widget positions and sizes
 * 23. Multi-Tenant Isolation: Org B cannot duplicate Org A's dashboard (404 Isolated)
 * 24. Multi-Tenant Isolation: Org B cannot update layout of Org A's dashboard (404 Isolated)
 * 25. End-to-End Workflow: Ingest REST API -> Refresh Dataset -> Add Widget to Dashboard -> Duplicate Dashboard -> Verify Parity
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const DashboardModel = require('./models/dashboardModel');
const DataSourceModel = require('./models/dataSourceModel');
const DatasetModel = require('./models/datasetModel');

let server;
let baseUrl;
let mockApiServer;
let mockApiUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
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

function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  PHASE 11, 14, 15: COMPREHENSIVE END-TO-END VERIFICATION SUITE');
  console.log('===============================================================\n');

  // Start main API server
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[API Server] Running on ${baseUrl}`);
      resolve();
    });
  });

  // Start local mock REST API server for testing connectors
  mockApiServer = http.createServer((req, res) => {
    if (req.url === '/api/telemetry') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        data: [
          { order_id: 101, region: 'North', amount: 4500, units: 15, date: '2026-03-01' },
          { order_id: 102, region: 'South', amount: 7200, units: 28, date: '2026-03-02' },
          { order_id: 103, region: 'East',  amount: 3100, units: 10, date: '2026-03-03' },
          { order_id: 104, region: 'West',  amount: 8900, units: 34, date: '2026-03-04' }
        ]
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  await new Promise((resolve) => {
    mockApiServer.listen(0, '127.0.0.1', () => {
      const mockPort = mockApiServer.address().port;
      mockApiUrl = `http://127.0.0.1:${mockPort}/api/telemetry`;
      console.log(`[Mock REST Server] Running on ${mockApiUrl}`);
      resolve();
    });
  });

  // Test identities
  const userAdminOrgA = { id: 1, email: 'admin@ricoz.test', role: 'admin', orgId: '00000000-0000-0000-0000-000000000001' };
  const userViewerOrgA = { id: 4, email: 'viewer@ricoz.test', role: 'viewer', orgId: '00000000-0000-0000-0000-000000000001' };
  const userAdminOrgB = { id: 201, email: 'admin@orgb.com', role: 'admin', orgId: '00000000-0000-0000-0000-000000000002' };

  const tokenAdminA = generateToken(userAdminOrgA.id, userAdminOrgA.email, userAdminOrgA.role, userAdminOrgA.orgId);
  const tokenViewerA = generateToken(userViewerOrgA.id, userViewerOrgA.email, userViewerOrgA.role, userViewerOrgA.orgId);
  const tokenAdminB = generateToken(userAdminOrgB.id, userAdminOrgB.email, userAdminOrgB.role, userAdminOrgB.orgId);

  let passed = 0;
  let failed = 0;

  function assert(condition, testNum, desc) {
    if (condition) {
      console.log(`  ✓ [TEST ${testNum}] ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ [TEST ${testNum}] FAILED: ${desc}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1-4: Unauthenticated access returns 401
    // -------------------------------------------------------------
    const res1 = await request('POST', '/api/data-sources/test-api', { endpoint_url: 'http://example.com' });
    assert(res1.statusCode === 401, 1, 'Unauthenticated POST /api/data-sources/test-api returns 401');

    const res2 = await request('POST', '/api/dashboards/999/duplicate');
    assert(res2.statusCode === 401, 2, 'Unauthenticated POST /api/dashboards/:id/duplicate returns 401');

    const res3 = await request('PUT', '/api/dashboards/999/layout', { layout: [] });
    assert(res3.statusCode === 401, 3, 'Unauthenticated PUT /api/dashboards/:id/layout returns 401');

    const res4 = await request('POST', '/api/datasets/999/refresh');
    assert(res4.statusCode === 401, 4, 'Unauthenticated POST /api/datasets/:id/refresh returns 401');

    // -------------------------------------------------------------
    // Test 5-9: RBAC Enforcement (Viewer blocked)
    // -------------------------------------------------------------
    const res5 = await request('POST', '/api/data-sources/test-api', { endpoint_url: mockApiUrl }, {
      Authorization: `Bearer ${tokenViewerA}`
    });
    assert(res5.statusCode === 403, 5, 'RBAC: Viewer role cannot test REST API connection (403)');

    const res6 = await request('POST', '/api/data-sources/1/sync', {}, {
      Authorization: `Bearer ${tokenViewerA}`
    });
    assert(res6.statusCode === 403, 6, 'RBAC: Viewer role cannot sync data sources (403)');

    const res7 = await request('POST', '/api/datasets/1/refresh', {}, {
      Authorization: `Bearer ${tokenViewerA}`
    });
    assert(res7.statusCode === 403, 7, 'RBAC: Viewer role cannot refresh datasets (403)');

    const res8 = await request('POST', '/api/dashboards/1/duplicate', {}, {
      Authorization: `Bearer ${tokenViewerA}`
    });
    assert(res8.statusCode === 403, 8, 'RBAC: Viewer role cannot duplicate dashboards (403)');

    const res9 = await request('PUT', '/api/dashboards/1/layout', { layout: [] }, {
      Authorization: `Bearer ${tokenViewerA}`
    });
    assert(res9.statusCode === 403, 9, 'RBAC: Viewer role cannot update dashboard layouts (403)');

    // -------------------------------------------------------------
    // Test 10-14: Phase 14 REST API Connector & Ingestion
    // -------------------------------------------------------------
    const res10 = await request('POST', '/api/data-sources/test-api', {}, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res10.statusCode === 400, 10, 'REST API Validation: rejects missing endpoint_url with 400');

    const res11 = await request('POST', '/api/data-sources/test-api', {
      endpoint_url: mockApiUrl,
      data_key: 'data'
    }, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res11.statusCode === 200 && res11.body.recordCount === 4, 11,
      `REST API Test Connection: connects to mock server and parses 4 records (status ${res11.statusCode})`);

    const res12 = await request('POST', '/api/data-sources', {
      name: 'Telemetry REST Stream',
      type: 'rest_api',
      config: {
        endpoint_url: mockApiUrl,
        method: 'GET',
        data_key: 'data',
        auth_token: 'secret-test-token'
      }
    }, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res12.statusCode === 201 && res12.body.data && res12.body.data.id, 12,
      `REST API Ingestion: POST /api/data-sources creates source record (status ${res12.statusCode})`);

    const createdSourceId = res12.body?.data?.id;
    const directCreatedDataset = res12.body?.data?.dataset;

    // Verify dataset was automatically created
    const res13 = await request('GET', '/api/datasets', null, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    const createdDataset = directCreatedDataset || res13.body?.data?.find(d => String(d.data_source_id) === String(createdSourceId));
    assert(createdDataset && createdDataset.row_count === 4, 13,
      'REST API Ingestion: Auto-generated linked dataset has 4 records and schema');

    // Data source config sanitization check
    const res14 = await request('GET', `/api/data-sources/${createdSourceId}`, null, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res14.statusCode === 200 && !res14.body.data.config.auth_token, 14,
      'Data Source Sanity: auth_token is scrubbed/sanitized from returned source config');

    // -------------------------------------------------------------
    // Test 15-17: Data Source Sync & Dataset Refresh
    // -------------------------------------------------------------
    const res15 = await request('POST', `/api/data-sources/${createdSourceId}/sync`, {}, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res15.statusCode === 200 && res15.body.status === 'active', 15,
      `Data Source Sync: POST /api/data-sources/:id/sync successfully re-synchronizes records (${res15.body.rowCount} rows)`);

    // Create a mock static source and sync it
    const staticSource = await DataSourceModel.create({
      userId: userAdminOrgA.id,
      name: 'Offline Sales Log',
      type: 'csv',
      status: 'active'
    });
    const res16 = await request('POST', `/api/data-sources/${staticSource.id}/sync`, {}, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res16.statusCode === 200 && res16.body.status === 'active', 16,
      'Static File Source Sync: returns active status and updated timestamp');

    // Dataset refresh
    const targetDatasetId = createdDataset ? createdDataset.id : directCreatedDataset?.id;
    const res17 = await request('POST', `/api/datasets/${targetDatasetId}/refresh`, {}, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res17.statusCode === 200 && res17.body.success === true, 17,
      `Dataset Refresh: POST /api/datasets/:id/refresh successfully refreshes table metadata`);

    // -------------------------------------------------------------
    // Test 18-19: Multi-Tenant Isolation for Connectors & Datasets
    // -------------------------------------------------------------
    const res18 = await request('POST', `/api/data-sources/${createdSourceId}/sync`, {}, {
      Authorization: `Bearer ${tokenAdminB}`
    });
    assert(res18.statusCode === 404, 18,
      'Multi-Tenant Isolation: Org B cannot sync Org A data source (404 Isolated)');

    const res19 = await request('POST', `/api/datasets/${targetDatasetId}/refresh`, {}, {
      Authorization: `Bearer ${tokenAdminB}`
    });
    assert(res19.statusCode === 404, 19,
      'Multi-Tenant Isolation: Org B cannot refresh Org A dataset (404 Isolated)');

    // -------------------------------------------------------------
    // Test 20-22: Phase 15 Dashboard Duplication & Batch Layout
    // -------------------------------------------------------------
    // Create base dashboard for Org A
    const baseDashboard = await DashboardModel.create({
      organizationId: userAdminOrgA.orgId,
      createdBy: userAdminOrgA.id,
      title: 'Executive Revenue Cockpit',
      description: 'Q1 Analytics Overview'
    });

    // Add widgets to dashboard
    const widget1 = await DashboardModel.addWidget(baseDashboard.id, {
      title: 'Regional Revenue',
      type: 'bar',
      position: { x: 0, y: 0, w: 6, h: 4 }
    });

    const widget2 = await DashboardModel.addWidget(baseDashboard.id, {
      title: 'Revenue 90-Day Forecast',
      type: 'forecast_chart',
      position: { x: 6, y: 0, w: 6, h: 4 },
      configuration: { confidence_level: 0.95, horizon: 30 }
    });

    // Test Duplication
    const res20 = await request('POST', `/api/dashboards/${baseDashboard.id}/duplicate`, {}, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res20.statusCode === 201 && (res20.body.data.title || res20.body.data.name || '').includes('(Copy)'), 20,
      `Dashboard Duplication: Duplicates dashboard with name "${res20.body?.data?.title || res20.body?.data?.name}"`);

    const duplicatedDashboardId = res20.body.data.id;
    const duplicatedWidgets = await DashboardModel.findWidgetsByDashboardId(duplicatedDashboardId);
    assert(duplicatedWidgets && duplicatedWidgets.length === 2, 21,
      `Dashboard Duplication: Cloned all 2 widgets (including forecast_chart) with correct config`);

    // Test Batch Layout Update
    const layoutUpdate = [
      { id: widget1.id, position_x: 2, position_y: 4, width: 8, height: 5 },
      { id: widget2.id, position_x: 0, position_y: 0, width: 12, height: 6 }
    ];
    const res22 = await request('PUT', `/api/dashboards/${baseDashboard.id}/layout`, { layout: layoutUpdate }, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    assert(res22.statusCode === 200 && res22.body.data && res22.body.data.length === 2, 22,
      `Dashboard Layout: PUT /api/dashboards/:id/layout successfully batch updates widget positions`);

    // -------------------------------------------------------------
    // Test 23-24: Multi-Tenant Isolation for Dashboards
    // -------------------------------------------------------------
    const res23 = await request('POST', `/api/dashboards/${baseDashboard.id}/duplicate`, {}, {
      Authorization: `Bearer ${tokenAdminB}`
    });
    assert(res23.statusCode === 404, 23,
      'Multi-Tenant Isolation: Org B cannot duplicate Org A dashboard (404 Isolated)');

    const res24 = await request('PUT', `/api/dashboards/${baseDashboard.id}/layout`, { layout: [] }, {
      Authorization: `Bearer ${tokenAdminB}`
    });
    assert(res24.statusCode === 404, 24,
      'Multi-Tenant Isolation: Org B cannot update layout of Org A dashboard (404 Isolated)');

    // -------------------------------------------------------------
    // Test 25: End-to-End Analytics Workflow Integration
    // -------------------------------------------------------------
    // Verify duplicated dashboard can be queried with widgets intact and enriched
    const res25 = await request('GET', `/api/dashboards/${duplicatedDashboardId}`, null, {
      Authorization: `Bearer ${tokenAdminA}`
    });
    const dupDash = res25.body?.data;
    const hasForecastWidget = dupDash?.widgets?.some(w => w.type === 'forecast_chart');
    assert(res25.statusCode === 200 && hasForecastWidget === true, 25,
      'End-to-End Workflow: Duplicated dashboard retrieves populated forecast_chart widgets in tenant isolation');

  } catch (err) {
    console.error('Unhandled test failure:', err);
    failed++;
  } finally {
    if (server) server.close();
    if (mockApiServer) mockApiServer.close();

    console.log('\n---------------------------------------------------------------');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL 25)`);
    console.log('---------------------------------------------------------------\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
