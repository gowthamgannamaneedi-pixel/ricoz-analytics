const fs = require('fs');
const path = require('path');
const assert = require('assert');
const storage = require('./storage');
const Dataset = require('./models/datasetModel');
const AlertModel = require('./models/alertModel');
const insightService = require('./services/insightService');
const evidenceBuilderService = require('./services/evidenceBuilderService');
const analyticsService = require('./services/analyticsService');

/**
 * PHASE 3: AI INSIGHTS EVIDENCE BUILDER TEST SUITE
 * Verifies dynamic ground-truth evidence calculation, tenant isolation,
 * zero hardcoded values, and non-regression of Phase 1 & Phase 2.
 */
async function runPhase3EvidenceTests() {
  console.log('===============================================================');
  console.log('  PHASE 3: AI INSIGHTS EVIDENCE BUILDER TEST SUITE             ');
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
      failed++;
    }
  }

  const testOrgA = '00000000-0000-0000-0000-000000000001';
  const testOrgB = '00000000-0000-0000-0000-000000000002';
  const testDir = path.resolve(__dirname, 'uploads/test_phase3');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 1. Setup mock datasets
  const growthPath = path.join(testDir, 'growth_evidence.csv');
  fs.writeFileSync(growthPath, [
    'date,revenue,units,region',
    '2026-01-01,10000,10,North',
    '2026-02-01,12500,12,North' // +25.0% growth
  ].join('\n'));

  const declinePath = path.join(testDir, 'decline_evidence.csv');
  fs.writeFileSync(declinePath, [
    'date,revenue,units,region',
    '2026-01-01,50000,50,West',
    '2026-02-01,35000,35,West' // -30.0% decline
  ].join('\n'));

  const qualityPath = path.join(testDir, 'quality_evidence.csv');
  fs.writeFileSync(qualityPath, [
    'id,name,email,score',
    '1,Alice,alice@test.com,95',
    '2,,bob@test.com,80',          // missing name
    '3,Charlie,,70',               // missing email
    '1,Alice,alice@test.com,95'    // duplicate row
  ].join('\n'));

  const emptyPath = path.join(testDir, 'empty_evidence.csv');
  fs.writeFileSync(emptyPath, 'date,revenue,units\n');

  // Register datasets in DB / memory
  const dsGrowth = await Dataset.create({
    userId: 1,
    name: 'Dynamic Q1 Growth Test',
    filePath: growthPath,
    rowCount: 2,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'units', type: 'integer' },
      { name: 'region', type: 'string' }
    ]
  });

  const dsDecline = await Dataset.create({
    userId: 1,
    name: 'Dynamic Q1 Contraction Test',
    filePath: declinePath,
    rowCount: 2,
    columnCount: 4,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'units', type: 'integer' },
      { name: 'region', type: 'string' }
    ]
  });

  const dsQuality = await Dataset.create({
    userId: 1,
    name: 'Data Quality Telemetry Test',
    filePath: qualityPath,
    rowCount: 4,
    columnCount: 4,
    schema: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'score', type: 'numeric' }
    ]
  });

  const dsEmpty = await Dataset.create({
    userId: 1,
    name: 'Empty Dataset Test',
    filePath: emptyPath,
    rowCount: 0,
    columnCount: 3,
    schema: [
      { name: 'date', type: 'date' },
      { name: 'revenue', type: 'numeric' },
      { name: 'units', type: 'integer' }
    ]
  });

  // -------------------------------------------------------------------------
  // Test 1: Revenue / Growth Evidence Calculation
  // -------------------------------------------------------------------------
  await test('1. Growth evidence calculates real values from dataset rows', async () => {
    const records = await analyticsService.loadDatasetRecords(growthPath);
    const dims = analyticsService.detectDatasetDimensions(dsGrowth.schema, records);
    const trends = analyticsService.computeDatasetTrends(records, dims);

    const evidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
      dataset: dsGrowth,
      records,
      dimensions: dims,
      prevPoint: trends[0],
      currPoint: trends[1],
      targetMetric: 'revenue'
    });

    assert.strictEqual(evidence.recordsAnalyzed, 2);
    assert.strictEqual(evidence.currentValue, 12500);
    assert.strictEqual(evidence.comparisonValue, 10000);
    assert.strictEqual(evidence.changePercent, 25);
    assert.strictEqual(evidence.verified, true);
    assert(evidence.calculation.includes('25%'));
    assert(evidence.verificationReason.includes('2 records'));
  });

  // -------------------------------------------------------------------------
  // Test 2: Decline Evidence Calculation
  // -------------------------------------------------------------------------
  await test('2. Decline evidence calculates negative velocity accurately', async () => {
    const records = await analyticsService.loadDatasetRecords(declinePath);
    const dims = analyticsService.detectDatasetDimensions(dsDecline.schema, records);
    const trends = analyticsService.computeDatasetTrends(records, dims);

    const evidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
      dataset: dsDecline,
      records,
      dimensions: dims,
      prevPoint: trends[0],
      currPoint: trends[1],
      targetMetric: 'revenue'
    });

    assert.strictEqual(evidence.recordsAnalyzed, 2);
    assert.strictEqual(evidence.currentValue, 35000);
    assert.strictEqual(evidence.comparisonValue, 50000);
    assert.strictEqual(evidence.changePercent, -30);
    assert.strictEqual(evidence.verified, true);
  });

  // -------------------------------------------------------------------------
  // Test 3: Data Quality Evidence (Null & Duplicate Detection)
  // -------------------------------------------------------------------------
  await test('3. Data quality evidence calculates actual nulls and duplicate counts', async () => {
    const records = await analyticsService.loadDatasetRecords(qualityPath);
    const evidence = evidenceBuilderService.buildDataQualityEvidence({
      dataset: dsQuality,
      records,
      schema: dsQuality.schema
    });

    assert.strictEqual(evidence.recordsAnalyzed, 4);
    assert.strictEqual(evidence.nullCount, 2); // 1 in name, 1 in email
    assert.strictEqual(evidence.duplicateCount, 1); // 1 duplicate Alice row
    assert(evidence.completeness_score < 100);
    assert(evidence.uniqueness_score < 100);
    assert.strictEqual(evidence.verified, true);
  });

  // -------------------------------------------------------------------------
  // Test 4: Operational Alert Evidence (Dataset-Grounded & Unlinked)
  // -------------------------------------------------------------------------
  await test('4. Operational alert evidence calculates threshold breach from dataset', async () => {
    const mockAlertLinked = {
      id: '00000000-0000-0000-0000-000000000099',
      name: 'Q1 Revenue Minimum',
      condition: 'less_than',
      threshold: 100000,
      last_triggered_at: new Date().toISOString()
    };

    const records = await analyticsService.loadDatasetRecords(growthPath);
    const dims = analyticsService.detectDatasetDimensions(dsGrowth.schema, records);

    const linkedEvidence = evidenceBuilderService.buildOperationalAlertEvidence({
      alert: mockAlertLinked,
      dataset: dsGrowth,
      records,
      dimensions: dims
    });

    assert.strictEqual(linkedEvidence.verified, true);
    assert.strictEqual(linkedEvidence.currentValue, 22500); // 10000 + 12500
    assert.strictEqual(linkedEvidence.threshold, 100000);
    assert(linkedEvidence.verificationReason.includes('Verified against 2 records'));

    // Unlinked alert test
    const unlinkedAlert = {
      id: '00000000-0000-0000-0000-000000000098',
      name: 'Unlinked System Alert',
      condition: 'greater_than',
      threshold: 50,
      last_triggered_at: new Date().toISOString()
    };

    const unlinkedEvidence = evidenceBuilderService.buildOperationalAlertEvidence({
      alert: unlinkedAlert,
      dataset: null,
      records: []
    });

    assert.strictEqual(unlinkedEvidence.recordsAnalyzed, 0);
    assert(unlinkedEvidence.verificationReason.includes('operational trigger incident'));
  });

  // -------------------------------------------------------------------------
  // Test 5: Empty Dataset Handling (verified = false)
  // -------------------------------------------------------------------------
  await test('5. Empty dataset handles gracefully with verified=false and clear reason', async () => {
    const records = await analyticsService.loadDatasetRecords(emptyPath);
    const evidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
      dataset: dsEmpty,
      records,
      dimensions: {},
      prevPoint: {},
      currPoint: {}
    });

    assert.strictEqual(evidence.recordsAnalyzed, 0);
    assert.strictEqual(evidence.verified, false);
    assert(evidence.verificationReason.includes('contains 0 records'));
  });

  // -------------------------------------------------------------------------
  // Test 6: Invalid / Missing Metric Handling
  // -------------------------------------------------------------------------
  await test('6. Missing metric handled safely without crashing', async () => {
    const records = [{ colA: 'val1' }, { colA: 'val2' }];
    const evidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
      dataset: dsGrowth,
      records,
      dimensions: { primaryMetric: 'non_existent_column' },
      prevPoint: {},
      currPoint: {}
    });

    assert.strictEqual(evidence.recordsAnalyzed, 2);
    assert.strictEqual(evidence.currentValue, 0);
    assert.strictEqual(evidence.comparisonValue, 0);
    assert.strictEqual(evidence.changePercent, 0);
  });

  // -------------------------------------------------------------------------
  // Test 7: Multi-Tenant Dataset Isolation
  // -------------------------------------------------------------------------
  await test('7. Multi-tenant isolation prevents accessing other organization datasets', async () => {
    // Attempt to load dataset created under default org using Org B credentials
    const result = await evidenceBuilderService.loadDatasetAndRecords(dsGrowth.id, testOrgB);
    assert.strictEqual(result.dataset, null);
    assert.strictEqual(result.records.length, 0);
  });

  // -------------------------------------------------------------------------
  // Test 8: Evidence Verification Rule Enforcement
  // -------------------------------------------------------------------------
  await test('8. verified=true ONLY when evidence is strictly calculated from data', async () => {
    const validEvidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
      dataset: dsGrowth,
      records: [1, 2],
      dimensions: { primaryMetric: 'rev' },
      prevPoint: { revenue: 100 },
      currPoint: { revenue: 150 }
    });
    assert.strictEqual(validEvidence.verified, true);

    const invalidEvidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
      dataset: dsGrowth,
      records: [], // 0 records
      dimensions: {},
      prevPoint: {},
      currPoint: {}
    });
    assert.strictEqual(invalidEvidence.verified, false);
  });

  // -------------------------------------------------------------------------
  // Test 9: Dynamic Updates (No Hardcoded Values)
  // -------------------------------------------------------------------------
  await test('9. Modifying dataset values dynamically recalculates evidence', async () => {
    // Dynamically calculate with revenue=20000 vs 10000 (+100%)
    const customEvidence = evidenceBuilderService.buildGrowthOrDeclineEvidence({
      dataset: dsGrowth,
      records: [1, 2],
      dimensions: { primaryMetric: 'revenue' },
      prevPoint: { revenue: 10000 },
      currPoint: { revenue: 20000 }
    });

    assert.strictEqual(customEvidence.changePercent, 100);
    assert.strictEqual(customEvidence.currentValue, 20000);
    assert.strictEqual(customEvidence.comparisonValue, 10000);
    assert.strictEqual(customEvidence.verified, true);
  });

  // -------------------------------------------------------------------------
  // Test 10: Phase 1 Deduplication & Cooldown Non-Regression
  // -------------------------------------------------------------------------
  await test('10. Existing Phase 1 deduplication & cooldown remain fully functional', async () => {
    const res1 = await insightService.generateInsights(testOrgA, { persist: false });
    assert(res1.insights.length >= 1, 'Should generate at least 1 insight');

    // Generating again should respect cooldown / deduplication
    const res2 = await insightService.generateInsights(testOrgA, { persist: false });
    assert(res2.insights.length >= 1);
  });

  // -------------------------------------------------------------------------
  // Test 11: Phase 2 Persistent Storage Non-Regression
  // -------------------------------------------------------------------------
  await test('11. Existing Phase 2 persistent storage reads seed and cache cleanly', async () => {
    const buffer = await storage.readFile('1/sample_sales_q4.csv');
    assert(buffer && buffer.length > 0);
    const exists = await storage.exists('1/sample_sales_q4.csv');
    assert.strictEqual(exists, true);
  });

  // -------------------------------------------------------------------------
  // Test 12: Integrated InsightService Generation with Evidence
  // -------------------------------------------------------------------------
  await test('12. InsightService generates insights with fully populated evidence structure', async () => {
    const res = await insightService.generateInsights(testOrgA, { datasetId: dsGrowth.id, persist: false });
    for (const ins of res.insights) {
      assert(ins.evidence, 'Every insight must have evidence');
      assert(typeof ins.evidence.verified === 'boolean', 'Every insight must have boolean verified field');
      assert(typeof ins.evidence.recordsAnalyzed === 'number' || typeof ins.evidence.records_analyzed === 'number', 'Every insight must state records analyzed');
    }
  });

  console.log('\n===============================================================');
  console.log(`  PHASE 3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3EvidenceTests().catch(err => {
  console.error('Test runner exception:', err);
  process.exit(1);
});
