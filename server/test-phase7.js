/**
 * Comprehensive Automated Test Suite for Phase 7: KPI & Metrics Management
 * Tests 13 critical functional, multi-tenant isolation, dynamic calculation, and RBAC requirements:
 * 
 * 1. Unauthenticated request to /api/metrics returns 401 Unauthorized
 * 2. Authenticated user can list metrics (GET /api/metrics)
 * 3. Authorized user (analyst) can create a metric (POST /api/metrics)
 * 4. Viewer role is rejected from creating metric (403 Forbidden)
 * 5. Viewer role is rejected from updating metric (403 Forbidden)
 * 6. Viewer role is rejected from deleting metric (403 Forbidden)
 * 7. Authorized user (manager/admin) can update metric (PUT /api/metrics/:id)
 * 8. Authorized user (admin) can delete metric (DELETE /api/metrics/:id)
 * 9. Multi-tenancy isolation: Cross-organization metric access is blocked (404/Isolated)
 * 10. Input validation: Missing required fields or invalid metric type returns 400 Bad Request
 * 11. Dynamic Evaluation Engine: Evaluates aggregation formulas (SUM, AVG, COUNT, MIN, MAX) on dataset records
 * 12. Target Progress & Status Engine: Accurately calculates target_progress_pct and threshold status (on_track, at_risk, behind)
 * 13. Single Metric Retrieval: GET /api/metrics/:id returns evaluated metric with full metadata
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const UserModel = require('./models/userModel');
const DatasetModel = require('./models/datasetModel');
const MetricModel = require('./models/metricModel');
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

    let postData = null;
    if (body && !headers['Content-Type']?.includes('multipart/form-data')) {
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

    if (body && headers['Content-Type']?.includes('multipart/form-data')) {
      req.write(body);
      req.end();
    } else if (postData) {
      req.write(postData);
      req.end();
    } else {
      req.end();
    }
  });
}

// Multipart helper
function createMultipartPayload(fields, file) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${key}"${crlf}${crlf}` +
      `${val}${crlf}`
    );
  }

  if (file) {
    const header =
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${file.fieldname || 'file'}"; filename="${file.filename}"${crlf}` +
      `Content-Type: ${file.mimetype || 'application/octet-stream'}${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;

    const headerBuf = Buffer.from(header, 'utf-8');
    const contentBuf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf-8');
    const footerBuf = Buffer.from(footer, 'utf-8');

    const fullBody = Buffer.concat([
      ...parts.map(p => Buffer.from(p, 'utf-8')),
      headerBuf,
      contentBuf,
      footerBuf
    ]);

    return {
      contentType: `multipart/form-data; boundary=${boundary}`,
      body: fullBody
    };
  }

  const fullBody = Buffer.concat([
    ...parts.map(p => Buffer.from(p, 'utf-8')),
    Buffer.from(`--${boundary}--${crlf}`, 'utf-8')
  ]);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: fullBody
  };
}

async function runPhase7Tests() {
  console.log('====================================================');
  console.log('  RicozAnalytics Phase 7: KPI & Metrics Test Suite  ');
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
    // Test 1: Unauthenticated request to /api/metrics returns 401
    // ------------------------------------------------------------------------
    const unauthRes = await request('GET', '/api/metrics');
    assert(
      unauthRes.status === 401 && unauthRes.data.success === false,
      'Unauthenticated request to /api/metrics returns 401 Unauthorized'
    );

    // ------------------------------------------------------------------------
    // Setup Test Organizations & Users with distinct RBAC roles
    // ------------------------------------------------------------------------
    const orgARes = await request('POST', '/api/auth/register', {
      name: 'Alice Analyst',
      email: `alice_analyst_${Date.now()}@alpha-corp.test`,
      password: 'Password123!',
      organization_name: 'Alpha Corp Global'
    });
    const orgAId = orgARes.data.user.organization_id;
    const analystUserId = orgARes.data.user.id;

    // Promote Alice to analyst
    await UserModel.updateRole(analystUserId, 'analyst');
    const analystToken = jwt.sign(
      { id: analystUserId, email: orgARes.data.user.email, role: 'analyst', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Create a Viewer in Org A
    const viewerEmail = `victor_viewer_${Date.now()}@alpha-corp.test`;
    const viewerUser = await UserModel.create({
      email: viewerEmail,
      password_hash: 'hashed_pw_test',
      name: 'Victor Viewer',
      role: 'viewer',
      organization_id: orgAId
    });
    const viewerToken = jwt.sign(
      { id: viewerUser.id, email: viewerEmail, role: 'viewer', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Create a Manager in Org A
    const managerEmail = `maria_manager_${Date.now()}@alpha-corp.test`;
    const managerUser = await UserModel.create({
      email: managerEmail,
      password_hash: 'hashed_pw_test',
      name: 'Maria Manager',
      role: 'manager',
      organization_id: orgAId
    });
    const managerToken = jwt.sign(
      { id: managerUser.id, email: managerEmail, role: 'manager', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Create an Admin in Org A
    const adminEmail = `adam_admin_${Date.now()}@alpha-corp.test`;
    const adminUser = await UserModel.create({
      email: adminEmail,
      password_hash: 'hashed_pw_test',
      name: 'Adam Admin',
      role: 'admin',
      organization_id: orgAId
    });
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminEmail, role: 'admin', organization_id: orgAId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Create Org B & User B for multi-tenancy testing
    const orgBRes = await request('POST', '/api/auth/register', {
      name: 'Bob Beta',
      email: `bob_beta_${Date.now()}@beta-industries.test`,
      password: 'Password123!',
      organization_name: 'Beta Industries'
    });
    const orgBId = orgBRes.data.user.organization_id;
    const userBId = orgBRes.data.user.id;
    await UserModel.updateRole(userBId, 'admin');
    const userBToken = jwt.sign(
      { id: userBId, email: orgBRes.data.user.email, role: 'admin', organization_id: orgBId },
      config.jwtSecret,
      { expiresIn: '1d' }
    );

    // Upload a test CSV dataset to Org A for dynamic KPI calculation
    const salesCsv = [
      'transaction_id,region,revenue,cost,units_sold',
      'TX-101,North,15000,9000,15',
      'TX-102,South,25000,12000,25',
      'TX-103,East,10000,6000,10',
      'TX-104,West,30000,15000,30',
      'TX-105,North,20000,11000,20'
    ].join('\n');

    const datasetPayload = createMultipartPayload(
      { name: 'Q1 Enterprise Sales', description: 'Regional sales metrics' },
      { fieldname: 'file', filename: 'q1_sales.csv', mimetype: 'text/csv', content: Buffer.from(salesCsv) }
    );

    const dsUploadRes = await request('POST', '/api/data-sources/upload', datasetPayload.body, {
      'Authorization': `Bearer ${analystToken}`,
      'Content-Type': datasetPayload.contentType,
      'Content-Length': datasetPayload.body.length
    });

    const datasetId = dsUploadRes.data?.data?.dataset?.id || dsUploadRes.data?.dataset?.id || null;

    // ------------------------------------------------------------------------
    // Test 2: Authenticated user can list metrics (GET /api/metrics)
    // ------------------------------------------------------------------------
    const listRes = await request('GET', '/api/metrics', null, {
      'Authorization': `Bearer ${viewerToken}`
    });
    assert(
      listRes.status === 200 &&
      listRes.data.success === true &&
      Array.isArray(listRes.data.metrics),
      'Authenticated user (viewer) can list metrics with 200 OK'
    );

    // ------------------------------------------------------------------------
    // Test 3: Authorized user (analyst) can create a metric (POST /api/metrics)
    // ------------------------------------------------------------------------
    const createRes = await request('POST', '/api/metrics', {
      name: 'Total Revenue Target',
      description: 'Sum of all regional revenue streams',
      formula: 'SUM(revenue)',
      type: 'currency',
      unit: '₹',
      target_value: 120000,
      dataset_id: datasetId,
      formatting: {
        aggregation_type: 'SUM',
        target_column: 'revenue',
        warning_threshold: 80000,
        critical_threshold: 50000
      }
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    assert(
      createRes.status === 201 &&
      createRes.data.success === true &&
      createRes.data.metric.name === 'Total Revenue Target' &&
      createRes.data.metric.formula === 'SUM(revenue)' &&
      createRes.data.metric.organization_id === orgAId,
      'Authorized user (analyst) creates KPI metric with 201 Created and org binding'
    );

    const metricAId = createRes.data.metric.id;

    // ------------------------------------------------------------------------
    // Test 4: Viewer role is rejected from creating metric (403 Forbidden)
    // ------------------------------------------------------------------------
    const viewerCreateRes = await request('POST', '/api/metrics', {
      name: 'Unauthorized Viewer Metric',
      formula: 'COUNT(transaction_id)',
      type: 'number'
    }, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerCreateRes.status === 403 &&
      viewerCreateRes.data.success === false,
      'RBAC: Viewer role is blocked from creating metrics (403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // Test 5: Viewer role is rejected from updating metric (403 Forbidden)
    // ------------------------------------------------------------------------
    const viewerUpdateRes = await request('PUT', `/api/metrics/${metricAId}`, {
      name: 'Hacked Metric Name'
    }, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerUpdateRes.status === 403 &&
      viewerUpdateRes.data.success === false,
      'RBAC: Viewer role is blocked from updating metrics (403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // Test 6: Viewer role is rejected from deleting metric (403 Forbidden)
    // ------------------------------------------------------------------------
    const viewerDeleteRes = await request('DELETE', `/api/metrics/${metricAId}`, null, {
      'Authorization': `Bearer ${viewerToken}`
    });

    assert(
      viewerDeleteRes.status === 403 &&
      viewerDeleteRes.data.success === false,
      'RBAC: Viewer role is blocked from deleting metrics (403 Forbidden)'
    );

    // ------------------------------------------------------------------------
    // Test 7: Authorized user (manager) can update metric (PUT /api/metrics/:id)
    // ------------------------------------------------------------------------
    const managerUpdateRes = await request('PUT', `/api/metrics/${metricAId}`, {
      name: 'Q1 Total Revenue (Updated)',
      target_value: 110000,
      description: 'Revised Q1 regional revenue target'
    }, {
      'Authorization': `Bearer ${managerToken}`
    });

    assert(
      managerUpdateRes.status === 200 &&
      managerUpdateRes.data.success === true &&
      managerUpdateRes.data.metric.name === 'Q1 Total Revenue (Updated)' &&
      Number(managerUpdateRes.data.metric.target_value) === 110000,
      'Authorized user (manager) updates KPI metric target with 200 OK'
    );

    // ------------------------------------------------------------------------
    // Test 8: Multi-tenancy isolation: Cross-organization metric access is blocked
    // ------------------------------------------------------------------------
    const crossOrgGetRes = await request('GET', `/api/metrics/${metricAId}`, null, {
      'Authorization': `Bearer ${userBToken}`
    });

    const crossOrgUpdateRes = await request('PUT', `/api/metrics/${metricAId}`, {
      name: 'Cross Org Intrusion'
    }, {
      'Authorization': `Bearer ${userBToken}`
    });

    const crossOrgDeleteRes = await request('DELETE', `/api/metrics/${metricAId}`, null, {
      'Authorization': `Bearer ${userBToken}`
    });

    assert(
      crossOrgGetRes.status === 404 &&
      crossOrgUpdateRes.status === 404 &&
      crossOrgDeleteRes.status === 404,
      'Multi-tenancy: Foreign organization (Org B) cannot view, update, or delete Org A metrics (404 Isolated)'
    );

    // ------------------------------------------------------------------------
    // Test 9: Input validation: Missing required fields or invalid metric type returns 400
    // ------------------------------------------------------------------------
    const invalidPayloadRes1 = await request('POST', '/api/metrics', {
      description: 'Missing name and formula'
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    const invalidPayloadRes2 = await request('POST', '/api/metrics', {
      name: 'Invalid Type Metric',
      formula: 'SUM(revenue)',
      type: 'unsupported_type_xyz'
    }, {
      'Authorization': `Bearer ${analystToken}`
    });

    assert(
      invalidPayloadRes1.status === 400 &&
      invalidPayloadRes2.status === 400 &&
      invalidPayloadRes1.data.success === false &&
      invalidPayloadRes2.data.success === false,
      'Validation: Missing required fields and unsupported types return 400 Bad Request'
    );

    // ------------------------------------------------------------------------
    // Test 10: Dynamic Evaluation Engine: Evaluates aggregation formulas on dataset records
    // ------------------------------------------------------------------------
    // Dataset values: [15000, 25000, 10000, 30000, 20000] => SUM = 100000
    const evalListRes = await request('GET', '/api/metrics', null, {
      'Authorization': `Bearer ${analystToken}`
    });

    const evaluatedMetric = evalListRes.data.metrics.find(m => m.id === metricAId);

    assert(
      Boolean(evaluatedMetric) &&
      evaluatedMetric.current_value === 100000,
      'Dynamic Evaluation: SUM(revenue) correctly computed as 100,000 from 5 dataset rows'
    );

    // ------------------------------------------------------------------------
    // Test 11: Target Progress & Status Engine
    // ------------------------------------------------------------------------
    // Current value = 100000, Target = 110000 => Progress = (100000 / 110000) * 100 = 90.91% => on_track (>80%)
    assert(
      evaluatedMetric &&
      Math.abs(evaluatedMetric.target_progress_pct - 90.91) < 0.1 &&
      evaluatedMetric.status === 'on_track',
      'Target Progress Engine: Accurately computed 90.91% progress with "on_track" status'
    );

    // ------------------------------------------------------------------------
    // Test 12: Single Metric Retrieval: GET /api/metrics/:id returns evaluated metric
    // ------------------------------------------------------------------------
    const singleGetRes = await request('GET', `/api/metrics/${metricAId}`, null, {
      'Authorization': `Bearer ${analystToken}`
    });

    assert(
      singleGetRes.status === 200 &&
      singleGetRes.data.success === true &&
      singleGetRes.data.metric.id === metricAId &&
      singleGetRes.data.metric.current_value === 100000 &&
      singleGetRes.data.metric.status === 'on_track',
      'GET /api/metrics/:id returns single evaluated KPI metric with real-time analytics'
    );

    // ------------------------------------------------------------------------
    // Test 13: Authorized user (admin) can delete metric (DELETE /api/metrics/:id)
    // ------------------------------------------------------------------------
    const adminDeleteRes = await request('DELETE', `/api/metrics/${metricAId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });

    const verifyDeletedRes = await request('GET', `/api/metrics/${metricAId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });

    assert(
      adminDeleteRes.status === 200 &&
      adminDeleteRes.data.success === true &&
      verifyDeletedRes.status === 404,
      'Authorized user (admin) deletes KPI metric with 200 OK and confirms removal (404)'
    );

  } catch (err) {
    console.error('Unexpected test exception:', err);
  } finally {
    console.log('\n====================================================');
    console.log(`  Phase 7 Test Results: ${passed}/${total} Passed`);
    console.log('====================================================\n');

    server.close(() => {
      process.exit(passed === total ? 0 : 1);
    });
  }
}

runPhase7Tests();
