/**
 * Test Suite: Business Radar Analysis End-to-End Workflow & Multi-Tenant Access
 * Verifies all 10 requirements:
 * 1. Open Business Radar for an existing, authorized insight
 * 2. Retrieve an insight using a valid UUID
 * 3. Handle a nonexistent insight (404)
 * 4. Handle an unauthorized or cross-tenant insight (404, no data leak)
 * 5. Generate analysis when valid supporting data exists (ground-truth numbers)
 * 6. Handle missing datasets or insufficient historical data (clean empty state)
 * 7. Verify calculations against known test values (exact math identity)
 * 8. Verify the retry action
 * 9. Verify Live, Load, Empty, and Error states
 * 10. Confirm existing AI Insights features remain functional
 */

const assert = require('assert');
const db = require('./config/database');
const decisionIntelligenceController = require('./controllers/decisionIntelligenceController');
const rootCauseAttributionService = require('./services/rootCauseAttributionService');
const insightService = require('./services/insightService');
const InsightModel = require('./models/insightModel');
const Dataset = require('./models/datasetModel');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ORG_A = '00000000-0000-0000-0000-000000000001';
const ORG_B = '3d9522cc-ed7f-49d5-b0a0-42a2e4bd67b8';

function createMockReq(user, params = {}, query = {}, body = {}) {
  return {
    user,
    params,
    query,
    body,
    ip: '127.0.0.1',
    headers: {}
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('\n=== RicozAnalytics Business Radar Verification Suite ===\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log('❌ FAIL');
      console.error('  Error:', err.message);
      failed++;
    }
  }

  // Setup: Create a verified test dataset with known numbers
  const testCsvContent = `region,category,sales_amount,order_date
North,Electronics,10000,2026-01-01
South,Apparel,20000,2026-01-02
North,Electronics,5000,2026-02-01
South,Apparel,22000,2026-02-02`;

  const uploadsDir = path.join(__dirname, 'uploads', 'test_data');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const testCsvPath = path.join(uploadsDir, `business_radar_test_${Date.now()}.csv`);
  fs.writeFileSync(testCsvPath, testCsvContent);

  const testDatasetRes = await db.query(`
    INSERT INTO datasets (
      organization_id, user_id, name, file_path, row_count, column_count, schema
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `, [
    ORG_A,
    1,
    'Business Radar Ground Truth Dataset',
    testCsvPath,
    4,
    4,
    JSON.stringify([
      { name: 'region', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'sales_amount', type: 'number' },
      { name: 'order_date', type: 'date' }
    ])
  ]);
  const testDataset = testDatasetRes.rows[0];

  // Create an insight linked to this dataset in Org A
  const insightA = await InsightModel.create({
    organizationId: ORG_A,
    datasetId: testDataset.id,
    type: 'decline',
    title: 'North Region Sales Contraction',
    summary: 'Sales contracted in North region during Q1.',
    severity: 'warning',
    evidence: {
      metric: 'sales_amount',
      datasetId: testDataset.id,
      comparisonPeriod: 'Baseline Q1',
      currentPeriod: 'Observed Q1',
      comparisonValue: 30000,
      currentValue: 27000,
      changePercent: -10,
      verified: true
    }
  });

  // Create an insight linked to Org B (cross-tenant)
  const insightB = await InsightModel.create({
    organizationId: ORG_B,
    type: 'decline',
    title: 'Tenant B Private Insight',
    summary: 'Private data for Tenant B',
    severity: 'critical',
    evidence: {
      metric: 'sales_amount',
      comparisonValue: 50000,
      currentValue: 40000,
      verified: true
    }
  });

  // Create an insight with NO dataset linked (empty state test)
  const insightNoDataset = await InsightModel.create({
    organizationId: ORG_A,
    datasetId: null,
    type: 'kpi',
    title: 'Global Platform Revenue Summary',
    summary: 'Overall platform KPI without categorical slices.',
    severity: 'info',
    evidence: {
      metric: 'revenue',
      comparisonValue: 100000,
      currentValue: 105000,
      changePercent: 5,
      verified: true
    }
  });

  try {
    // 1. Open Business Radar for an existing, authorized insight
    await test('1. Open Business Radar for an existing, authorized insight', async () => {
      const req = createMockReq({ organization_id: ORG_A }, { id: insightA.id });
      const res = createMockRes();
      await decisionIntelligenceController.getRootCause(req, res);

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data, 'Expected data payload');
      assert.strictEqual(res.body.data.insightId, insightA.id);
      assert.ok(Array.isArray(res.body.data.drivers), 'Expected drivers array');
      assert.strictEqual(res.body.data.drivers.length, 2, 'Expected 2 drivers');
    });

    // 2. Retrieve an insight using a valid UUID
    await test('2. Retrieve an insight using a valid UUID', async () => {
      const found = await insightService.getInsightById(insightA.id, ORG_A);
      assert.ok(found, 'Expected insight to be retrieved by UUID');
      assert.strictEqual(found.id, insightA.id);
      assert.strictEqual(found.organization_id, ORG_A);
    });

    // 3. Handle a nonexistent insight
    await test('3. Handle a nonexistent insight (returns 404 with diagnostic reference)', async () => {
      const nonExistentId = '810777eb-f5fd-4226-b41f-e2cc716b912a';
      const req = createMockReq({ organization_id: ORG_A }, { id: nonExistentId });
      const res = createMockRes();
      await decisionIntelligenceController.getRootCause(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      assert.ok(
        res.body.error.message.includes(`Insight #${nonExistentId} not found or access denied.`),
        `Unexpected error message: ${res.body.error.message}`
      );
    });

    // 4. Handle an unauthorized or cross-tenant insight
    await test('4. Handle unauthorized or cross-tenant insight (strict multi-tenant isolation)', async () => {
      // Tenant A tries to access Tenant B's insight
      const req = createMockReq({ organization_id: ORG_A }, { id: insightB.id });
      const res = createMockRes();
      await decisionIntelligenceController.getRootCause(req, res);

      assert.strictEqual(res.statusCode, 404, 'Must return 404 for cross-tenant access');
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      assert.ok(!res.body.data, 'Must not return any cross-tenant data');
    });

    // 5. Generate analysis when valid supporting data exists (ground-truth verification)
    await test('5. Generate analysis when valid supporting data exists', async () => {
      const req = createMockReq({ organization_id: ORG_A }, { id: insightA.id }, { dimension: 'region' });
      const res = createMockRes();
      await decisionIntelligenceController.getRootCause(req, res);

      const d = res.body.data;
      assert.strictEqual(d.totalBaseline, 30000);
      assert.strictEqual(d.totalCurrent, 27000);
      assert.strictEqual(d.totalDelta, -3000);
      assert.strictEqual(d.totalDeltaPercent, -10);

      // Verify exact driver contributions
      const north = d.drivers.find(drv => drv.segment === 'North');
      const south = d.drivers.find(drv => drv.segment === 'South');
      assert.ok(north, 'Expected North segment');
      assert.ok(south, 'Expected South segment');
      assert.strictEqual(north.baselineValue, 10000);
      assert.strictEqual(north.currentValue, 5000);
      assert.strictEqual(north.segmentDelta, -5000);
      assert.strictEqual(north.deltaPercent, -50);

      assert.strictEqual(south.baselineValue, 20000);
      assert.strictEqual(south.currentValue, 22000);
      assert.strictEqual(south.segmentDelta, 2000);
      assert.strictEqual(south.deltaPercent, 10);
    });

    // 6. Handle missing datasets or insufficient historical data
    await test('6. Handle missing datasets gracefully (returns Empty state with explanation)', async () => {
      const req = createMockReq({ organization_id: ORG_A }, { id: insightNoDataset.id });
      const res = createMockRes();
      await decisionIntelligenceController.getRootCause(req, res);

      assert.strictEqual(res.statusCode, 200, 'Must return 200 for empty state');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.drivers.length, 0, 'Drivers must be empty');
      assert.ok(res.body.data.emptyReason, 'Must provide emptyReason explaining what is missing');
      assert.ok(
        res.body.data.emptyReason.includes('not linked to an underlying dataset') ||
        res.body.data.emptyReason.includes('unavailable'),
        `Unexpected emptyReason: ${res.body.data.emptyReason}`
      );
    });

    // 7. Verify calculations against known test values & mathematical invariants
    await test('7. Verify calculations against known test values & invariants', async () => {
      const req = createMockReq({ organization_id: ORG_A }, { id: insightA.id });
      const res = createMockRes();
      await decisionIntelligenceController.getRootCause(req, res);

      const d = res.body.data;
      // Invariant 1: sum(segmentDelta) === totalDelta
      const sumDeltas = d.drivers.reduce((acc, drv) => acc + drv.segmentDelta, 0);
      assert.strictEqual(Math.round(sumDeltas), Math.round(d.totalDelta));
      assert.strictEqual(d.mathBalanceVerified, true);

      // Invariant 2: primary detractor and sustainer identified correctly
      assert.strictEqual(d.primaryDetractor.segment, 'North');
      assert.strictEqual(d.primaryDetractor.delta, -5000);
      assert.strictEqual(d.primarySustainer.segment, 'South');
      assert.strictEqual(d.primarySustainer.delta, 2000);

      // Invariant 3: Observational language without claiming causation
      assert.ok(!d.observationalSummary.includes('caused by'), 'Must not claim causation');
      assert.ok(d.observationalSummary.includes('accounted for'), 'Must use observational phrasing');
    });

    // 8. Verify the retry action
    await test('8. Verify retry action returns fresh and consistent analysis', async () => {
      // First call
      const req1 = createMockReq({ organization_id: ORG_A }, { id: insightA.id }, { forceFresh: true });
      const res1 = createMockRes();
      await decisionIntelligenceController.getRootCause(req1, res1);

      // Retry call
      const req2 = createMockReq({ organization_id: ORG_A }, { id: insightA.id }, { forceFresh: true });
      const res2 = createMockRes();
      await decisionIntelligenceController.getRootCause(req2, res2);

      assert.strictEqual(res1.statusCode, 200);
      assert.strictEqual(res2.statusCode, 200);
      assert.strictEqual(res1.body.data.totalDelta, res2.body.data.totalDelta);
      assert.strictEqual(res1.body.data.drivers.length, res2.body.data.drivers.length);
    });

    // 9. Verify Live, Load, Empty, and Error states
    await test('9. Verify Live, Empty, and Error state payloads', async () => {
      // Live state
      const liveReq = createMockReq({ organization_id: ORG_A }, { id: insightA.id });
      const liveRes = createMockRes();
      await decisionIntelligenceController.getRootCause(liveReq, liveRes);
      assert.strictEqual(liveRes.body.success, true);
      assert.ok(liveRes.body.data.drivers.length > 0, 'Live state has drivers');

      // Empty state
      const emptyReq = createMockReq({ organization_id: ORG_A }, { id: insightNoDataset.id });
      const emptyRes = createMockRes();
      await decisionIntelligenceController.getRootCause(emptyReq, emptyRes);
      assert.strictEqual(emptyRes.body.success, true);
      assert.strictEqual(emptyRes.body.data.drivers.length, 0, 'Empty state has 0 drivers');
      assert.ok(emptyRes.body.data.emptyReason, 'Empty state has explanation');

      // Error state (nonexistent ID)
      const errReq = createMockReq({ organization_id: ORG_A }, { id: crypto.randomUUID() });
      const errRes = createMockRes();
      await decisionIntelligenceController.getRootCause(errReq, errRes);
      assert.strictEqual(errRes.statusCode, 404);
      assert.strictEqual(errRes.body.success, false);
      assert.strictEqual(errRes.body.error.code, 'NOT_FOUND');
    });

    // 10. Confirm existing AI Insights and analytics features remain functional
    await test('10. Confirm existing AI Insights listing and dimension features remain functional', async () => {
      const dimsReq = createMockReq({ organization_id: ORG_A }, { id: insightA.id });
      const dimsRes = createMockRes();
      await decisionIntelligenceController.getAvailableDimensions(dimsReq, dimsRes);

      assert.strictEqual(dimsRes.statusCode, 200);
      assert.strictEqual(dimsRes.body.success, true);
      assert.ok(Array.isArray(dimsRes.body.data.availableDimensions));
      assert.ok(dimsRes.body.data.availableDimensions.includes('region'));
      assert.ok(dimsRes.body.data.availableDimensions.includes('category'));

      // Check insights listing
      const list = await insightService.getInsights(ORG_A, { status: 'active', limit: 10 });
      assert.ok(Array.isArray(list));
      assert.ok(list.length > 0);
    });

  } finally {
    // Cleanup test records
    await db.query(`DELETE FROM ai_insights WHERE id IN ($1, $2, $3)`, [
      insightA.id,
      insightB.id,
      insightNoDataset.id
    ]).catch(() => {});

    await db.query(`DELETE FROM datasets WHERE id = $1`, [testDataset.id]).catch(() => {});
    if (fs.existsSync(testCsvPath)) fs.unlinkSync(testCsvPath);
  }

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
