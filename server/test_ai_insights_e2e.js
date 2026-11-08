const assert = require('assert');
const db = require('./config/database');
const InsightModel = require('./models/insightModel');
const ReportModel = require('./models/reportModel');
const insightService = require('./services/insightService');
const rootCauseAttributionService = require('./services/rootCauseAttributionService');
const decisionIntelligenceController = require('./controllers/decisionIntelligenceController');
const reportController = require('./controllers/reportController');

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

async function runTests() {
  console.log('=== AI INSIGHTS END-TO-END REMEDIATION VERIFICATION ===\n');

  // TEST 1: Database FK Sanitization & Zero Unpersisted IDs
  console.log('--- Test 1: InsightModel.create FK safety & resilience ---');
  const safeInsight = await InsightModel.create({
    organizationId: TEST_ORG_ID,
    userId: 9999999, // non-existent user ID
    datasetId: 8888888, // non-existent dataset ID
    metricId: '00000000-0000-0000-0000-000000000000', // non-existent metric ID
    type: 'anomaly',
    title: 'Test Statistical Anomaly Invariant Verification',
    summary: 'Automated test to verify resilience against FK constraint errors.',
    severity: 'warning',
    confidence: 0.95,
    evidence: { metric: 'revenue', outliers: 5, recordsAnalyzed: 100 },
    sourceMetadata: { target_column: 'revenue' },
    recommendation: { action: 'Verify outlier timestamps' }
  });

  assert(safeInsight && safeInsight.id, 'Insight was successfully created and returned');
  console.log('  ✓ Insight persisted with real PostgreSQL UUID:', safeInsight.id);

  // TEST 2: Authoritative DB Lookup via findByIdAndOrgId & findById
  console.log('\n--- Test 2: Database lookup via findByIdAndOrgId and findById ---');
  const fetched = await InsightModel.findByIdAndOrgId(safeInsight.id, TEST_ORG_ID);
  assert(fetched && fetched.id === safeInsight.id, 'Fetched insight matches created ID');
  console.log('  ✓ findByIdAndOrgId retrieved persisted record:', fetched.title);

  const fetchedById = await InsightModel.findById(safeInsight.id);
  assert(fetchedById && fetchedById.id === safeInsight.id, 'Fetched by ID alone matches');
  console.log('  ✓ findById cross-tenant lookup succeeded');

  // TEST 3: Business Radar Variance Attribution on Real Persisted Insight
  console.log('\n--- Test 3: Business Radar Attribution on Persisted Insight ---');
  const radarReq = {
    user: { id: 1, organization_id: TEST_ORG_ID, role: 'admin' },
    params: { id: safeInsight.id },
    query: {}
  };
  let radarStatusCode = 200;
  let radarResponseData = null;
  const radarRes = {
    status(code) {
      radarStatusCode = code;
      return this;
    },
    json(payload) {
      radarResponseData = payload;
      return this;
    }
  };

  await decisionIntelligenceController.getRootCause(radarReq, radarRes);
  assert.strictEqual(radarStatusCode, 200, 'Business Radar returns HTTP 200');
  assert(radarResponseData?.success === true, 'Business Radar response success is true');
  console.log('  ✓ Business Radar returned HTTP 200 with radar payload:', {
    success: radarResponseData.success,
    metric: radarResponseData.data?.metric || radarResponseData.data?.radar?.metric,
    hasDrivers: Array.isArray(radarResponseData.data?.drivers)
  });

  // TEST 4: Add Insight to Report Functionality & Persistence
  console.log('\n--- Test 4: Report Creation & Insight Attachment ---');
  // Create a test report
  const testReport = await ReportModel.create({
    organizationId: TEST_ORG_ID,
    createdBy: 1,
    title: 'E2E Automated AI Insight Test Digest',
    description: 'Report created during verification run',
    format: 'pdf',
    status: 'draft'
  });
  assert(testReport && testReport.id, 'Test report created successfully');
  console.log('  ✓ Created report definition:', testReport.id, testReport.title);

  // Attach insight to report via controller
  const attachReq = {
    user: { id: 1, organization_id: TEST_ORG_ID, role: 'admin' },
    params: { id: testReport.id },
    body: { insightId: safeInsight.id }
  };
  let attachStatusCode = 200;
  let attachResponseData = null;
  const attachRes = {
    status(code) {
      attachStatusCode = code;
      return this;
    },
    json(payload) {
      attachResponseData = payload;
      return this;
    }
  };

  await reportController.addInsightToReport(attachReq, attachRes);
  assert.strictEqual(attachStatusCode, 200, 'addInsightToReport returns HTTP 200');
  assert(attachResponseData?.success === true, 'Attachment response success is true');
  console.log('  ✓ Insight successfully linked to report:', attachResponseData.message);

  // Verify report_insights junction table & report.insights column
  const reportInsights = await ReportModel.getReportInsights(testReport.id, TEST_ORG_ID);
  assert(reportInsights.length >= 1, 'Report has at least 1 associated insight');
  assert(reportInsights.some(ri => ri.id === safeInsight.id), 'Linked insight ID exists in report_insights');
  console.log('  ✓ Verified in DB junction table: report has', reportInsights.length, 'attached insight(s)');

  // TEST 5: Insight Deduplication Logic (No duplicate anomaly findings)
  console.log('\n--- Test 5: Insight Deduplication Engine ---');
  // Attempt to find active duplicate
  const dupMatch = await InsightModel.findActiveDuplicate({
    organizationId: TEST_ORG_ID,
    type: 'anomaly',
    title: 'Test Statistical Anomaly Invariant Verification',
    cooldownMinutes: 60
  });
  assert(dupMatch !== null, 'Deduplication engine detects duplicate insight within cooldown window');
  assert.strictEqual(dupMatch.id, safeInsight.id, 'Duplicate match points to the existing DB record ID');
  console.log('  ✓ Deduplication engine properly mapped duplicate candidate to existing ID:', dupMatch.id);

  // CLEANUP
  console.log('\n--- Cleaning up test records ---');
  await db.query('DELETE FROM report_insights WHERE report_id = $1', [testReport.id]);
  await db.query('DELETE FROM reports WHERE id = $1', [testReport.id]);
  await db.query('DELETE FROM ai_insights WHERE id = $1', [safeInsight.id]);
  console.log('  ✓ Cleanup complete');

  console.log('\n🎉 ALL 5 AI INSIGHTS E2E TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});

