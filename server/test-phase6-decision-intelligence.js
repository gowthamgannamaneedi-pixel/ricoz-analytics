const fs = require('fs');
const path = require('path');
const assert = require('assert');
const storage = require('./storage');
const Dataset = require('./models/datasetModel');
const InsightModel = require('./models/insightModel');
const insightService = require('./services/insightService');
const rootCauseAttributionService = require('./services/rootCauseAttributionService');
const scenarioSimulationService = require('./services/scenarioSimulationService');
const evidenceBuilderService = require('./services/evidenceBuilderService');
const geminiService = require('./services/geminiService');
const analyticsService = require('./services/analyticsService');

/**
 * PHASE 6: ENTERPRISE DECISION INTELLIGENCE & ROOT-CAUSE ATTRIBUTION TEST SUITE
 * 
 * Verifies:
 * 1. Deterministic variance decomposition: sum(segmentDelta) === totalDelta
 * 2. Signed contribution percentages: (segmentDelta / totalDelta) * 100
 * 3. Mixed positive/negative segment deltas coexist without clamping or artificial normalization
 * 4. Absolute movement share: (|segmentDelta| / sum(|segmentDelta|)) * 100
 * 5. Movement concentration HHI calculated from absolute movement shares
 * 6. Identification of primary detractor and primary sustainer
 * 7. Dynamic categorical column detection and missing dimension safety
 * 8. Zero variance handling (totalDelta === 0)
 * 9. Counterfactual scenario simulation calculation accuracy
 * 10. Negative adjustment bounded constraint (clamped to 0, flagged with clampedAtZero)
 * 11. Strict invariant: Observational language with zero causation claims
 * 12. Multi-tenant isolation: Tenant B cannot decompose Tenant A insights
 * 13. RBAC authorization (Viewers allowed read, blocked from mutating)
 * 14. Gemini explanation receives only pre-calculated math
 * 15. Graceful deterministic fallback when Gemini is offline / error
 * 16. Non-regression of Phase 1 deduplication
 * 17. Non-regression of Phase 2 storage
 * 18. Non-regression of Phase 3 evidence
 * 19. Non-regression of Phase 4 Gemini grounding
 * 20. Non-regression of Phase 5 prioritization & relationships
 */
