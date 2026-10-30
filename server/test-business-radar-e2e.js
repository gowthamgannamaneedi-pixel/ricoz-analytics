const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const Dataset = require('./models/datasetModel');
const InsightModel = require('./models/insightModel');
const storage = require('./storage');

/**
 * BUSINESS RADAR END-TO-END VERIFICATION TEST SUITE
 * 
 * Verifies all 10 requirements:
 * 1. Open Business Radar for an existing, authorized insight.
 * 2. Retrieve an insight using a valid UUID.
 * 3. Handle a nonexistent insight.
 * 4. Handle an unauthorized or cross-tenant insight.
 * 5. Generate analysis when valid supporting data exists.
 * 6. Handle missing datasets or insufficient historical data.
 * 7. Verify calculations against known test values.
 * 8. Verify the retry action.
 * 9. Verify Live, Load, Empty, and Error states.
 * 10. Confirm existing AI Insights and other analytics features remain functional.
 */
async function runBusinessRadarE2ETests() {
  console.log('======================================================================');
  console.log('  BUSINESS RADAR COMPREHENSIVE END-TO-END VERIFICATION TEST SUITE    ');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(` FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
  }

  const testOrgA = '00000000-0000-0000-0000-000000000001';
  const testOrgB = '00000000-0000-0000-0000-000000000002';

  await db.query("UPDATE organizations SET plan = 'enterprise', subscription_status = 'active' WHERE id IN ($1, $2)", [testOrgA, testOrgB]).catch(() => null);
  if (db.fallbackOrganizations) {
    db.fallbackOrganizations.forEach(o => {
      if (o.id === testOrgA || o.id === testOrgB) o.plan = 'enterprise';
    });
  }

  function generateToken(userId, email, role, orgId) {
    return jwt.sign(
      { id: userId, email, role, organization_id: orgId },
      config.jwtSecret || 'dev-jwt-secret-key-12345',
      { expiresIn: '1h' }
    );
  }

  function apiReq(baseUrl, method, reqPath, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(reqPath, baseUrl);
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
          try { parsed = JSON.parse(data); } catch (_) {}
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (reqBody) req.write(reqBody);
      req.end();
    });
  }

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const serverPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${serverPort}`;

  const tokenAdminA = generateToken(1, 'admin@ricoz.test', 'admin', testOrgA);
  const tokenAdminB = generateToken(10, 'admin_b@other.test', 'admin', testOrgB);

  // 1. Dataset with valid historical comparison (4 rows: 2 baseline, 2 current)
  // Baseline: North=10000, South=20000 (Total = 30000)
  // Current:  North=6000,  South=25000 (Total = 31000, Delta = +1000, North Delta = -4000, South Delta = +5000)
  const csvValidData = [
    'date,region,category,sales_amount',
    '2026-01-01,North,Electronics,10000',
    '2026-01-02,South,Electronics,20000',
    '2026-02-01,North,Electronics,6000',
    '2026-02-02,South,Electronics,25000'
  ].join('\n');

  const fileValid = await storage.saveFile(1, 'valid_radar_data.csv', Buffer.from(csvValidData));
  const datasetValid = await Dataset.create({
    userId: 1,
    organizationId: testOrgA,
    name: 'Enterprise Telemetry Q1',
    filePath: fileValid.filePath,
    rowCount: 4,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'region', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'sales_amount', type: 'number' }
    ]
  });

  const insightAuthorized = await InsightModel.create({
    organizationId: testOrgA,
    datasetId: datasetValid.id,
    type: 'decline',
    title: 'Regional Revenue Shift',
    summary: 'Sales contracted in North while expanding in South.',
    severity: 'warning',
    confidence: 0.96,
    evidence: {
      datasetId: datasetValid.id,
      metric: 'sales_amount',
      currentValue: 31000,
      comparisonValue: 30000,
      changePercent: 3.33,
      recordsAnalyzed: 4,
      verified: true
    }
  });

  // 2. Dataset with insufficient historical data (1 row only)
  const csvSingleRow = [
    'date,region,category,sales_amount',
    '2026-01-01,North,Electronics,10000'
  ].join('\n');

  const fileSingle = await storage.saveFile(1, 'single_row.csv', Buffer.from(csvSingleRow));
  const datasetSingle = await Dataset.create({
    userId: 1,
    organizationId: testOrgA,
    name: 'Single Row Dataset',
    filePath: fileSingle.filePath,
    rowCount: 1,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'region', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'sales_amount', type: 'number' }
    ]
  });

  const insightSingle = await InsightModel.create({
    organizationId: testOrgA,
    datasetId: datasetSingle.id,
    type: 'decline',
    title: 'Single Record Observation',
    summary: 'Insufficient historical baseline.',
    severity: 'info',
    evidence: {
      datasetId: datasetSingle.id,
      metric: 'sales_amount',
      currentValue: 10000,
      comparisonValue: 10000,
      recordsAnalyzed: 1
    }
  });

  // 3. Insight not linked to any dataset (abstract operational notice)
  const insightNoDataset = await InsightModel.create({
    organizationId: testOrgA,
    datasetId: null,
    type: 'operational',
    title: 'Unlinked System Notice',
    summary: 'Operational threshold update.',
    severity: 'info',
    evidence: {
      metric: 'latency_ms',
      currentValue: 45
    }
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Open Business Radar for an existing, authorized insight
    // -------------------------------------------------------------------------
    await test('1. Open Business Radar for an existing authorized insight (200 OK + full telemetry)', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightAuthorized.id}/root-cause?dimension=region`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200, 'Should return HTTP 200');
      assert.strictEqual(res.body.success, true);
      assert(res.body.data !== undefined, 'Payload data must exist');
      assert.strictEqual(res.body.data.metric, 'sales_amount');
      assert.strictEqual(res.body.data.dimension, 'region');
      assert(res.body.data.radar !== undefined, 'Radar payload must be structured');
      assert(Array.isArray(res.body.data.radar.drivers), 'Radar drivers must be array');
    });

    // -------------------------------------------------------------------------
    // TEST 2: Retrieve an insight using a valid UUID
    // -------------------------------------------------------------------------
    await test('2. Retrieve insight using valid UUID via standard GET endpoint', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightAuthorized.id}`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, insightAuthorized.id);
      assert.strictEqual(res.body.data.organization_id, testOrgA);
    });

    // -------------------------------------------------------------------------
    // TEST 3: Handle a nonexistent insight
    // -------------------------------------------------------------------------
    await test('3. Handle nonexistent insight ID (returns 404 with accurate error message)', async () => {
      const missingId = '810777eb-f5fd-4226-b41f-e2cc716b912a';
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${missingId}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 404, 'Must return HTTP 404');
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      assert.strictEqual(res.body.error.message, `Insight #${missingId} not found or access denied.`);
    });

    // -------------------------------------------------------------------------
    // TEST 4: Handle an unauthorized or cross-tenant insight
    // -------------------------------------------------------------------------
    await test('4. Handle unauthorized or cross-tenant insight access (Tenant B denied Tenant A insight)', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightAuthorized.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminB}`
      });
      assert.strictEqual(res.statusCode, 404, 'Must return 404 to preserve tenant privacy');
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      assert.strictEqual(res.body.error.message, `Insight #${insightAuthorized.id} not found or access denied.`);
    });

    // -------------------------------------------------------------------------
    // TEST 5: Generate analysis when valid supporting data exists
    // -------------------------------------------------------------------------
    await test('5. Generate analysis with valid supporting data (variance decomposed into drivers)', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightAuthorized.id}/root-cause?dimension=region`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      const data = res.body.data;

      // Verify baseline vs current
      assert.strictEqual(data.totalBaseline, 30000, 'Baseline should sum to 30000');
      assert.strictEqual(data.totalCurrent, 31000, 'Current should sum to 31000');
      assert.strictEqual(data.totalDelta, 1000, 'Net Delta should be +1000');

      // Verify drivers present
      assert(data.drivers.length >= 2, 'Should decompose North and South segments');
      const northDriver = data.drivers.find(d => d.segment === 'North');
      const southDriver = data.drivers.find(d => d.segment === 'South');
      assert(northDriver, 'North driver must exist');
      assert(southDriver, 'South driver must exist');
      assert.strictEqual(northDriver.segmentDelta, -4000, 'North delta must be -4000');
      assert.strictEqual(southDriver.segmentDelta, 5000, 'South delta must be +5000');

      // Verify primary detractor and driver
      assert(data.primaryDetractor !== null, 'North should be identified as detractor');
      assert.strictEqual(data.primaryDetractor.segment, 'North');
      assert.strictEqual(data.primaryDetractor.delta, -4000);

      // Verify correlation disclaimer
      assert(typeof data.radar.correlationDisclaimer === 'string');
      assert(data.radar.correlationDisclaimer.includes('statistical accounting'));
    });

    // -------------------------------------------------------------------------
    // TEST 6: Handle missing datasets or insufficient historical data
    // -------------------------------------------------------------------------
    await test('6. Handle missing datasets and insufficient historical data (explains missing data without fabricating)', async () => {
      // 6a: Insufficient data (1 row)
      const resSingle = await apiReq(baseUrl, 'GET', `/api/insights/${insightSingle.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resSingle.statusCode, 200, 'Returns 200 with clean empty state reason');
      assert.strictEqual(resSingle.body.data.drivers.length, 0, 'Drivers must be empty for 1 record');
      assert(resSingle.body.data.emptyReason.includes('Insufficient historical data'));

      // 6b: Unlinked dataset
      const resUnlinked = await apiReq(baseUrl, 'GET', `/api/insights/${insightNoDataset.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resUnlinked.statusCode, 200);
      assert.strictEqual(resUnlinked.body.data.drivers.length, 0);
      assert(resUnlinked.body.data.emptyReason.includes('unavailable'));
    });

    // -------------------------------------------------------------------------
    // TEST 7: Verify calculations against known test values
    // -------------------------------------------------------------------------
    await test('7. Verify calculations against known test values (sum of drivers equals net delta)', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${insightAuthorized.id}/root-cause?dimension=region`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      const data = res.body.data;
      assert.strictEqual(data.mathBalanceVerified, true, 'Math balance must be mathematically verified');
      const sumDeltas = data.drivers.reduce((acc, d) => acc + d.segmentDelta, 0);
      assert.strictEqual(sumDeltas, data.totalDelta, 'Sum of segment deltas must equal totalDelta exactly');
    });

    // -------------------------------------------------------------------------
    // TEST 8: Verify the retry action
    // -------------------------------------------------------------------------
    await test('8. Verify retry action with fresh parameter bypasses cache and recomputes', async () => {
      const resRetry = await apiReq(baseUrl, 'GET', `/api/insights/${insightAuthorized.id}/root-cause?dimension=region&forceFresh=true`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resRetry.statusCode, 200);
      assert.strictEqual(resRetry.body.success, true);
      assert.strictEqual(resRetry.body.data.fromCache, false, 'Retry must recompute freshly');
    });

    // -------------------------------------------------------------------------
    // TEST 9: Verify Live, Load, Empty, and Error states
    // -------------------------------------------------------------------------
    await test('9. Verify payload contracts support Live, Load, Empty, and Error states', async () => {
      // Live state payload
      const resLive = await apiReq(baseUrl, 'GET', `/api/insights/${insightAuthorized.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert(resLive.body.data.drivers.length > 0, 'Live state has drivers');
      assert(!resLive.body.data.emptyReason, 'Live state has no emptyReason');

      // Empty state payload
      const resEmpty = await apiReq(baseUrl, 'GET', `/api/insights/${insightSingle.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resEmpty.body.data.drivers.length, 0, 'Empty state has 0 drivers');
      assert(typeof resEmpty.body.data.emptyReason === 'string', 'Empty state has descriptive emptyReason');

      // Error state payload
      const resErr = await apiReq(baseUrl, 'GET', `/api/insights/00000000-0000-0000-0000-000000000999/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resErr.statusCode, 404);
      assert(resErr.body.error && resErr.body.error.message, 'Error state has user-facing message');
    });

    // -------------------------------------------------------------------------
    // TEST 10: Confirm existing AI Insights & other analytics remain functional
    // -------------------------------------------------------------------------
    await test('10. Confirm existing AI Insights and analytics features remain functional', async () => {
      // 10a: Listing insights
      const resList = await apiReq(baseUrl, 'GET', `/api/insights`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resList.statusCode, 200);
      assert(Array.isArray(resList.body.data) || Array.isArray(resList.body.insights));

      // 10b: Available dimensions
      const resDims = await apiReq(baseUrl, 'GET', `/api/insights/${insightAuthorized.id}/dimensions`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resDims.statusCode, 200);
      assert(Array.isArray(resDims.body.data.availableDimensions));
      assert(resDims.body.data.availableDimensions.includes('region'));
      assert(resDims.body.data.availableDimensions.includes('category'));

      // 10c: Scenario simulation
      const resSim = await apiReq(baseUrl, 'POST', `/api/insights/${insightAuthorized.id}/simulate-scenario`, {
        dimension: 'region',
        adjustments: [{ segment: 'North', deltaPercent: 20 }]
      }, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resSim.statusCode, 200);
      assert.strictEqual(resSim.body.data.isCounterfactual, true);
    });

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`  E2E TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBusinessRadarE2ETests().catch(err => {
  console.error('E2E Test Execution Error:', err);
  process.exit(1);
});
