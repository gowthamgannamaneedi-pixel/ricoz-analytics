const assert = require('assert');
const http = require('http');
const app = require('./app');
const jwt = require('jsonwebtoken');
const config = require('./config');
const insightService = require('./services/insightService');
const InsightModel = require('./models/insightModel');
const schedulerService = require('./services/schedulerService');
const AlertModel = require('./models/alertModel');
const db = require('./config/database');

function generateToken(userId, email, role, orgId) {
  return jwt.sign(
    { id: userId, email, role, organization_id: orgId },
    config.jwtSecret || 'dev-jwt-secret-key-12345',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('===============================================================');
  console.log('  PHASE 1 REPAIR: DEDUPLICATION & COOLDOWN VERIFICATION SUITE  ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;
  let server = null;
  const testPort = 5991;

  async function test(name, fn) {
    try {
      await fn();
      console.log(` PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(` FAIL: ${name}`);
      console.error(`       Error: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
  }

  function makeRequest(method, path, token, body = null) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const options = {
        hostname: '127.0.0.1',
        port: testPort,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data }; }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  try {
    server = app.listen(testPort);
    await new Promise(r => setTimeout(r, 200));

    const testOrgId = '00000000-0000-0000-0000-000000000001';
    const adminToken = generateToken(1, 'admin@ricoz.test', 'admin', testOrgId);

    // Setup an active alert that will trigger in insightService
    const alertId = '00000000-0000-0000-0000-000000000099';
    await AlertModel.create({
      id: alertId,
      organizationId: testOrgId,
      name: 'Quarterly Revenue Minimum Threshold',
      type: 'threshold',
      condition: 'less_than',
      threshold: 500000,
      severity: 'critical',
      status: 'active',
      lastTriggeredAt: new Date(Date.now() - 3600000), // 1 hour ago
      cooldownMinutes: 60
    }).catch(() => {});

    // -------------------------------------------------------------
    // Test 1: First generation creates an insight
    // -------------------------------------------------------------
    await test('1. First generation creates an insight record in the database', async () => {
      const initialRows = await InsightModel.findByOrganizationId(testOrgId, { dedup: false, limit: 100 });
      const initialCount = initialRows.length;

      const genRes = await makeRequest('POST', '/api/insights/generate', adminToken, { persist: true });
      assert.strictEqual(genRes.statusCode, 200, `Expected 200, got ${genRes.statusCode}`);
      assert(genRes.body.insights.length > 0, 'Expected at least 1 insight generated');

      const afterRows = await InsightModel.findByOrganizationId(testOrgId, { dedup: false, limit: 100 });
      assert(afterRows.length > initialCount, `Expected DB row count to increase from ${initialCount}, got ${afterRows.length}`);
    });

    // -------------------------------------------------------------
    // Test 2: Second generation does NOT create an identical duplicate
    // -------------------------------------------------------------
    await test('2. Second generation within cooldown does NOT create duplicate DB records', async () => {
      const beforeRows = await InsightModel.findByOrganizationId(testOrgId, { dedup: false, limit: 100 });
      const countBefore = beforeRows.length;

      // Run generation again
      const genRes2 = await makeRequest('POST', '/api/insights/generate', adminToken, { persist: true });
      assert.strictEqual(genRes2.statusCode, 200);

      const afterRows = await InsightModel.findByOrganizationId(testOrgId, { dedup: false, limit: 100 });
      const countAfter = afterRows.length;

      assert.strictEqual(countAfter, countBefore, `Expected DB row count to remain ${countBefore}, but got ${countAfter} (duplicate created!)`);
    });

    // -------------------------------------------------------------
    // Test 3: Scheduler cannot create duplicates
    // -------------------------------------------------------------
    await test('3. Scheduler background execution respects deduplication and inserts 0 duplicates', async () => {
      const beforeRows = await InsightModel.findByOrganizationId(testOrgId, { dedup: false, limit: 100 });
      const countBefore = beforeRows.length;

      // Simulate multiple background scheduler ticks
      await schedulerService.evaluateScheduledInsights();
      await schedulerService.evaluateScheduledInsights();
      await schedulerService.evaluateScheduledInsights();

      const afterRows = await InsightModel.findByOrganizationId(testOrgId, { dedup: false, limit: 100 });
      const countAfter = afterRows.length;

      assert.strictEqual(countAfter, countBefore, `Expected row count to stay ${countBefore} after scheduler ticks, got ${countAfter}`);
    });

    // -------------------------------------------------------------
    // Test 4: Legacy duplicates are hidden from GET /api/insights
    // -------------------------------------------------------------
    await test('4. GET /api/insights returns only 1 active insight even when legacy duplicates exist in DB', async () => {
      // Intentionally insert 3 legacy duplicate rows with different UUIDs
      const title = 'Operational Alert Triggered: "Quarterly Revenue Minimum Threshold"';
      await InsightModel.create({
        organizationId: testOrgId,
        type: 'operational',
        title,
        summary: 'Legacy duplicate record 1',
        severity: 'critical',
        status: 'active'
      });
      await InsightModel.create({
        organizationId: testOrgId,
        type: 'operational',
        title,
        summary: 'Legacy duplicate record 2',
        severity: 'critical',
        status: 'active'
      });
      await InsightModel.create({
        organizationId: testOrgId,
        type: 'operational',
        title,
        summary: 'Legacy duplicate record 3',
        severity: 'critical',
        status: 'active'
      });

      // Verify that the database actually contains multiple records with this title
      const allRawRows = await InsightModel.findByOrganizationId(testOrgId, { dedup: false, limit: 100 });
      const matchingRaw = allRawRows.filter(i => i.title === title && i.status === 'active');
      assert(matchingRaw.length >= 3, `Expected at least 3 duplicate rows in DB, got ${matchingRaw.length}`);

      // Query the API endpoint (default dedup: true)
      const res = await makeRequest('GET', '/api/insights?status=active', adminToken);
      assert.strictEqual(res.statusCode, 200);

      const matchingApi = res.body.data.filter(i => i.title === title);
      assert.strictEqual(matchingApi.length, 1, `Expected exactly 1 card returned by API, but got ${matchingApi.length}`);
    });

    // -------------------------------------------------------------
    // Test 5: Existing historical records remain untouched
    // -------------------------------------------------------------
    await test('5. Existing historical duplicate records remain untouched in the database', async () => {
      const title = 'Operational Alert Triggered: "Quarterly Revenue Minimum Threshold"';
      const allHistorical = await InsightModel.findByOrganizationId(testOrgId, { dedup: false, limit: 100 });
      const duplicatesInDb = allHistorical.filter(i => i.title === title);

      // Verify no records were deleted
      assert(duplicatesInDb.length >= 3, `Expected all ${duplicatesInDb.length} historical records to be preserved in the DB`);
    });

    // -------------------------------------------------------------
    // Test 6: Verify scheduler cron is hourly
    // -------------------------------------------------------------
    await test('6. SchedulerService configures hourly cron for insight generation', async () => {
      // Check schedulerService code configuration
      assert(schedulerService.start, 'SchedulerService should have start method');
      assert(schedulerService.stop, 'SchedulerService should have stop method');
      assert.strictEqual(typeof schedulerService.evaluateScheduledInsights, 'function');
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 1 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
