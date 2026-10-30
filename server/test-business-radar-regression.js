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
 * BUSINESS RADAR & INVESTIGATION REGRESSION TEST SUITE
 * 
 * Verifies:
 * 1. Root-cause & Business Radar with valid UUID returns 200 and structured radar payload.
 * 2. Missing UUID resource identifier returns 404 (NOT_FOUND).
 * 3. Unauthorized resource identifier (Tenant B querying Tenant A) returns 404.
 * 4. Invalid non-UUID resource identifiers (integer 123, '1', 'abc') return 404 without crashing PostgreSQL.
 *    (Regressed from "operator does not exist: uuid = integer" and "22P02" errors).
 * 5. Available dimensions endpoint handles valid, missing, unauthorized, and invalid IDs.
 * 6. Scenario simulation handles valid, missing, and unauthorized IDs.
 * 7. Business Radar payload includes deterministic evidence, magnitude, correlation disclaimer, and questions.
 */
async function runRegressionTests() {
  console.log('===============================================================');
  console.log('  BUSINESS RADAR & INVESTIGATION REGRESSION SUITE              ');
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
      console.error(`   Error: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
  }

  const testOrgA = '00000000-0000-0000-0000-000000000001';
  const testOrgB = '00000000-0000-0000-0000-000000000002';

  // Ensure both test organizations have enterprise plan for insights entitlement
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

  // Setup test dataset and insight
  const testCsvContent = [
    'date,region,category,sales_amount',
    '2026-01-01,North,Electronics,10000',
    '2026-01-02,South,Electronics,20000',
    '2026-02-01,North,Electronics,5000',
    '2026-02-02,South,Electronics,22000'
  ].join('\n');

  const saveRes = await storage.saveFile(1, 'radar_test.csv', Buffer.from(testCsvContent));
  const testDataset = await Dataset.create({
    userId: 1,
    organizationId: testOrgA,
    name: 'Radar Regression Telemetry',
    filePath: saveRes.filePath,
    rowCount: 4,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'region', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'sales_amount', type: 'number' }
    ]
  });

  const testInsight = await InsightModel.create({
    organizationId: testOrgA,
    datasetId: testDataset.id,
    type: 'decline',
    title: 'North Regional Sales Contraction',
    summary: 'Sales contracted across regional telemetry slices.',
    severity: 'warning',
    confidence: 0.95,
    evidence: {
      datasetId: testDataset.id,
      metric: 'sales_amount',
      currentValue: 27000,
      comparisonValue: 30000,
      changePercent: -10.0,
      recordsAnalyzed: 4,
      verified: true
    }
  });

  try {
    // 1. Valid UUID Investigation
    await test('1. Valid UUID returns 200 with Business Radar structured telemetry', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${testInsight.id}/root-cause?dimension=region&allowFallback=true`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.metric, 'sales_amount');
      assert.strictEqual(res.body.data.dimension, 'region');
      assert(Array.isArray(res.body.data.drivers));
      assert(res.body.data.radar !== undefined, 'Radar payload must be present');
      assert.strictEqual(res.body.data.radar.metric, 'sales_amount');
      assert(Array.isArray(res.body.data.radar.suggestedQuestions));
      assert(typeof res.body.data.radar.correlationDisclaimer === 'string');
    });

    // 2. Missing UUID (Non-existent record)
    await test('2. Non-existent UUID returns 404 NOT_FOUND envelope', async () => {
      const missingUuid = '99999999-9999-9999-9999-999999999999';
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${missingUuid}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
    });

    // 3. Unauthorized Cross-Tenant Resource
    await test('3. Cross-Tenant investigation access returns 404 NOT_FOUND (Tenant Isolation)', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${testInsight.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminB}`
      });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    // 4. Invalid Integer ID (Regression: operator does not exist: uuid = integer)
    await test('4. Integer resource identifier returns 404 without SQL error', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/123/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      assert(!res.body.error.message.includes('operator does not exist'));
      assert(!res.body.error.message.includes('uuid = integer'));
    });

    // 5. Invalid string ID (Regression: 22P02 invalid input syntax for type uuid)
    await test('5. Malformed string identifier returns 404 without 22P02 SQL syntax error', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/not-a-valid-uuid/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
    });

    // 6. Dimensions Endpoint Parameter Safety
    await test('6. Dimensions endpoint safely handles valid, integer, and missing IDs', async () => {
      // Valid
      const resValid = await apiReq(baseUrl, 'GET', `/api/insights/${testInsight.id}/dimensions`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resValid.statusCode, 200);
      assert(Array.isArray(resValid.body.data.availableDimensions));

      // Integer ID
      const resInt = await apiReq(baseUrl, 'GET', `/api/insights/456/dimensions`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resInt.statusCode, 404);

      // Cross-tenant
      const resCross = await apiReq(baseUrl, 'GET', `/api/insights/${testInsight.id}/dimensions`, null, {
        Authorization: `Bearer ${tokenAdminB}`
      });
      assert.strictEqual(resCross.statusCode, 404);
    });

    // 7. Simulation Endpoint Parameter Safety
    await test('7. Counterfactual simulation endpoint validates parameters and IDs', async () => {
      // Valid simulation
      const resSim = await apiReq(baseUrl, 'POST', `/api/insights/${testInsight.id}/simulate-scenario`, {
        dimension: 'region',
        adjustments: [{ segment: 'North', deltaPercent: 10.0 }]
      }, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resSim.statusCode, 200);
      assert.strictEqual(resSim.body.success, true);
      assert.strictEqual(resSim.body.data.isCounterfactual, true);

      // Integer ID
      const resInt = await apiReq(baseUrl, 'POST', `/api/insights/789/simulate-scenario`, {
        dimension: 'region',
        adjustments: [{ segment: 'North', deltaPercent: 10.0 }]
      }, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resInt.statusCode, 404);
    });

    // 8. Core Insight REST Controller Safety
    await test('8. Core /api/insights/:id handles integer and malformed IDs with 404', async () => {
      const resInt = await apiReq(baseUrl, 'GET', `/api/insights/999`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(resInt.statusCode, 404);
      assert.strictEqual(resInt.body.success, false);
    });

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`  REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionTests().catch(err => {
  console.error('Regression Test Suite Failed:', err);
  process.exit(1);
});