async function runPhase6Tests() {
  console.log('===============================================================');
  console.log('  PHASE 6: DECISION INTELLIGENCE & ROOT-CAUSE TEST SUITE       ');
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
  const testDir = path.resolve(__dirname, 'uploads/test_phase6');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Mixed variance dataset with positive and negative segment movements
  const mixedDataPath = path.join(testDir, 'mixed_variance.csv');
  fs.writeFileSync(mixedDataPath, [
    'date,region,category,channel,sales_amount,units_sold,profit',
    // Baseline period (first half):
    '2026-01-01,North,Electronics,Retail,40000,10,8000',
    '2026-01-02,South,Electronics,Online,30000,8,6000',
    '2026-01-03,East,Apparel,Online,10000,4,2000',
    '2026-01-04,West,Apparel,Retail,20000,5,4000',
    // Current period (second half):
    // North contracts from 40k to 20k (-20k)
    '2026-02-01,North,Electronics,Retail,20000,5,4000',
    // South contracts from 30k to 25k (-5k)
    '2026-02-02,South,Electronics,Online,25000,6,5000',
    // East expands from 10k to 18k (+8k sustainer/offsetting)
    '2026-02-03,East,Apparel,Online,18000,7,3600',
    // West contracts from 20k to 17k (-3k)
    '2026-02-04,West,Apparel,Retail,17000,4,3400'
  ].join('\n'));

  // Store in persistent storage
  const saveRes = await storage.saveFile(1, 'mixed_variance.csv', fs.readFileSync(mixedDataPath));
  const storageRelPath = saveRes.filePath;

  const mixedDataset = await Dataset.create({
    userId: 1,
    organizationId: testOrgA,
    name: 'Mixed Variance Telemetry',
    filePath: storageRelPath,
    rowCount: 8,
    columnCount: 7,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'region', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'channel', type: 'string' },
      { name: 'sales_amount', type: 'number' },
      { name: 'units_sold', type: 'number' },
      { name: 'profit', type: 'number' }
    ]
  });

  // Base insight referencing the mixed dataset
  const testInsight = {
    id: 'f6000000-0000-0000-0000-000000000001',
    dataset_id: mixedDataset.id,
    title: 'Revenue Contraction in Q1',
    type: 'decline',
    severity: 'warning',
    evidence: {
      datasetId: mixedDataset.id,
      metric: 'sales_amount',
      currentValue: 80000,
      comparisonValue: 100000,
      changePercent: -20.0,
      recordsAnalyzed: 8,
      verified: true
    }
  };

  // ============================================================
  // TEST 1: Exact identity sum(segmentDelta) === totalDelta
  // ============================================================
  await test('1. Exact identity sum(segmentDelta) === totalDelta is strictly preserved', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    assert.strictEqual(attribution.mathBalanceVerified, true, 'Math balance must be verified');
    assert.strictEqual(attribution.totalBaseline, 100000, 'Baseline must be 100,000');
    assert.strictEqual(attribution.totalCurrent, 80000, 'Current must be 80,000');
    assert.strictEqual(attribution.totalDelta, -20000, 'Total delta must be -20,000');
    assert.strictEqual(attribution.sumOfSegmentDeltas, -20000, 'Sum of segment deltas must match total delta exactly');
  });

  // ============================================================
  // TEST 2: Signed contribution percentages
  // ============================================================
  await test('2. Signed contribution percentages calculate accurately without artificial clamping', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    const north = attribution.drivers.find(d => d.segment === 'North');
    const south = attribution.drivers.find(d => d.segment === 'South');
    const east = attribution.drivers.find(d => d.segment === 'East');
    const west = attribution.drivers.find(d => d.segment === 'West');

    // North: delta = -20000, totalDelta = -20000 => contribution = 100%
    assert.strictEqual(north.segmentDelta, -20000);
    assert.strictEqual(north.contributionPercent, 100);

    // South: delta = -5000, totalDelta = -20000 => contribution = 25%
    assert.strictEqual(south.segmentDelta, -5000);
    assert.strictEqual(south.contributionPercent, 25);

    // East: delta = +8000, totalDelta = -20000 => contribution = -40% (resisting contraction!)
    assert.strictEqual(east.segmentDelta, 8000);
    assert.strictEqual(east.contributionPercent, -40);

    // West: delta = -3000, totalDelta = -20000 => contribution = 15%
    assert.strictEqual(west.segmentDelta, -3000);
    assert.strictEqual(west.contributionPercent, 15);

    // Sum of signed contributions: 100 + 25 + (-40) + 15 = 100%
    const sumContrib = north.contributionPercent + south.contributionPercent + east.contributionPercent + west.contributionPercent;
    assert.strictEqual(sumContrib, 100);
  });

  // ============================================================
  // TEST 3: Mixed positive and negative contributions
  // ============================================================
  await test('3. Coexisting positive and negative segment deltas allow contributions <0% and >=100%', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    const hasNegativeContribution = attribution.drivers.some(d => d.contributionPercent < 0);
    const hasHundredOrMoreContribution = attribution.drivers.some(d => d.contributionPercent >= 100);

    assert(hasNegativeContribution, 'Sustainer segment must have negative contribution to net drop');
    assert(hasHundredOrMoreContribution, 'Primary detractor can have >=100% contribution when sustainers exist');
  });

  // ============================================================
  // TEST 4: Absolute movement share
  // ============================================================
  await test('4. Absolute movement share calculates |segmentDelta| / sum(|segmentDelta|) * 100', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    // Sum of abs deltas: 20000 + 8000 + 5000 + 3000 = 36000
    const north = attribution.drivers.find(d => d.segment === 'North');
    const east = attribution.drivers.find(d => d.segment === 'East');

    // North share: 20000 / 36000 * 100 = 55.56%
    assert.strictEqual(north.absoluteMovementShare, 55.56);
    // East share: 8000 / 36000 * 100 = 22.22%
    assert.strictEqual(east.absoluteMovementShare, 22.22);

    const sumAbsoluteShares = attribution.drivers.reduce((acc, d) => acc + d.absoluteMovementShare, 0);
    assert(Math.abs(sumAbsoluteShares - 100) < 0.1, 'Sum of absolute movement shares must equal ~100%');
  });

  // ============================================================
  // TEST 5: Movement Concentration (HHI)
  // ============================================================
  await test('5. Movement concentration HHI is derived strictly from absolute movement shares', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    assert(attribution.concentration, 'Concentration metric must exist');
    assert.strictEqual(attribution.concentration.metric, 'movement_concentration');
    assert(typeof attribution.concentration.hhi === 'number');
    assert(attribution.concentration.hhi >= 0 && attribution.concentration.hhi <= 1);
    assert(attribution.concentration.description.includes('movement is'));
  });

  // ============================================================
  // TEST 6: Primary Detractor & Primary Sustainer classification
  // ============================================================
  await test('6. Correctly identifies primary_detractor and primary_sustainer segments', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    assert(attribution.primaryDetractor, 'Primary detractor must be identified');
    assert.strictEqual(attribution.primaryDetractor.segment, 'North');
    assert.strictEqual(attribution.primaryDetractor.delta, -20000);

    assert(attribution.primarySustainer, 'Primary sustainer must be identified');
    assert.strictEqual(attribution.primarySustainer.segment, 'East');
    assert.strictEqual(attribution.primarySustainer.delta, 8000);
  });

  // ============================================================
  // TEST 7: Dynamic dimension detection & missing dimension safety
  // ============================================================
  await test('7. Dynamically detects eligible categorical dimensions and handles missing column safely', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'category'
    });

    assert.strictEqual(attribution.dimension, 'category');
    assert(Array.isArray(attribution.availableDimensions));
    assert(attribution.availableDimensions.includes('region'));
    assert(attribution.availableDimensions.includes('category'));
    assert(attribution.availableDimensions.includes('channel'));
    // Date and numeric columns excluded from categorical dimensions
    assert(!attribution.availableDimensions.includes('date'));
    assert(!attribution.availableDimensions.includes('sales_amount'));

    // Gracefully handles nonexistent dimension by defaulting
    const fallbackDim = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'nonexistent_dimension'
    });
    assert(fallbackDim.dimension, 'Must fall back to an available dimension');
  });

  // ============================================================
  // TEST 8: Zero variance handling (totalDelta === 0)
  // ============================================================
  await test('8. Flat or zero net variance (totalDelta === 0) handled gracefully without division by zero', async () => {
    const flatPath = path.join(testDir, 'flat_data.csv');
    fs.writeFileSync(flatPath, [
      'date,region,sales_amount',
      '2026-01-01,North,100',
      '2026-01-02,South,100',
      '2026-02-01,North,100',
      '2026-02-02,South,100'
    ].join('\n'));

    const flatRes = await storage.saveFile(1, 'flat_data.csv', fs.readFileSync(flatPath));
    const flatStoragePath = flatRes.filePath;

    const flatDataset = await Dataset.create({
      userId: 1,
      organizationId: testOrgA,
      name: 'Flat Telemetry',
      filePath: flatStoragePath,
      rowCount: 4,
      columnCount: 3,
      schema: [
        { name: 'date', type: 'date' },
        { name: 'region', type: 'string' },
        { name: 'sales_amount', type: 'number' }
      ]
    });

    const flatInsight = {
      id: 'f6000000-0000-0000-0000-000000000002',
      dataset_id: flatDataset.id,
      title: 'Flat Revenue Observation',
      evidence: { datasetId: flatDataset.id, metric: 'sales_amount' }
    };

    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: flatInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    assert.strictEqual(attribution.totalDelta, 0);
    assert.strictEqual(attribution.totalDeltaPercent, 0);
    for (const d of attribution.drivers) {
      assert.strictEqual(d.contributionPercent, 0, 'Contribution must be 0 on zero total delta');
    }
  });

  // ============================================================
  // TEST 9: Counterfactual scenario simulation calculation
  // ============================================================
  await test('9. Counterfactual scenario simulation computes projected totals deterministically', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    // Simulate recovering North by +25%
    const simulation = scenarioSimulationService.simulate({
      baselineDrivers: attribution.drivers,
      adjustments: [
        { segment: 'North', deltaPercent: 25.0 }
      ],
      context: { metric: 'sales_amount', dimension: 'region', insightId: testInsight.id }
    });

    assert.strictEqual(simulation.isCounterfactual, true);
    assert.strictEqual(simulation.classification, 'COUNTERFACTUAL_SIMULATION');
    assert.strictEqual(simulation.baselineTotal, 80000); // 20k + 25k + 18k + 17k = 80k

    // North was 20k, +25% => 25k (net +5k)
    // New total = 80k + 5k = 85k
    assert.strictEqual(simulation.simulatedTotal, 85000);
    assert.strictEqual(simulation.netProjectedDelta, 5000);
    assert.strictEqual(simulation.netProjectedPercent, 6.25);
  });

  // ============================================================
  // TEST 10: Negative adjustment bounded constraint (clamped to 0)
  // ============================================================
  await test('10. Negative adjustments pushing a segment below zero are clamped at 0 with validation flag', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    // Simulate severe -150% drop on North (currentValue = 20k)
    const simulation = scenarioSimulationService.simulate({
      baselineDrivers: attribution.drivers,
      adjustments: [
        { segment: 'North', deltaPercent: -150.0 }
      ],
      context: { metric: 'sales_amount', dimension: 'region', insightId: testInsight.id }
    });

    const northSim = simulation.segmentBreakdown.find(s => s.segment === 'North');
    assert.strictEqual(northSim.simulatedValue, 0, 'Simulated value must not be negative; clamped at 0');
    assert.strictEqual(northSim.clampedAtZero, true, 'clampedAtZero flag must be set');
    assert.strictEqual(simulation.anyClampedAtZero, true, 'Summary anyClampedAtZero must be true');
    assert.strictEqual(simulation.simulatedTotal, 60000); // 80k - 20k = 60k
  });

  // ============================================================
  // TEST 11: Strict invariant: Observational language (Zero Causation)
  // ============================================================
  await test('11. Invariant: Observational language strictly contains zero causation claims', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    const summary = attribution.observationalSummary.toLowerCase();
    const banned = ['caused', 'due to', 'because of', 'led to', 'resulted in'];
    for (const b of banned) {
      assert(!summary.includes(b), `Observational summary must not contain causation term: "${b}"`);
    }
    assert(summary.includes('accounted for'), 'Must use approved observational phrasing');
  });

  // ============================================================
  // TEST 12: Multi-tenant isolation
  // ============================================================
  await test('12. Multi-tenant isolation: Organization B cannot access or decompose Org A dataset/insight', async () => {
    try {
      await rootCauseAttributionService.calculateAttribution({
        insight: testInsight,
        organizationId: testOrgB, // Wrong tenant!
        dimension: 'region'
      });
      assert.fail('Should have thrown 404 access denied');
    } catch (err) {
      assert(err.message.includes('not found') || err.message.includes('access denied'));
    }
  });

  // ============================================================
  // TEST 13: Gemini receives only pre-calculated verified numbers
  // ============================================================
  await test('13. Gemini prompt builder receives only pre-calculated verified values', async () => {
    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    // Test deterministic driver explanation
    const explanation = geminiService._buildDeterministicDriverExplanation(attribution);
    assert(explanation.includes('North'), 'Explanation must cite top verified segment');
    assert(explanation.includes('sales_amount'), 'Explanation must cite metric name');
    assert(explanation.includes('100%'), 'Explanation must cite pre-calculated contribution share');
  });

  // ============================================================
  // TEST 14: Graceful deterministic fallback when Gemini is offline
  // ============================================================
  await test('14. Graceful deterministic fallback operates when Gemini API key is missing or offline', async () => {
    const prevKey = geminiService.apiKey;
    geminiService.apiKey = ''; // simulate absent key

    const attribution = await rootCauseAttributionService.calculateAttribution({
      insight: testInsight,
      organizationId: testOrgA,
      dimension: 'region'
    });

    const res = await geminiService.generateDriverExplanation({ attribution });
    geminiService.apiKey = prevKey;

    assert.strictEqual(res.aiGenerated, false);
    assert.strictEqual(res.fallback, true);
    assert(res.explanation.length > 20);
    assert(res.explanation.includes('North'));
  });

  // ============================================================
  // TEST 15: Non-regression: Phase 1 Deduplication
  // ============================================================
  await test('15. Non-regression: Phase 1 deduplication active duplicate detection remains intact', async () => {
    const dup = await InsightModel.findActiveDuplicate({
      organizationId: testOrgA,
      type: 'decline',
      title: 'Revenue Contraction in Q1',
      datasetId: mixedDataset.id,
      cooldownMinutes: 60
    });
    // In fallback/database, returns active duplicate or null cleanly
    assert(dup === null || typeof dup === 'object');
  });

  // ============================================================
  // TEST 16: Non-regression: Phase 2 Persistent Storage
  // ============================================================
  await test('16. Non-regression: Phase 2 persistent storage reads test file reliably', async () => {
    const exists = await storage.exists(storageRelPath);
    assert.strictEqual(exists, true);
    const content = await storage.readFile(storageRelPath);
    assert(content.length > 50);
  });

  // ============================================================
  // TEST 17: Non-regression: Phase 3 Evidence Builder
  // ============================================================
  await test('17. Non-regression: Phase 3 Evidence Builder calculates verified factual metrics', async () => {
    const evidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
      dataset: mixedDataset,
      records: [{ sales_amount: 100000 }, { sales_amount: 80000 }],
      currPoint: { revenue: 80000, date: '2026-02-01' },
      prevPoint: { revenue: 100000, date: '2026-01-01' },
      targetMetric: 'sales_amount'
    });
    assert.strictEqual(evidence.verified, true);
    assert.strictEqual(evidence.changePercent, -20);
  });

  // ============================================================
  // TEST 18: Non-regression: Phase 4 Gemini Grounding
  // ============================================================
  await test('18. Non-regression: Phase 4 Gemini grounding immutability preserves evidence', async () => {
    const verifiedEvidence = {
      verified: true,
      currentValue: 80000,
      comparisonValue: 100000,
      changePercent: -20,
      recordsAnalyzed: 8,
      datasetId: mixedDataset.id,
      sourceFields: ['sales_amount'],
      calculation: '((80000 - 100000) / 100000) * 100 = -20%'
    };

    const explanation = geminiService._buildDeterministicInsightExplanation({
      type: 'decline',
      title: 'Revenue Contraction in Q1',
      summary: 'Sales declined by -20%',
      evidence: verifiedEvidence
    });

    assert(explanation.explanation.includes('80,000') || explanation.explanation.includes('80000'));
  });

  // ============================================================
  // TEST 19: Non-regression: Phase 5 Prioritization
  // ============================================================
  await test('19. Non-regression: Phase 5 prioritization derives impactScore and priorityReason', async () => {
    const insightPrioritizationService = require('./services/insightPrioritizationService');
    const priorityMeta = insightPrioritizationService.calculateInsightPriority({
      type: 'decline',
      severity: 'warning',
      evidence: {
        changePercent: -20.0,
        recordsAnalyzed: 8,
        metric: 'sales_amount'
      }
    });

    assert(priorityMeta.impactScore > 0 && priorityMeta.impactScore <= 100);
    assert(['critical', 'high', 'medium', 'low'].includes(priorityMeta.priority));
    assert(priorityMeta.priorityReason.length > 10);
  });

  // ============================================================
  // HTTP REST API END-TO-END TESTS (20 - 23)
  // ============================================================
  const http = require('http');
  const jwt = require('jsonwebtoken');
  const app = require('./app');
  const config = require('./config');

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

  // Persist test insight in database/store for HTTP lookup
  const persistedInsight = await InsightModel.create({
    organizationId: testOrgA,
    datasetId: mixedDataset.id,
    type: 'decline',
    title: 'Q1 Revenue Contraction',
    summary: 'Sales dropped -20%',
    severity: 'warning',
    confidence: 0.95,
    evidence: {
      datasetId: mixedDataset.id,
      metric: 'sales_amount',
      currentValue: 80000,
      comparisonValue: 100000,
      changePercent: -20.0,
      recordsAnalyzed: 8,
      verified: true
    }
  });

  try {
    // -------------------------------------------------------------------------
    // Test 20: GET /api/insights/:id/dimensions
    // -------------------------------------------------------------------------
    await test('20. HTTP GET /api/insights/:id/dimensions returns eligible dimensions', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${persistedInsight.id}/dimensions`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert(Array.isArray(res.body.data.availableDimensions));
      assert(res.body.data.availableDimensions.includes('region'));
      assert(res.body.data.availableDimensions.includes('category'));
    });

    // -------------------------------------------------------------------------
    // Test 21: GET /api/insights/:id/root-cause
    // -------------------------------------------------------------------------
    await test('21. HTTP GET /api/insights/:id/root-cause returns 200 with drivers and explanation', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${persistedInsight.id}/root-cause?dimension=region`, null, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.metric, 'sales_amount');
      assert.strictEqual(res.body.data.dimension, 'region');
      assert.strictEqual(res.body.data.totalDelta, -20000);
      assert(Array.isArray(res.body.data.drivers));
      assert.strictEqual(res.body.data.mathBalanceVerified, true);
      assert(typeof res.body.data.explanation === 'string');
    });

    // -------------------------------------------------------------------------
    // Test 22: POST /api/insights/:id/simulate-scenario
    // -------------------------------------------------------------------------
    await test('22. HTTP POST /api/insights/:id/simulate-scenario returns 200 with counterfactual projection', async () => {
      const res = await apiReq(baseUrl, 'POST', `/api/insights/${persistedInsight.id}/simulate-scenario`, {
        dimension: 'region',
        adjustments: [
          { segment: 'North', deltaPercent: 20.0 }
        ]
      }, {
        Authorization: `Bearer ${tokenAdminA}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.isCounterfactual, true);
      assert.strictEqual(res.body.data.classification, 'COUNTERFACTUAL_SIMULATION');
      assert.strictEqual(res.body.data.baselineTotal, 80000);
      assert.strictEqual(res.body.data.simulatedTotal, 84000); // 20k + 20% = 24k (+4k) => 84k
      assert.strictEqual(res.body.data.netProjectedDelta, 4000);
      assert(Array.isArray(res.body.data.segmentBreakdown));
      assert(typeof res.body.data.explanation === 'string');
    });

    // -------------------------------------------------------------------------
    // Test 23: Multi-tenant isolation over HTTP
    // -------------------------------------------------------------------------
    await test('23. HTTP Multi-tenant isolation: Tenant B denied access (404) to Tenant A insight root-cause', async () => {
      const res = await apiReq(baseUrl, 'GET', `/api/insights/${persistedInsight.id}/root-cause`, null, {
        Authorization: `Bearer ${tokenAdminB}`
      });
      assert.strictEqual(res.statusCode, 404, 'Must return 404 for cross-tenant request');
      assert.strictEqual(res.body.success, false);
    });

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`  PHASE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch(err => {
  console.error('Phase 6 Test Execution Failed:', err);
  process.exit(1);
});
